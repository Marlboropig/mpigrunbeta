import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase';

/**
 * Phase 2 - Transaction Verification Engine
 * Verifies Solana SPL Token transfers for tournament entry fees
 */

const MPIG_MINT = process.env.NEXT_PUBLIC_MPIG_MINT || 'Ff7F96e7HntW5D9QH2bwDHPYZesF2gx7ACipSxxtpump';
const TREASURY_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET || 'DtBk7Gm7mxzijoiyeT71caEWA3Rf6EFGdujt79ftS1VG';
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
            .select('entry_fee_mpig')
            .eq('id', tournamentId)
            .single();

        if (tError || !tournament) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        const requiredFee = Number(tournament.entry_fee_mpig);

        // 3. Chain Verification
        const connection = new Connection(SOLANA_RPC, 'confirmed');
        const tx = await connection.getParsedTransaction(txHash, {
            maxSupportedTransactionVersion: 0
        });

        if (!tx) {
            return NextResponse.json({ error: 'Transaction not found on-chain. Wait or check hash.' }, { status: 404 });
        }

        // 4. Inspect Transaction Instructions for SPL Transfer
        let amountPaid = 0;
        let recipientMatched = false;
        let mintMatched = false;

        // Note: Simple verification logic for SPL Token transfers
        // In a production environment, you should be more exhaustive with inner instructions
        const instructions = tx.meta?.postTokenBalances || [];
        
        // Find the change for the treasury wallet
        const treasuryBalanceChange = instructions.find(b => 
            b.owner === TREASURY_WALLET && 
            b.mint === MPIG_MINT
        );

        const senderBalanceChange = instructions.find(b => 
            b.owner === walletAddress && 
            b.mint === MPIG_MINT
        );

        if (treasuryBalanceChange && senderBalanceChange) {
            // Calculate amount from balance changes
            const pre = instructions.find(b => b.owner === TREASURY_WALLET)?.uiTokenAmount.uiAmount || 0;
            const post = treasuryBalanceChange.uiTokenAmount.uiAmount || 0;
            amountPaid = post - pre;
            recipientMatched = true;
            mintMatched = true;
        }

        // Fallback or precise check for Transfer instructions (simplified for this context)
        // We trust the balance change if it corresponds to the treasury
        
        if (amountPaid < requiredFee * 0.99) { // 1% Tolerance for decimal weirdness
             return NextResponse.json({ error: `Insufficient payment. Required: ${requiredFee}, Found: ${amountPaid}` }, { status: 400 });
        }

        // 5. Success! Log Payment and Update User Status
        await supabase.from('payment_logs').insert([{
            tx_hash: txHash,
            wallet_address: walletAddress,
            amount: amountPaid,
            tournament_id: tournamentId
        }]);

        const { error: updateError } = await supabase
            .from('tournament_scores')
            .upsert({
                tournament_id: tournamentId,
                wallet_address: walletAddress,
                has_paid: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'tournament_id,wallet_address' });

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, message: 'Payment Verified. Welcome to the Zone.' });

    } catch (error: any) {
        console.error('Payment Verification Error:', error);
        return NextResponse.json({ error: 'Verification Failed: ' + error.message }, { status: 500 });
    }
}
