import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Tournament Management API
 * Handle CRUD operations for tournaments (Admin Only)
 */

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        // Optional Secret Check (matching our Admin pattern)
        if (secret && secret !== process.env.ADMIN_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { secret, action, tournament_id, tournament_data } = body;

        // Admin Secret Verification
        if (secret !== process.env.ADMIN_SECRET) {
            return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
        }

        switch (action) {
            case 'CREATE':
                const { data: createData, error: createError } = await supabase
                    .from('tournaments')
                    .insert([tournament_data])
                    .select();
                if (createError) throw createError;
                return NextResponse.json(createData[0]);

            case 'UPDATE':
                const { data: updateData, error: updateError } = await supabase
                    .from('tournaments')
                    .update(tournament_data)
                    .eq('id', tournament_id)
                    .select();
                if (updateError) throw updateError;
                return NextResponse.json(updateData[0]);

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from('tournaments')
                    .delete()
                    .eq('id', tournament_id);
                if (deleteError) throw deleteError;
                return NextResponse.json({ success: true });

            case 'TOGGLE_STATUS':
                const { data: currentT } = await supabase
                    .from('tournaments')
                    .select('is_active')
                    .eq('id', tournament_id)
                    .single();
                
                const { error: toggleError } = await supabase
                    .from('tournaments')
                    .update({ is_active: !currentT?.is_active })
                    .eq('id', tournament_id);
                
                if (toggleError) throw toggleError;
                return NextResponse.json({ success: true });

            default:
                return NextResponse.json({ error: 'Unknown Action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Tournament API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
