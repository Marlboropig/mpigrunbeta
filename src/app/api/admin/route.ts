import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * MPIG Admin API
 * Secure route for administrative tasks
 */

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, secret, target_wallet, config } = body;

        // 1. Authentication Check
        if (secret !== process.env.ADMIN_SECRET) {
            return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
        }

        switch (action) {
            case 'RESET_LEADERBOARD':
                const { error: resetError } = await supabase
                    .from('leaderboard')
                    .delete()
                    .neq('wallet_address', ''); // Hacky way to delete everything in Supabase REST API

                if (resetError) throw resetError;
                return NextResponse.json({ success: true, message: 'Leaderboard wiped successfully' });

            case 'DELETE_PLAYER':
                if (!target_wallet) return NextResponse.json({ error: 'Missing target wallet' }, { status: 400 });
                const { error: delError } = await supabase
                    .from('leaderboard')
                    .delete()
                    .eq('wallet_address', target_wallet);

                if (delError) throw delError;
                return NextResponse.json({ success: true, message: `Player ${target_wallet} removed` });

            case 'RESET_SCORE':
                if (!target_wallet) return NextResponse.json({ error: 'Missing target wallet' }, { status: 400 });
                const { error: updateError } = await supabase
                    .from('leaderboard')
                    .update({ high_score: 0, oinks: 0 })
                    .eq('wallet_address', target_wallet);

                if (updateError) throw updateError;
                return NextResponse.json({ success: true, message: `Score reset for ${target_wallet}` });

            case 'TOGGLE_VERIFIED':
                if (!target_wallet) return NextResponse.json({ error: 'Missing target wallet' }, { status: 400 });
                // We need to get current status first since we don't have a direct toggle in REST
                const { data: pData } = await supabase.from('leaderboard').select('is_verified').eq('wallet_address', target_wallet).single();
                await supabase.from('leaderboard').update({ is_verified: !pData?.is_verified }).eq('wallet_address', target_wallet);
                return NextResponse.json({ success: true });

            case 'TOGGLE_BAN':
                if (!target_wallet) return NextResponse.json({ error: 'Missing target wallet' }, { status: 400 });
                const { data: bData } = await supabase.from('leaderboard').select('is_banned').eq('wallet_address', target_wallet).single();
                await supabase.from('leaderboard').update({ is_banned: !bData?.is_banned }).eq('wallet_address', target_wallet);
                return NextResponse.json({ success: true });

            case 'UPDATE_CONFIG':
                const { error: confError } = await supabase
                    .from('game_config')
                    .update({ ...config, updated_at: new Date().toISOString() })
                    .eq('id', 'main');
                if (confError) throw confError;
                return NextResponse.json({ success: true });

            case 'START_NEW_SEASON':
                // Reset all player scores and oinks
                const { error: seasonResetError } = await supabase
                    .from('leaderboard')
                    .update({ high_score: 0, oinks: 0 })
                    .neq('wallet_address', 'non_existent_wallet'); // Update all rows by matching a non-existent condition

                if (seasonResetError) throw seasonResetError;

                // Optionally, update a season counter in game_config if needed
                // For example:
                // const { data: currentConfig, error: configFetchError } = await supabase.from('game_config').select('season').eq('id', 'main').single();
                // if (configFetchError) throw configFetchError;
                // const newSeason = (currentConfig?.season || 0) + 1;
                // const { error: seasonUpdateError } = await supabase.from('game_config').update({ season: newSeason, updated_at: new Date().toISOString() }).eq('id', 'main');
                // if (seasonUpdateError) throw seasonUpdateError;

                return NextResponse.json({ success: true, message: 'New season started: all player scores and oinks reset.' });

            case 'VERIFY_ALL_PLAYERS':
                const { error: verifyAllError } = await supabase
                    .from('leaderboard')
                    .update({ is_verified: true })
                    .neq('wallet_address', ''); // Update all rows where wallet_address exists
                
                if (verifyAllError) throw verifyAllError;
                return NextResponse.json({ success: true, message: 'All players verified successfully.' });

            default:
                return NextResponse.json({ error: 'Unknown Action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Admin API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Authentication Check
    if (secret !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    try {
        // Fetch stats
        const { data: allPlayers, error: err1 } = await supabase
            .from('leaderboard')
            .select('*');

        if (err1) throw err1;

        const { data: config, error: err2 } = await supabase
            .from('game_config')
            .select('*')
            .eq('id', 'main')
            .single();

        if (err2) throw err2;

        // NEW: Calculate Economy Stats
        const { data: scores } = await supabase.from('tournament_scores').select('tournament_id').eq('has_paid', true);
        const { data: tourData } = await supabase.from('tournaments').select('id, entry_fee_mpig');
        let tournamentRevenue = 0;
        scores?.forEach(s => {
            const t = tourData?.find(tour => tour.id === s.tournament_id);
            if (t) tournamentRevenue += (t.entry_fee_mpig || 0);
        });

        const { data: inventory } = await supabase.from('user_inventory').select('skin_id');
        const { data: skinData } = await supabase.from('skins').select('id, price_mpig');
        let skinRevenue = 0;
        inventory?.forEach(i => {
            const s = skinData?.find(sk => sk.id === i.skin_id);
            if (s) skinRevenue += (s.price_mpig || 0);
        });

        const verifiedPlayers = allPlayers.filter(p => p.is_verified);
        const totalOinks = verifiedPlayers.reduce((sum, p) => sum + (p.oinks || 0), 0);
        const highestScore = Math.max(...verifiedPlayers.map(p => p.high_score || 0), 0);

        return NextResponse.json({
            stats: {
                totalPlayers: allPlayers.length,
                verifiedPlayers: verifiedPlayers.length,
                totalOinks,
                highestScore,
                tournamentRevenue,
                skinRevenue,
                totalRevenue: tournamentRevenue + skinRevenue
            },
            players: allPlayers,
            config
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
