// src/app/game/page.tsx
'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import PhaserGame with no SSR
const PhaserGame = dynamic(() => import('@/components/Game/PhaserGame'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center animate-pulse">
            <span className="text-[#14F195] font-black tracking-[10px] uppercase text-sm mb-4">INITIALIZING</span>
            <div className="w-48 h-[2px] bg-white/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#14F195] animate-[loading_2s_infinite]" />
            </div>
            <style jsx>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    )
});

export default function GamePage() {
    return (
        <main className="fixed-game-screen terminal-frame">
            <div className="scanline" />

            {/* The Game Container handles its own aspect ratio and centering internally now */}
            <div className="w-full h-full flex flex-col items-center justify-center relative z-10">
                <PhaserGame />
            </div>

            {/* Hidden navigation - only visible on hover or via specific touch area if needed */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity z-50">
                <Link
                    href="/"
                    className="text-[#14F195]/30 hover:text-[#14F195] text-[9px] font-black uppercase tracking-[5px] transition-all"
                >
                    Return to Terminal
                </Link>
            </div>
        </main>
    );
}
