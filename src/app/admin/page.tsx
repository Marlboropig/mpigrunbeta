'use client';
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

export default function AdminPage() {
    const { publicKey, connected } = useWallet();
    const [secret, setSecret] = useState('');
    const [isAuth, setIsAuth] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');

    const isAdminWallet = connected && publicKey?.toBase58() === ADMIN_WALLET;

    const fetchAdminData = async () => {
        if (!secret) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin?secret=${secret}`);
            const data = await res.json();
            if (res.ok) {
                setStats(data.stats);
                setPlayers(data.players);
                setIsAuth(true);
            } else {
                setStatus('Unauthorized or Invalid Secret');
            }
        } catch (err) {
            setStatus('Error connecting to Server');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (action: string, target_wallet?: string) => {
        if (!confirm(`Are you sure you want to: ${action}?`)) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, secret, target_wallet })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`SUCCESS: ${data.message}`);
                fetchAdminData(); // Refresh
            } else {
                setStatus(`ERROR: ${data.error}`);
            }
        } catch (err) {
            setStatus('Connection Error');
        } finally {
            setIsLoading(false);
            setTimeout(() => setStatus(''), 5000);
        }
    };

    return (
        <main className="min-h-dvh bg-[#0a0a0a] text-white font-['var(--font-orbitron)'] p-8">
            <div className="max-w-[1200px] mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <div className="flex flex-col">
                        <Link href="/" className="text-[#14F195] text-[10px] font-black tracking-[4px] uppercase mb-4 opacity-50 hover:opacity-100 transition-opacity italic">
                            ← BACK TO FRONTEND
                        </Link>
                        <h1 className="text-4xl font-black tracking-[8px] uppercase text-white shadow-[#14F195]/20 drop-shadow-2xl">
                            CONTROL <span className="text-[#14F195]">CENTER</span>
                        </h1>
                    </div>
                    <WalletMultiButton />
                </div>

                {!isAdminWallet ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-12 text-center animate-pulse">
                        <h2 className="text-2xl font-black text-red-500 mb-4 tracking-[4px]">ACCESS DENIED</h2>
                        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed uppercase tracking-widest italic">
                            Strict encryption in place. Only the Mission Commander wallet can access this terminal.
                        </p>
                    </div>
                ) : !isAuth ? (
                    <div className="max-w-[400px] mx-auto bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl animate-zoom-in">
                        <h3 className="text-xs font-black text-[#FFD700] tracking-[4px] uppercase mb-6 text-center">AUTHENTICATION REQUIRED</h3>
                        <input
                            type="password"
                            placeholder="ADMIN SECRET KEY..."
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchAdminData()}
                            className="w-full h-14 bg-black/40 border-2 border-white/5 rounded-xl px-4 text-center text-white tracking-[4px] outline-none focus:border-[#14F195]/40 transition-all mb-6"
                        />
                        <button
                            onClick={fetchAdminData}
                            disabled={isLoading}
                            className="w-full h-14 bg-[#14F195] text-black font-black tracking-[6px] uppercase rounded-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isLoading ? 'DECRYPTING...' : 'LOGIN TO TERMINAL'}
                        </button>
                        {status && <p className="text-center text-red-400 text-[10px] font-black uppercase mt-4 animate-pulse tracking-widest">{status}</p>}
                    </div>
                ) : (
                    <div className="space-y-10 animate-fade-in">
                        {/* Stats Panel */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-2">
                                <span className="text-[9px] text-white/40 tracking-[3px] uppercase font-black">ACTIVE AGENTS</span>
                                <span className="text-4xl font-black text-[#14F195]">{stats?.totalPlayers}</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-2">
                                <span className="text-[9px] text-white/40 tracking-[3px] uppercase font-black">TOTAL OINKS COLL.</span>
                                <span className="text-4xl font-black text-[#FFD700]">{stats?.totalOinks.toLocaleString()}</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-2 relative group overflow-hidden">
                                <span className="text-[9px] text-white/40 tracking-[3px] uppercase font-black">GLOBAL HIGH SCORE</span>
                                <span className="text-4xl font-black text-white">{stats?.highestScore.toLocaleString()}</span>
                                <button
                                    onClick={() => handleAction('RESET_LEADERBOARD')}
                                    className="absolute bottom-4 right-4 bg-red-500/20 text-red-500 border border-red-500/30 px-3 py-1 rounded-full text-[8px] font-black opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest"
                                >
                                    RESET TABLE
                                </button>
                            </div>
                        </div>

                        {/* Player Table */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="px-8 py-6 border-b border-white/10 bg-white/2 flex justify-between items-center">
                                <h3 className="text-xs font-black tracking-[4px] uppercase text-white/60">PLAYER REGISTRY</h3>
                                {status && <span className="text-[9px] text-[#14F195] font-black animate-pulse uppercase tracking-[2px]">{status}</span>}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[11px] font-bold">
                                    <thead className="bg-white/3 text-white/30 uppercase tracking-[2px]">
                                        <tr>
                                            <th className="px-8 py-4">IDENTITY</th>
                                            <th className="px-4 py-4">DISTANCE</th>
                                            <th className="px-4 py-4">OINKS</th>
                                            <th className="px-4 py-4 text-right">OPERATIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {players.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-white/2 transition-colors group">
                                                <td className="px-8 py-4 flex flex-col gap-1">
                                                    <span className="text-white">{p.username || 'ANONYMOUS'}</span>
                                                    <span className="text-[8px] font-mono text-white/20 truncate max-w-[150px]">{p.wallet_address}</span>
                                                </td>
                                                <td className="px-4 py-4 text-[#14F195]">{p.high_score.toLocaleString()}</td>
                                                <td className="px-4 py-4 text-[#FFD700]">{p.oinks || 0}</td>
                                                <td className="px-4 py-4 text-right space-x-2">
                                                    <button
                                                        onClick={() => handleAction('RESET_SCORE', p.wallet_address)}
                                                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-white/40 hover:text-white transition-all uppercase text-[8px] font-black tracking-widest"
                                                    >
                                                        RESET SCORE
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction('DELETE_PLAYER', p.wallet_address)}
                                                        className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-500/60 hover:text-red-500 transition-all uppercase text-[8px] font-black tracking-widest"
                                                    >
                                                        BAN/DEL
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
