import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    // Admin Security
    if (secret !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: 'Unauthorized Mission Protocol' }, { status: 401 });
    }

    try {
        // 1. Calculate Tournament Revenue
        const { data: scores, error: scoresError } = await supabase
            .from('tournament_scores')
            .select('tournament_id, has_paid')
            .eq('has_paid', true);

        const { data: tournaments, error: tourError } = await supabase
            .from('tournaments')
            .select('id, entry_fee_mpig');

        if (scoresError || tourError) throw scoresError || tourError;

        let tournamentRevenue = 0;
        scores?.forEach(s => {
            const t = tournaments?.find(tour => tour.id === s.tournament_id);
            if (t) tournamentRevenue += Number(t.entry_fee_mpig || 0);
        });

        // 2. Calculate Skin Revenue
        const { data: inventory, error: invError } = await supabase
            .from('user_inventory')
            .select('skin_id');

        const { data: skins, error: skinsError } = await supabase
            .from('skins')
            .select('id, price_mpig');

        if (invError || skinsError) throw invError || skinsError;

        let skinRevenue = 0;
        inventory?.forEach(i => {
            const s = skins?.find(sk => sk.id === i.skin_id);
            if (s) skinRevenue += Number(s.price_mpig || 0);
        });

        // 3. User & Player Growth
        const { count: totalPlayers } = await supabase
            .from('tournament_scores')
            .select('*', { count: 'exact', head: true });

        const { count: totalSkins } = await supabase
            .from('skins')
            .select('*', { count: 'exact', head: true });

        return NextResponse.json({
            tournamentRevenue,
            skinRevenue,
            totalPlayers,
            totalSkins,
            totalRevenue: tournamentRevenue + skinRevenue
        });

    } catch (error: any) {
        console.error('Stats Engine Failure:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
