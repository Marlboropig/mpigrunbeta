// src/components/Game/PhaserGame.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { GameConfig } from '@/game/config';
import { MainScene, GameState } from '@/game/scenes/MainScene';
import Link from 'next/link';

export default function PhaserGame() {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    // UI State
    const [score, setScore] = useState(0);
    const [oinks, setOinks] = useState(0);
    const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
    const [highScore, setHighScore] = useState(0);
    const [levelTheme, setLevelTheme] = useState('Neon');
    const [isPaused, setIsPaused] = useState(false);

    // Settings
    const [soundOn, setSoundOn] = useState(true);
    const [musicOn, setMusicOn] = useState(true);

    useEffect(() => {
        const storedHighScore = localStorage.getItem('mpig-highscore');
        if (storedHighScore) setHighScore(parseInt(storedHighScore));

        async function initPhaser() {
            const Phaser = (await import('phaser')).default;

            if (!gameRef.current && gameContainerRef.current) {
                const game = new Phaser.Game({
                    ...GameConfig,
                    parent: gameContainerRef.current,
                    scale: {
                        mode: Phaser.Scale.FIT,
                        autoCenter: Phaser.Scale.CENTER_BOTH,
                        width: 450,
                        height: 800
                    }
                });
                gameRef.current = game;

                game.events.on('game-init', () => {
                    setGameState(GameState.IDLE);
                    setIsPaused(false);
                });

                game.events.on('score-update', (newScore: number) => setScore(newScore));
                game.events.on('oinks-update', (newOinks: number) => setOinks(newOinks));
                game.events.on('ui-pause-state', (paused: boolean) => setIsPaused(paused));

                game.events.on('game-start', () => {
                    setGameState(GameState.PLAYING);
                    setIsPaused(false);
                    setScore(0);
                    setOinks(0);
                    const currentHigh = parseInt(localStorage.getItem('mpig-highscore') || '0');
                    setHighScore(currentHigh);
                });

                game.events.on('game-over', (finalScore: number) => {
                    setGameState(GameState.GAME_OVER);
                    setIsPaused(false);
                    const currentHigh = parseInt(localStorage.getItem('mpig-highscore') || '0');
                    if (finalScore > currentHigh) {
                        setHighScore(finalScore);
                        localStorage.setItem('mpig-highscore', finalScore.toString());
                    }
                });

                game.events.on('level-up', (theme: string) => setLevelTheme(theme));
            }
        }

        initPhaser();

        return () => {
            if (gameRef.current) {
                gameRef.current.events.off('game-init');
                gameRef.current.events.off('score-update');
                gameRef.current.events.off('oinks-update');
                gameRef.current.events.off('ui-pause-state');
                gameRef.current.events.off('game-start');
                gameRef.current.events.off('game-over');
                gameRef.current.events.off('level-up');
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    const togglePause = () => {
        if (gameRef.current) {
            gameRef.current.events.emit('request-pause');
        }
    };

    const handleRestart = () => {
        if (gameRef.current) {
            gameRef.current.events.emit('request-restart');
            setIsPaused(false);
        }
    };

    const toggleSound = () => {
        const next = !soundOn;
        setSoundOn(next);
        if (gameRef.current) gameRef.current.events.emit('toggle-sound', next);
    };

    const toggleMusic = () => {
        const next = !musicOn;
        setMusicOn(next);
        if (gameRef.current) gameRef.current.events.emit('toggle-music', next);
    };

    return (
        <div className="relative w-full h-dvh flex items-center justify-center overflow-hidden bg-black">
            {/* The Actual Canvas Wrapper */}
            <div ref={gameContainerRef} className="w-full h-full max-w-[450px] max-h-[800px] shadow-[0_0_100px_rgba(20,241,149,0.1)] relative overflow-hidden md:rounded-3xl md:border md:border-white/5" id="game-container">

                {/* Main HUD Overlay - Contained inside the aspect ratio box */}
                <div className="absolute inset-0 pointer-events-none flex flex-col font-['var(--font-orbitron)'] z-10">

                    {/* Top HUD */}
                    <header className="p-4 flex items-center justify-between w-full pointer-events-auto">
                        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
                            <img src="/assets/mpig.png" className="w-5 h-5 object-contain" alt="mpig" />
                            <span className="text-[9px] uppercase font-black text-white tracking-[2px] hidden xs:inline">MPIG RUN</span>
                        </div>

                        <div className="flex flex-col items-center">
                            <span className="text-[8px] text-[#14F195] font-black tracking-[4px] uppercase mb-1 drop-shadow-[0_0_10px_#14F195]">Oinks</span>
                            <div className="bg-black/90 border border-[#14F195]/20 rounded-2xl px-4 py-1.5 flex items-center gap-2 shadow-[0_0_20px_rgba(20,241,149,0.1)]">
                                <span className="text-xl font-black text-white tabular-nums tracking-widest leading-none">{oinks.toString().padStart(5, '0')}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={togglePause}
                                className="bg-black/80 p-2 rounded-lg border border-white/10 text-white hover:bg-white/10 active:scale-90 transition-all"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    {isPaused ? <path d="M8 5v14l11-7z" /> : <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />}
                                </svg>
                            </button>
                        </div>
                    </header>

                    {/* Zone Info */}
                    {gameState === GameState.PLAYING && !isPaused && (
                        <div className="mt-2 flex flex-col items-center gap-1 animate-fade-in">
                            <div className="bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
                                <span className="text-[7px] uppercase tracking-[3px] text-white/40 font-black">ZONE:</span>
                                <span className={`text-[8px] uppercase tracking-[4px] font-black ${levelTheme === 'Chaos' ? 'text-red-500' : 'text-[#14F195]'}`}>
                                    {levelTheme}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modals - All contained within the game area */}

                {/* Pause Modal */}
                {isPaused && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in font-['var(--font-orbitron)'] pointer-events-auto">
                        <div className="w-full max-w-[320px] bg-black/80 border border-[#FFD700]/30 rounded-2xl p-6 relative shadow-2xl animate-zoom-in">
                            <div className="absolute inset-1 border border-[#FFD700]/5 rounded-xl pointer-events-none" />
                            <div className="text-center mb-6">
                                <h2 className="text-[#FFD700] text-sm font-bold tracking-[8px] uppercase">PAUSED</h2>
                                <div className="w-full h-px gold-glow-line mt-3 opacity-30" />
                            </div>
                            <div className="flex flex-col gap-4">
                                <button onClick={togglePause} className="hex-button w-full h-12 bg-[#14F195]/10 green-glow-border flex items-center justify-center">
                                    <span className="text-[#14F195] font-black text-xs tracking-[4px] uppercase italic">RESUME</span>
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={toggleMusic} className={`hex-button h-10 text-[8px] font-black uppercase tracking-widest transition-all ${musicOn ? 'bg-[#FFD700]/10 gold-glow-border text-[#FFD700]' : 'bg-black text-white/20 border border-white/5'}`}>
                                        MUSIC {musicOn ? 'ON' : 'OFF'}
                                    </button>
                                    <button onClick={toggleSound} className={`hex-button h-10 text-[8px] font-black uppercase tracking-widest transition-all ${soundOn ? 'bg-[#FFD700]/10 gold-glow-border text-[#FFD700]' : 'bg-black text-white/20 border border-white/5'}`}>
                                        SFX {soundOn ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                                <button onClick={handleRestart} className="hex-button w-full h-12 bg-[#FFD700]/5 gold-glow-border flex items-center justify-center">
                                    <span className="text-[#FFD700] font-black text-[10px] tracking-[4px] uppercase italic">RESTART</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Start UI */}
                {gameState === GameState.IDLE && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 font-['var(--font-orbitron)']">
                        <div className="animate-pulse text-center space-y-4">
                            <h2 className="text-white text-4xl font-black tracking-tighter uppercase italic">TAP TO BLAST</h2>
                            <p className="text-[#14F195] text-[9px] font-black uppercase tracking-[8px] drop-shadow-[0_0_10px_#14F195]">STACK SOLANA</p>
                        </div>
                    </div>
                )}

                {/* Game Over UI */}
                {gameState === GameState.GAME_OVER && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[200] animate-fade-in font-['var(--font-orbitron)'] p-6 pointer-events-auto">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="h-px w-6 bg-[#14F195]" />
                            <h1 className="text-[#FFD700] text-3xl font-black italic tracking-tighter drop-shadow-[0_0_20px_#B8860B]">MPIG RUN</h1>
                            <div className="h-px w-6 bg-[#14F195]" />
                        </div>
                        <div className="rekt-glass w-full p-8 flex flex-col items-center text-center animate-zoom-in max-w-[320px]">
                            <h2 className="text-[#FFD700] text-lg font-black uppercase tracking-[5px] mb-6">YOU GOT REKT 🔥</h2>
                            <div className="text-white text-2xl font-bold mb-8 flex items-baseline gap-2">
                                <span className="text-[10px] uppercase tracking-widest opacity-40 text-white">Score:</span>
                                <span className="text-4xl tabular-nums">{oinks}</span>
                            </div>
                            <div className="flex flex-col w-full gap-3">
                                <button onClick={handleRestart} className="pill-button-gold w-full h-12 text-xs tracking-[4px]">PLAY AGAIN</button>
                                <button className="pill-button-outline-green w-full h-12 text-[9px] tracking-[3px]">Share Achievement</button>
                                <Link href="/" className="mt-4 text-white/20 hover:text-white text-[8px] uppercase font-black tracking-[4px] transition-all">Exit Session</Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}