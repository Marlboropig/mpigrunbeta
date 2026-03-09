'use client';
// src/app/page.tsx
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const [text, setText] = useState('');
  const fullText = '> INITIALIZING MPIG TERMINAL...\n> LOADING SOLANA ASSETS...\n> AUTHENTICATION SUCCESSFUL.\n> READY TO BLAST.';

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 terminal-frame">
      <div className="scanline" />

      {/* Cinematic Logo Branding */}
      <div className="z-10 text-center space-y-12 max-w-2xl animate-fade-in">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex flex-col gap-1 items-end opacity-50">
              <div className="h-[2px] w-8 bg-[#14F195]" />
              <div className="h-[2px] w-6 bg-[#14F195]" />
            </div>
            <h1 className="text-[#FFD700] text-6xl md:text-8xl font-black italic tracking-tighter drop-shadow-[0_0_30px_#B8860B]">
              MPIG RUN
            </h1>
            <div className="flex flex-col gap-1 items-start opacity-50">
              <div className="h-[2px] w-8 bg-[#14F195]" />
              <div className="h-[2px] w-6 bg-[#14F195]" />
            </div>
          </div>
          <div className="bg-[#14F195]/10 border border-[#14F195]/30 px-4 py-1 rounded-full">
            <span className="text-[#14F195] text-[10px] font-black tracking-[5px] uppercase">Solana Ecosystem Native</span>
          </div>
        </div>

        {/* Console Terminal UI */}
        <div className="bg-black/80 border border-white/5 p-6 rounded-xl font-mono text-left w-full max-w-lg shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-[#14F195]/50 to-transparent" />
          <pre className="text-[#14F195] text-xs leading-relaxed whitespace-pre-wrap">
            {text}
            <span className="animate-pulse">_</span>
          </pre>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
          <Link
            href="/game"
            className="group relative px-12 py-5 bg-white overflow-hidden rounded-2xl transition-all hover:scale-105 active:scale-95 w-full sm:w-auto text-center shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
          >
            <div className="absolute inset-0 bg-linear-to-b from-yellow-300 via-amber-500 to-amber-600" />
            <span className="relative z-10 text-black font-black tracking-[5px] uppercase italic text-sm">LAUNCH MISSION</span>
          </Link>

          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <Link
              href="/profile"
              className="px-8 py-5 bg-white/5 border border-white/10 text-white font-black rounded-2xl w-full text-sm tracking-[3px] uppercase hover:bg-white/10 transition-colors text-center shadow-lg"
            >
              PROFILE
            </Link>
            <Link
              href="/leaderboard"
              className="px-8 py-5 bg-[#14F195]/10 border border-[#14F195]/20 text-[#14F195] font-black rounded-2xl w-full text-[10px] tracking-[4px] uppercase hover:bg-[#14F195]/20 transition-colors text-center"
            >
              HALL OF FAME
            </Link>
          </div>
        </div>

        <div className="pt-8 flex items-center justify-center space-x-12 opacity-30">
          <div className="flex flex-col items-center">
            <span className="text-[#14F195] font-black text-xl">HIGH</span>
            <span className="text-white/40 text-[9px] uppercase tracking-[4px]">Performance</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[#14F195] font-black text-xl">4K</span>
            <span className="text-white/40 text-[9px] uppercase tracking-[4px]">Assets</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[#14F195] font-black text-xl">SOL</span>
            <span className="text-white/40 text-[9px] uppercase tracking-[4px]">Chain</span>
          </div>
        </div>
      </div>

      <footer className="absolute bottom-8 text-[#14F195]/20 text-[9px] font-black tracking-[10px] uppercase">
        MPIG RUN TERMINAL v1.0.4
      </footer>
    </main>
  );
}
