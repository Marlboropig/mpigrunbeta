import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * MPIG Admin API
 * Secure route for administrative tasks
 */

export async function POST(request: Request) {
    try {
        const { action, secret, target_wallet } = await request.json();

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

        const totalOinks = allPlayers.reduce((sum, p) => sum + (p.oinks || 0), 0);
        const highestScore = Math.max(...allPlayers.map(p => p.high_score || 0), 0);

        return NextResponse.json({
            stats: {
                totalPlayers: allPlayers.length,
                totalOinks,
                highestScore
            },
            players: allPlayers
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
