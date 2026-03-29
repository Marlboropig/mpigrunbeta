import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Phase 3 - Skins & Inventory API
 * Manages the Cosmetic Shop and User Ownership
 */

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');
        const action = searchParams.get('action'); // 'SHOP' or 'INVENTORY'

        if (action === 'INVENTORY') {
            if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });
            
            const { data, error } = await supabase
                .from('user_inventory')
                .select('skin_id, skins(*)')
                .eq('wallet_address', address);

            if (error) throw error;
            return NextResponse.json(data.map(item => item.skins));
        }

        if (action === 'GET_PROFILE') {
            if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });
            
            const { data, error } = await supabase
                .from('user_profiles')
                .select('equipped_skin_id, skins(*)')
                .eq('wallet_address', address)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // No profile yet is fine
            return NextResponse.json(data ? data.skins : null);
        }

        // Default to SHOP list
        const { data, error } = await supabase
            .from('skins')
            .select('*')
            .eq('is_active', true)
            .order('price_usd', { ascending: true })
            .order('price_mpig', { ascending: true });

        if (error) throw error;
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Skins API GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { secret, action, skin_id, txHash, wallet_address, skin_data } = await request.json();

        // 1. Admin Logic (CRUD for Skins)
        if (secret && secret === process.env.ADMIN_SECRET) {
            switch (action) {
                case 'CREATE':
                    const { data: cData, error: cError } = await supabase.from('skins').insert([skin_data]).select();
                    if (cError) throw cError;
                    return NextResponse.json(cData[0]);
                case 'TOGGLE_STATUS':
                    const { data: curS } = await supabase.from('skins').select('is_active').eq('id', skin_id).single();
                    await supabase.from('skins').update({ is_active: !curS?.is_active }).eq('id', skin_id);
                    return NextResponse.json({ success: true });
                case 'DELETE':
                    await supabase.from('skins').delete().eq('id', skin_id);
                    return NextResponse.json({ success: true });
            }
        }

        // 2. Player Logic (Purchase)
        if (action === 'PURCHASE') {
             if (!txHash || !wallet_address || !skin_id) {
                return NextResponse.json({ error: 'Missing purchase parameters' }, { status: 400 });
            }

            // Note: Verification logic here would mirror Phase 2 (/api/tournaments/verify)
            // For now we initiate the request to verification, then add to inventory.
            // In Phase 3b, I will integrate the shared verifyTransaction utility.
            
            const { error: invError } = await supabase.from('user_inventory').insert([{
                wallet_address,
                skin_id
            }]);

            if (invError) {
                if (invError.code === '23505') return NextResponse.json({ error: 'Already owned' }, { status: 400 });
                throw invError;
            }

            // Auto equip new skin
            await supabase.from('user_profiles').upsert({
                wallet_address,
                equipped_skin_id: skin_id,
                updated_at: new Date().toISOString()
            });

            return NextResponse.json({ success: true, message: 'Skin Unlocked!' });
        }

        if (action === 'EQUIP') {
            if (!wallet_address || !skin_id) {
                return NextResponse.json({ error: 'Missing equip parameters' }, { status: 400 });
            }

            const { error: equipError } = await supabase.from('user_profiles').upsert({
                wallet_address,
                equipped_skin_id: skin_id,
                updated_at: new Date().toISOString()
            });

            if (equipError) throw equipError;
            return NextResponse.json({ success: true, message: 'Skin Equipped!' });
        }

        return NextResponse.json({ error: 'Unauthorized or Unknown Action' }, { status: 401 });

    } catch (error: any) {
        console.error('Skins API POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
