'use client';
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

export default function ProfilePage() {
    const { publicKey, connected } = useWallet();
    const [username, setUsername] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (connected && publicKey) {
            fetch(`/api/leaderboard?address=${publicKey.toString()}`)
                .then(res => res.json())
                .then(data => {
                    const me = data.leaderboard?.find((e: any) => e.wallet_address === publicKey.toString());
                    if (me?.username) setUsername(me.username);
                });
        }
    }, [connected, publicKey]);

    const handleSave = async () => {
        if (!publicKey) return;
        setIsSaving(true);
        setStatus('Saving...');
        try {
            const res = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: publicKey.toString(),
                    username: username,
                    update_only_username: true
                })
            });
            if (res.ok) setStatus('Username updated!');
            else setStatus('Error saving username.');
        } catch (err) {
            setStatus('Network error.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setStatus(''), 3000);
        }
    };

    return (
        <main className="min-h-dvh bg-black flex flex-col items-center justify-center p-6 font-['var(--font-orbitron)'] relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#14F195]/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FFD700]/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-[400px] bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 relative shadow-2xl">
                <Link href="/" className="text-[#14F195] text-[10px] font-black tracking-[4px] uppercase mb-10 block hover:opacity-70 transition-opacity italic">
                    ← BACK TO MENU
                </Link>

                <h1 className="text-3xl font-black text-white tracking-[8px] uppercase mb-2">PROFILE</h1>
                <p className="text-white/40 text-[10px] tracking-[4px] uppercase mb-10 italic">SET YOUR IDENTITY</p>

                {!connected ? (
                    <div className="flex flex-col items-center gap-6 py-10">
                        <p className="text-white/60 text-xs text-center leading-relaxed">Connect your wallet to choose a username and track your global rank.</p>
                        <WalletMultiButton />
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#FFD700] tracking-[3px] uppercase ml-1">USERNAME</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.slice(0, 15))}
                                placeholder="ENTER NAME..."
                                className="w-full h-14 bg-black/40 border-2 border-white/5 rounded-xl px-6 text-white font-bold tracking-widest focus:border-[#14F195]/40 outline-none transition-all"
                            />
                            <p className="text-[8px] text-white/30 tracking-widest uppercase ml-1">MAX 15 CHARACTERS</p>
                        </div>

                        <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                            <label className="text-[8px] font-black text-white/30 tracking-[3px] uppercase block mb-2">CONNECTED WALLET</label>
                            <p className="text-[10px] text-white/80 font-mono truncate">{publicKey.toString()}</p>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full h-14 bg-linear-to-r from-[#14F195] to-[#9945FF] rounded-xl text-white font-black tracking-[6px] uppercase shadow-[0_10px_30px_rgba(20,241,149,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'SYNCING...' : 'SAVE IDENTITY'}
                        </button>

                        {status && <p className="text-center text-[10px] font-black text-[#14F195] animate-pulse uppercase tracking-[2px]">{status}</p>}
                    </div>
                )}
            </div>
        </main>
    );
}
