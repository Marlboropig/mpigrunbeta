import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

/**
 * Milestone 3 API - Global Leaderboard Sync
 */

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const address = searchParams.get('address');
    const tournament_id_param = searchParams.get('tournament_id');
    const isGlobal = !tournament_id_param;
    const tournament_id = tournament_id_param || '00000000-0000-0000-0000-000000000000';

    try {
        let playerRank = null;
        let hasPaid = false;
        
        // Target table: 'leaderboard' for global, 'tournament_scores' for specific
        const targetTable = isGlobal ? 'leaderboard' : 'tournament_scores';

        if (address) {
            const { data: rankData, error: rankError } = await supabase
                .from(targetTable)
                .select('wallet_address, high_score')
                .match(isGlobal ? {} : { tournament_id })
                .order('high_score', { ascending: false });

            if (!rankError && rankData) {
                const index = rankData.findIndex(p => p.wallet_address === address);
                if (index !== -1) {
                    playerRank = index + 1;
                }
            }

            // Check payment if tournament specific
            if (!isGlobal) {
                const { data: payData } = await supabase
                    .from('tournament_scores')
                    .select('has_paid')
                    .eq('tournament_id', tournament_id)
                    .eq('wallet_address', address)
                    .single();
                if (payData) hasPaid = payData.has_paid;
            }
        }

        const { data, error } = await supabase
            .from(targetTable)
            .select('wallet_address, high_score, username')
            .match(isGlobal ? {} : { tournament_id })
            .gt('high_score', 0)
            .order('high_score', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return NextResponse.json({
            leaderboard: data,
            rank: playerRank,
            has_paid: hasPaid
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid authentication token' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        let decodedToken: any;

        try {
            const secret = process.env.ADMIN_SECRET || 'mpig_fallback_secret_key_2026';
            decodedToken = jwt.verify(token, secret);
        } catch (err) {
            return NextResponse.json({ error: 'Token expired or invalid' }, { status: 401 });
        }

        const { 
            wallet_address, 
            high_score, 
            oinks, 
            username, 
            update_only_username,
            tournament_id = '00000000-0000-0000-0000-000000000000'
        } = await request.json();

        if (!wallet_address || decodedToken.wallet_address !== wallet_address) {
            return NextResponse.json({ error: 'Invalid wallet address or token mismatch' }, { status: 400 });
        }

        // Check if user already exists to determine auto-verify and demotion
        const { data: globalEntry } = await supabase
            .from('leaderboard')
            .select('high_score, is_verified')
            .eq('wallet_address', wallet_address)
            .single();

        const isNewUser = !globalEntry;

        if (update_only_username) {
            const upData: any = {
                wallet_address,
                username,
                updated_at: new Date().toISOString()
            };
            
            // Auto-verify ONLY if this is their first time "getting in"
            if (isNewUser) {
                upData.is_verified = true;
            }

            await supabase.from('leaderboard').upsert(upData, { onConflict: 'wallet_address' });

            // Also update in current tournament if any
            if (tournament_id && tournament_id !== '00000000-0000-0000-0000-000000000000') {
                await supabase
                    .from('tournament_scores')
                    .upsert({
                        tournament_id,
                        wallet_address,
                        username,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'tournament_id,wallet_address' });
            }

            return NextResponse.json({ success: true });
        }

        // 1. Separate Logic for Global and Tournament High Scores
        // Check current tournament record
        const { data: tourneyEntry } = await supabase
            .from('tournament_scores')
            .select('high_score')
            .eq('tournament_id', tournament_id)
            .eq('wallet_address', wallet_address)
            .single();

        const updates = [];

        // Only update global if it's actually higher than existing global high score
        if (isNewUser || high_score > (globalEntry?.high_score || 0)) {
            const upData: any = { wallet_address, high_score, oinks, updated_at: new Date().toISOString() };
            if (username) upData.username = username;
            
            // Auto-verify if this is the first entry
            if (isNewUser) {
                upData.is_verified = true;
            }
            
            updates.push(supabase.from('leaderboard').upsert(upData, { onConflict: 'wallet_address' }));
        }
            
        // Only update tournament if it's higher than existing tournament high score
        if (!tourneyEntry || high_score > (tourneyEntry.high_score || 0)) {
            const upData: any = { tournament_id, wallet_address, high_score, oinks, updated_at: new Date().toISOString() };
            if (username) upData.username = username;

            updates.push(supabase.from('tournament_scores').upsert(upData, { onConflict: 'tournament_id,wallet_address' }));
        }

        if (updates.length > 0) {
            await Promise.all(updates);
            return NextResponse.json({ success: true, updated: true });
        }

        return NextResponse.json({ success: true, updated: false });
    } catch (error) {
        console.error('Error submitting score:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
