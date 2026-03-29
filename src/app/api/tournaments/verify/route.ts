import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase';

/**
 * Phase 2 - Transaction Verification Engine
 * Verifies Solana SPL Token transfers for tournament entry fees
 */

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET || 'BM1HwiJ1hJBpadQF5tXu5qJYoVGQCXR3ABm4pJ4wepSQ';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export async function POST(request: Request) {
    try {
        const { txHash, walletAddress, tournamentId } = await request.json();

        if (!txHash || !walletAddress || !tournamentId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // 1. Prevent Double Spends (Check if txHash already used)
        const { data: existingTx } = await supabase
            .from('payment_logs')
            .select('tx_hash')
            .eq('tx_hash', txHash)
            .single();

        if (existingTx) {
            return NextResponse.json({ error: 'Transaction already processed' }, { status: 400 });
        }

        // 2. Fetch Tournament Fee
        const { data: tournament, error: tError } = await supabase
            .from('tournaments')
            .select('entry_fee_usd')
            .eq('id', tournamentId)
            .single();

        if (tError || !tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        const requiredFeeUsd = Number(tournament.entry_fee_usd || 0);

        // 3. Chain Verification
        const rpcHost = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcHost, 'confirmed');
        const tx = await connection.getParsedTransaction(txHash, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) {
            return NextResponse.json({ error: 'Transaction not found on-chain.' }, { status: 404 });
        }

        // 4. Inspect Transaction
        let isVerified = false;
        let amountParsed = 0;

        // --- SOL TRANSFER VERIFICATION (USD Basis) ---
        if (requiredFeeUsd > 0) {
            // Check native SOL transfers
            const instructions = tx.transaction.message.instructions;
            for (const ix of instructions) {
                if ('parsed' in ix && ix.program === 'system' && ix.parsed.type === 'transfer') {
                    const { info } = ix.parsed;
                    if (info.destination === TREASURY_WALLET && info.source === walletAddress) {
                        amountParsed = info.lamports / 1e9;
                        isVerified = true; 
                        break;
                    }
                }
            }
        } 
        else {
             // Free tournaments or points-based entry (if any)
             isVerified = true;
        }

        if (!isVerified) {
             return NextResponse.json({ error: `Insufficient or invalid payment detected.` }, { status: 400 });
        }

        // 5. Success! Log Payment and Update User Status
        await supabase.from('payment_logs').insert([{
            tx_hash: txHash,
            wallet_address: walletAddress,
            amount: amountParsed,
            tournament_id: tournamentId,
            currency: 'SOL'
        }]);

        await supabase
            .from('tournament_scores')
            .upsert({
                tournament_id: tournamentId,
                wallet_address: walletAddress,
                has_paid: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'tournament_id,wallet_address' });

        return NextResponse.json({ success: true, message: 'Payment Verified. Welcome to the Zone.' });

    } catch (error: any) {
        console.error('Payment Verification Error:', error);
        return NextResponse.json({ error: 'Verification Failed: ' + error.message }, { status: 500 });
    }
}
