'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function GlobalLeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/leaderboard?limit=50')
            .then(res => res.json())
            .then(data => {
                if (data.leaderboard) setLeaderboard(data.leaderboard);
                setIsLoading(false);
            });
    }, []);

    return (
        <main className="min-h-dvh bg-black flex flex-col items-center p-6 font-['var(--font-orbitron)'] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,241,149,0.05)_0%,transparent_70%)]" />

            <div className="w-full max-w-[600px] mt-20 mb-10 text-center animate-fade-in px-4">
                <Link href="/" className="text-[#9945FF] text-[10px] font-black tracking-[4px] uppercase mb-10 inline-block hover:opacity-70 transition-opacity italic">
                    ← RETURN TO MISSION
                </Link>
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-[12px] uppercase mb-4 drop-shadow-[0_0_20px_rgba(20,241,149,0.3)]">HALL OF FAME</h1>
                <p className="text-[#14F195] text-xs font-black tracking-[6px] uppercase italic opacity-60">TOP 50 GLOBAL DISTANCE REACHED</p>
                <div className="w-32 h-1.5 bg-linear-to-r from-transparent via-[#14F195]/40 to-transparent mx-auto mt-6 rounded-full" />
            </div>

            <div className="w-full max-w-[600px] bg-white/5 border border-white/10 backdrop-blur-2xl rounded-3xl overflow-hidden relative shadow-[0_30px_100px_rgba(0,0,0,0.5)] animate-slide-in-up">
                <div className="flex bg-white/5 px-6 py-4 border-b border-white/10 text-[10px] font-black text-white/40 tracking-[4px] uppercase">
                    <span className="w-12">RANK</span>
                    <span className="flex-1">IDENTITY</span>
                    <span className="w-24 text-right">DISTANCE</span>
                </div>

                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="p-20 flex flex-col items-center gap-4">
                            <div className="w-8 h-8 border-4 border-[#14F195]/20 border-t-[#14F195] rounded-full animate-spin" />
                            <span className="text-[10px] font-black text-[#14F195] tracking-[4px] uppercase animate-pulse">SYNCING DATA...</span>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="p-20 text-center">
                            <span className="text-[10px] font-black text-white/20 tracking-[4px] uppercase italic">NO MISSION DATA YET</span>
                        </div>
                    ) : (
                        leaderboard.map((entry, idx) => (
                            <div key={idx} className={`flex px-6 py-5 border-b border-white/5 items-center hover:bg-white/2 transition-colors ${idx < 3 ? 'bg-white/3' : ''}`}>
                                <span className={`w-12 text-sm font-black italic ${idx === 0 ? 'text-[#FFD700]' : idx === 1 ? 'text-[#C0C0C0]' : idx === 2 ? 'text-[#CD7F32]' : 'text-white/40'}`}>
                                    #{idx + 1}
                                </span>
                                <div className="flex-1 flex flex-col gap-1 overflow-hidden pr-4">
                                    <span className={`text-xs font-black tracking-widest truncate ${idx < 3 ? 'text-white text-sm' : 'text-white/80'}`}>
                                        {entry.username || (entry.wallet_address.slice(0, 6) + '...' + entry.wallet_address.slice(-4))}
                                    </span>
                                    {entry.username && (
                                        <span className="text-[8px] font-mono text-white/20 truncate">{entry.wallet_address}</span>
                                    )}
                                </div>
                                <span className={`w-24 text-right font-black tabular-nums tracking-widest text-[#14F195] ${idx < 3 ? 'text-lg' : 'text-sm'}`}>
                                    {entry.high_score.toLocaleString()}
                                </span>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 bg-white/2 border-t border-white/5 text-center">
                    <p className="text-[8px] text-white/20 font-black uppercase tracking-[3px] leading-relaxed">
                        PLAY THE GAME TO CLAIM YOUR RANK IN THE HALL OF FAME. CONNECT YOUR WALLET TO SET YOUR USERNAME.
                    </p>
                </div>
            </div>
        </main>
    );
}
