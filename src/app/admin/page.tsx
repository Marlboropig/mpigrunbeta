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
    const [config, setConfig] = useState<any>(null);
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
                setConfig(data.config);
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

    const handleAction = async (action: string, extraData?: any) => {
        if (!confirm(`Confirm action: ${action}?`)) return;

        setIsLoading(true);
        try {
            const body = { action, secret, ...extraData };
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`SUCCESS: ${data.message || 'Updated'}`);
                fetchAdminData();
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

    const saveConfig = () => handleAction('UPDATE_CONFIG', { config });

    return (
        <main className="min-h-dvh bg-[#070707] text-white font-['var(--font-orbitron)'] p-4 md:p-12 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#14F195]/5 blur-[120px] rounded-full" />

            <div className="max-w-[1400px] mx-auto relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-white/5 pb-10">
                    <div>
                        <Link href="/" className="text-[#14F195] text-[10px] font-black tracking-[4px] uppercase mb-4 opacity-50 hover:opacity-100 transition-opacity italic flex items-center gap-2">
                            <span className="text-lg">←</span> COMMAND TERMINAL
                        </Link>
                        <h1 className="text-4xl md:text-5xl font-black tracking-[10px] uppercase text-white">
                            MISSION <span className="text-[#14F195] drop-shadow-[0_0_15px_rgba(20,241,149,0.4)]">CONTROL</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-full border ${isAdminWallet ? 'border-[#14F195]/40 text-[#14F195]' : 'border-red-500/40 text-red-500'} text-[10px] font-black tracking-widest uppercase bg-black/40 backdrop-blur-md`}>
                            {isAdminWallet ? 'COMMANDER DETECTED' : 'UNAUTHORIZED AGENT'}
                        </div>
                        <WalletMultiButton />
                    </div>
                </div>

                {!isAdminWallet ? (
                    <div className="min-h-[40vh] flex flex-col items-center justify-center bg-red-500/5 border border-red-500/10 rounded-3xl p-12 text-center">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <span className="text-4xl">⚠️</span>
                        </div>
                        <h2 className="text-3xl font-black text-red-500 mb-4 tracking-[6px] uppercase">ACCESS RESTRICTED</h2>
                        <p className="text-white/40 text-sm max-w-sm mx-auto leading-relaxed uppercase tracking-widest italic">
                            Only the pre-authorized Commander Wallet can initiate the Mission Control interface.
                        </p>
                    </div>
                ) : !isAuth ? (
                    <div className="max-w-[450px] mx-auto mt-20 bg-white/5 border border-white/10 p-10 rounded-4xl backdrop-blur-2xl shadow-2xl animate-zoom-in">
                        <div className="flex flex-col items-center gap-2 mb-10">
                            <h3 className="text-sm font-black text-[#FFD700] tracking-[5px] uppercase">ENCRYPTION KEY</h3>
                            <div className="h-1 w-20 bg-[#FFD700]/20 rounded-full" />
                        </div>
                        <input
                            type="password"
                            placeholder="ADMIN SECRET PHRASE..."
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchAdminData()}
                            className="w-full h-16 bg-black/60 border-2 border-white/5 rounded-2xl px-6 text-center text-white text-lg tracking-[8px] outline-none focus:border-[#14F195]/40 transition-all mb-8 shadow-inner"
                        />
                        <button
                            onClick={fetchAdminData}
                            disabled={isLoading}
                            className="w-full h-16 bg-linear-to-r from-[#14F195] to-[#9945FF] text-white font-black tracking-[8px] uppercase rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_15px_40px_rgba(20,241,149,0.2)] disabled:opacity-50"
                        >
                            {isLoading ? 'DECRYPTING...' : 'INITIATE TERMINAL'}
                        </button>
                        {status && <p className="text-center text-red-400 text-[10px] font-black uppercase mt-6 animate-pulse tracking-widest">{status}</p>}
                    </div>
                ) : (
                    <div className="space-y-12 animate-fade-in pb-20">

                        {/* 1. Global Mission Toggles & Announcement */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Maintenance & Announcement */}
                            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-xs font-black tracking-[4px] uppercase text-[#14F195]">MISSION STATUS & PUBLIC BROADCAST</h2>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-black tracking-[2px] uppercase opacity-40">MAINTENANCE MODE</span>
                                        <button
                                            onClick={() => setConfig({ ...config, maintenance_mode: !config.maintenance_mode })}
                                            className={`w-14 h-8 rounded-full relative transition-all ${config.maintenance_mode ? 'bg-red-500' : 'bg-white/10'}`}
                                        >
                                            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${config.maintenance_mode ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[9px] font-black text-white/40 tracking-[3px] uppercase ml-1">GLOBAL ANNOUNCEMENT MESSAGE</label>
                                    <textarea
                                        value={config.announcement_text}
                                        onChange={(e) => setConfig({ ...config, announcement_text: e.target.value.toUpperCase() })}
                                        className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-6 text-white font-bold tracking-widest focus:border-[#14F195]/40 outline-none resize-none"
                                        placeholder="TYPE BROADCAST MESSAGE..."
                                    />
                                    <div className="flex justify-end gap-4 mt-4">
                                        <button
                                            onClick={saveConfig}
                                            className="px-8 py-4 bg-[#14F195] text-black font-black text-[10px] tracking-[4px] uppercase rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                                        >
                                            BROADCAST UPDATES
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Live Tuning */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
                                <h2 className="text-xs font-black tracking-[4px] uppercase text-[#FFD700] mb-8">ENGINE TUNING</h2>
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[9px] font-black tracking-[2px] uppercase">
                                            <span>SPEED MULTIPLIER</span>
                                            <span className="text-[#14F195]">{config.base_speed_multiplier}X</span>
                                        </div>
                                        <input
                                            type="range" min="0.5" max="3" step="0.1"
                                            value={config.base_speed_multiplier}
                                            onChange={(e) => setConfig({ ...config, base_speed_multiplier: parseFloat(e.target.value) })}
                                            className="w-full accent-[#14F195]"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[9px] font-black tracking-[2px] uppercase">
                                            <span>OINK MULTIPLIER</span>
                                            <span className="text-[#FFD700]">{config.oink_multiplier}X</span>
                                        </div>
                                        <input
                                            type="range" min="1" max="10" step="1"
                                            value={config.oink_multiplier}
                                            onChange={(e) => setConfig({ ...config, oink_multiplier: parseInt(e.target.value) })}
                                            className="w-full accent-[#FFD700]"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[9px] font-black tracking-[2px] uppercase">
                                            <span>OBSTACLE FREQUENCY</span>
                                            <span className="text-white">{config.obstacle_spawn_rate}X</span>
                                        </div>
                                        <input
                                            type="range" min="0.5" max="2" step="0.1"
                                            value={config.obstacle_spawn_rate}
                                            onChange={(e) => setConfig({ ...config, obstacle_spawn_rate: parseFloat(e.target.value) })}
                                            className="w-full accent-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Stats & Quick Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white/2 border border-white/5 p-6 rounded-2xl flex flex-col gap-1">
                                <span className="text-[8px] text-white/30 tracking-[3px] uppercase font-black">AGENTS</span>
                                <span className="text-3xl font-black text-white">{stats?.totalPlayers}</span>
                            </div>
                            <div className="bg-white/2 border border-white/5 p-6 rounded-2xl flex flex-col gap-1">
                                <span className="text-[8px] text-white/30 tracking-[3px] uppercase font-black">TOTAL OINKS</span>
                                <span className="text-3xl font-black text-[#FFD700]">{stats?.totalOinks.toLocaleString()}</span>
                            </div>
                            <div className="bg-white/2 border border-white/5 p-6 rounded-2xl flex flex-col gap-1">
                                <span className="text-[8px] text-white/30 tracking-[3px] uppercase font-black">GLOBAL RECORD</span>
                                <span className="text-3xl font-black text-[#14F195]">{stats?.highestScore.toLocaleString()}</span>
                            </div>
                            <button
                                onClick={() => handleAction('START_NEW_SEASON')}
                                className="bg-linear-to-r from-red-600 to-amber-600 rounded-2xl p-6 flex flex-col items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition-all shadow-xl"
                            >
                                <span className="text-[8px] text-white/60 tracking-[4px] uppercase font-black">DANGER ZONE</span>
                                <span className="text-sm font-black text-white tracking-[2px] uppercase">RESET SEASON</span>
                            </button>
                        </div>

                        {/* 3. Player Registry & Warden Panel */}
                        <div className="bg-white/5 border border-white/10 rounded-4xl overflow-hidden shadow-2xl backdrop-blur-xl">
                            <div className="px-10 py-8 border-b border-white/10 bg-white/2 flex justify-between items-center">
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-xs font-black tracking-[5px] uppercase text-[#14F195]">AGENT REGISTRY</h3>
                                    <p className="text-[8px] text-white/20 tracking-[2px] uppercase">MANAGE IDENTITIES AND ANTI-CHEAT PROTOCOLS</p>
                                </div>
                                {status && <span className="bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/20 px-4 py-2 rounded-full text-[9px] font-black animate-pulse uppercase tracking-[3px]">{status}</span>}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[11px] font-bold">
                                    <thead className="bg-black/40 text-white/30 uppercase tracking-[3px] border-b border-white/5">
                                        <tr>
                                            <th className="px-10 py-6">AGENT IDENTITY</th>
                                            <th className="px-6 py-6 font-black">DISTANCE</th>
                                            <th className="px-6 py-6 font-black">OINKS</th>
                                            <th className="px-6 py-6 font-black">ID VERIFIED</th>
                                            <th className="px-10 py-6 text-right">OPERATIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 bg-black/20">
                                        {players.map((p, idx) => (
                                            <tr key={idx} className={`hover:bg-white/2 transition-all group ${p.is_banned ? 'opacity-30 grayscale saturate-0' : ''}`}>
                                                <td className="px-10 py-6">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-sm font-black tracking-widest ${p.is_verified ? 'text-[#14F195]' : 'text-white'}`}>
                                                            {p.username || 'ANONYMOUS'}
                                                            {p.is_verified && <span className="ml-2 text-[8px] bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/40 px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">VERIFIED</span>}
                                                        </span>
                                                        <span className="text-[9px] font-mono text-white/20 truncate max-w-[200px]">{p.wallet_address}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 italic text-sm">{p.high_score.toLocaleString()}</td>
                                                <td className="px-6 py-6 text-[#FFD700]">{p.oinks || 0}</td>
                                                <td className="px-6 py-6">
                                                    <button
                                                        onClick={() => handleAction('TOGGLE_VERIFIED', { target_wallet: p.wallet_address })}
                                                        className={`w-4 h-4 rounded-sm border transition-all ${p.is_verified ? 'bg-[#14F195] border-[#14F195]' : 'bg-transparent border-white/20'}`}
                                                    />
                                                </td>
                                                <td className="px-10 py-6 text-right space-x-3">
                                                    <button
                                                        onClick={() => handleAction('RESET_SCORE', { target_wallet: p.wallet_address })}
                                                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white transition-all uppercase text-[8px] font-black tracking-widest"
                                                    >
                                                        RESET
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction('TOGGLE_BAN', { target_wallet: p.wallet_address })}
                                                        className={`px-3 py-2 border rounded-lg transition-all uppercase text-[8px] font-black tracking-widest ${p.is_banned ? 'bg-red-500 text-white border-red-500' : 'bg-red-500/10 text-red-500/60 border-red-500/20 hover:text-red-500'}`}
                                                    >
                                                        {p.is_banned ? 'UNBAN' : 'BAN'}
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
