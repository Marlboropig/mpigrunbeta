import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Milestone 3 API - Global Leaderboard Sync
 */

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const address = searchParams.get('address');

    try {
        // 1. Fetch Rank if address provided
        let playerRank = null;
        if (address) {
            const { data: rankData, error: rankError } = await supabase
                .rpc('get_player_rank', { target_wallet_address: address });
            if (!rankError) playerRank = rankData;
        }

        // 2. Fetch Leaderboard List
        const { data, error } = await supabase
            .from('leaderboard')
            .select('wallet_address, high_score, username')
            .order('high_score', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return NextResponse.json({
            leaderboard: data,
            rank: playerRank
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { wallet_address, high_score, oinks, username, update_only_username } = await request.json();

        if (!wallet_address) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        if (update_only_username) {
            const { error: updateError } = await supabase
                .from('leaderboard')
                .upsert({
                    wallet_address,
                    username,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'wallet_address' });

            if (updateError) throw updateError;
            return NextResponse.json({ success: true });
        }

        // Logic check: only update score if better
        const { data: currentEntry, error: fetchError } = await supabase
            .from('leaderboard')
            .select('high_score')
            .eq('wallet_address', wallet_address)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (!currentEntry || high_score > currentEntry.high_score) {
            const { error: upsertError } = await supabase
                .from('leaderboard')
                .upsert({
                    wallet_address,
                    high_score,
                    oinks,
                    username,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'wallet_address' });

            if (upsertError) throw upsertError;
            return NextResponse.json({ success: true, updated: true });
        }

        return NextResponse.json({ success: true, updated: false });
    } catch (error) {
        console.error('Error submitting score:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
