import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Public Config API
 * The game pulls settings from here on startup
 */
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('game_config')
            .select('*')
            .eq('id', 'main')
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Config fetch failed' }, { status: 500 });
    }
}
