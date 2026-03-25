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
    const tournament_id = searchParams.get('tournament_id') || '00000000-0000-0000-0000-000000000000';

    try {
        // 1. Fetch Rank and Payment Status if address provided
        let playerRank = null;
        let hasPaid = false;
        
        if (address) {
            // Updated rank query for specific tournament
            const { data: rankData, error: rankError } = await supabase
                .from('tournament_scores')
                .select('wallet_address, high_score, has_paid')
                .eq('tournament_id', tournament_id)
                .order('high_score', { ascending: false });

            if (!rankError && rankData) {
                const index = rankData.findIndex(p => p.wallet_address === address);
                if (index !== -1) {
                    playerRank = index + 1;
                    hasPaid = rankData[index].has_paid || false;
                }
            }
        }

        // 2. Fetch Leaderboard List
        const { data, error } = await supabase
            .from('tournament_scores')
            .select('wallet_address, high_score, username')
            .eq('tournament_id', tournament_id)
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

        if (update_only_username) {
            // Update in both legacy and tournament_scores
            await supabase
                .from('leaderboard')
                .upsert({
                    wallet_address,
                    username,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'wallet_address' });

            const { error: tsError } = await supabase
                .from('tournament_scores')
                .upsert({
                    tournament_id,
                    wallet_address,
                    username,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tournament_id,wallet_address' });

            if (tsError) throw tsError;
            return NextResponse.json({ success: true });
        }

        // Logic check: only update tournament score if better
        const { data: currentEntry, error: fetchError } = await supabase
            .from('tournament_scores')
            .select('high_score')
            .eq('tournament_id', tournament_id)
            .eq('wallet_address', wallet_address)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (!currentEntry || high_score > currentEntry.high_score) {
            // Always keep global stats in 'leaderboard' for lifetime records
            await supabase
                .from('leaderboard')
                .upsert({
                    wallet_address,
                    high_score,
                    oinks,
                    username,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'wallet_address' });

            // Update in tournament_scores
            const { error: upsertError } = await supabase
                .from('tournament_scores')
                .upsert({
                    tournament_id,
                    wallet_address,
                    high_score,
                    oinks,
                    username,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tournament_id,wallet_address' });

            if (upsertError) throw upsertError;
            return NextResponse.json({ success: true, updated: true });
        }

        return NextResponse.json({ success: true, updated: false });
    } catch (error) {
        console.error('Error submitting score:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
