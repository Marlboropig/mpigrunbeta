import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

export async function POST(request: Request) {
    try {
        const { publicKey, signature, message } = await request.json();

        if (!publicKey || !signature || !message) {
            return NextResponse.json({ error: 'Missing authentication parameters' }, { status: 400 });
        }

        // Verify the signature using Solana's tweetnacl
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = bs58.decode(publicKey);

        const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Generate a secure JWT token valid for 2 hours
        const secret = process.env.ADMIN_SECRET || 'mpig_fallback_secret_key_2026';
        const token = jwt.sign(
            { wallet_address: publicKey },
            secret,
            { expiresIn: '2h' }
        );

        return NextResponse.json({ success: true, token });
    } catch (error: any) {
        console.error('Auth API Error:', error);
        return NextResponse.json({ error: 'Authentication failed: ' + error.message }, { status: 500 });
    }
}
