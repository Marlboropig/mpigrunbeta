'use client';
// src/components/Game/PhaserGame.tsx
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

    const handleActionInPhaser = () => {
        if (gameRef.current) {
            gameRef.current.events.emit('request-action');
        }
    };

    const handleShare = async () => {
        const shareText = `I just scored ${score} in MPIG RUN 🐷🔥\nThink you can beat my score?\n\n$MPIG`;
        const shareUrl = "https://mpigg.xyz";

        try {
            // Try modern mobile sharing first (supports attaching files)
            if (navigator.share && navigator.canShare) {
                const response = await fetch('/assets/x-post.png');
                const blob = await response.blob();
                const file = new File([blob], 'mpig-run.png', { type: 'image/png' });

                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'MPIG RUN',
                        text: `${shareText}\n\nPlay: ${shareUrl}`,
                    });
                    return;
                }
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }

        // Fallback for desktop or unsupported browsers (Twitter Intent)
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twitterUrl, '_blank');
    };

    return (
        <div className="relative w-full h-dvh flex items-center justify-center overflow-hidden bg-black">
            {/* The Actual Canvas Wrapper */}
            <div ref={gameContainerRef} className="w-full h-full max-w-[450px] max-h-[800px] shadow-[0_0_100px_rgba(20,241,149,0.1)] relative overflow-hidden md:rounded-3xl md:border md:border-white/5" id="game-container">

                {/* Main HUD Overlay - Contained inside the aspect ratio box */}
                <div className="absolute inset-0 pointer-events-none flex flex-col font-['var(--font-orbitron)'] z-10">

                    {/* Top HUD - Mobile Optimized */}
                    <header className="px-4 py-2 pt-[calc(env(safe-area-inset-top,0px)+1rem)] flex items-start justify-between w-full pointer-events-auto">
                        {/* Score & Oinks Top-Left */}
                        <div className="flex flex-col gap-2">
                            <div className="bg-black/80 backdrop-blur-md border border-[#FFD700]/30 rounded-xl px-4 py-2 shadow-[0_0_20px_rgba(255,215,0,0.1)]">
                                <span className="text-[7px] text-[#FFD700] font-black tracking-[3px] uppercase block mb-0.5">DISTANCE</span>
                                <span className="text-xl font-black text-white tabular-nums tracking-widest leading-none">{score.toString().padStart(5, '0')}</span>
                            </div>
                            <div className="bg-black/60 backdrop-blur-sm border border-[#14F195]/20 rounded-lg px-3 py-1 flex items-center gap-2 self-start">
                                <span className="text-[7px] text-[#14F195] font-black tracking-[2px] uppercase opacity-60">OINKS</span>
                                <span className="text-sm font-black text-[#14F195] tabular-nums leading-none">{oinks}</span>
                            </div>
                        </div>

                        {/* Community Record Center */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 whitespace-nowrap">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
                                <span className="text-[8px] font-black uppercase tracking-[2px] text-white/60">
                                    Community Record: <span className="text-[#FFD700]">120</span>
                                </span>
                            </div>
                        </div>

                        {/* Pause Button Top-Right */}
                        <div className="flex flex-col items-end gap-2">
                            <button
                                onClick={togglePause}
                                className="bg-black/80 p-3 rounded-xl border border-white/10 text-white hover:bg-white/10 active:scale-90 transition-all shadow-lg"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    {isPaused ? <path d="M8 5v14l11-7z" /> : <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />}
                                </svg>
                            </button>
                            <div className="bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md border border-white/5 opacity-40">
                                <span className="text-[6px] text-white font-bold tracking-[2px] uppercase">BEST: {highScore}</span>
                            </div>
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
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-100 flex items-center justify-center p-6 animate-fade-in font-['var(--font-orbitron)'] pointer-events-auto">
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
                    <div className="absolute inset-0 z-150 font-['var(--font-orbitron)'] pointer-events-auto">
                        <img
                            src="/assets/front cover.webp"
                            className="absolute inset-0 w-full h-full object-cover"
                            alt="Front Cover"
                        />
                        {/* Interactive Area at the bottom */}
                        <div className="absolute inset-x-0 bottom-0 pb-20 pt-10 bg-linear-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-end px-6">
                            <div className="animate-fade-in text-center flex flex-col items-center w-full max-w-[320px]">
                                <button
                                    onClick={() => handleActionInPhaser()}
                                    className="pill-button-gold w-full h-16 text-lg font-black tracking-[8px] hover:scale-[1.05] transition-all active:scale-95 shadow-[0_10px_40px_rgba(212,175,55,0.4)] border-2 border-[#FFE44D]/30"
                                >
                                    TAP TO START
                                </button>

                                <div className="mt-4 animate-pulse flex flex-col items-center">
                                    <span className="text-[10px] text-[#14F195] font-black tracking-[4px] uppercase">TAP TO JUMP</span>
                                    <span className="text-[7px] text-white/40 uppercase tracking-[2px]">AVOID THE RED CANDLES</span>
                                </div>

                                <div className="flex flex-col gap-1 items-center mt-6 opacity-80">
                                    <p className="text-[#14F195] text-[10px] font-black uppercase tracking-[6px] drop-shadow-[0_0_10px_rgba(20,241,149,0.5)]">DODGE THE CANDLES</p>
                                    <p className="text-[#FFD700] text-[8px] font-black uppercase tracking-[4px]">STACK $MPIG</p>
                                </div>

                                <div className="mt-8 py-2 px-4 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm group cursor-pointer active:scale-95 transition-all"
                                    onClick={() => {
                                        navigator.clipboard.writeText("Ff7F96e7HntW5D9QH2bwDHPYZesF2gx7ACipSxxtpump");
                                        alert("CA Copied!");
                                    }}>
                                    <p className="text-white/40 text-[7px] uppercase tracking-[2px] font-black group-hover:text-white transition-colors">
                                        CA: Ff7...pump <span className="ml-2 text-[#14F195]">COPY</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Game Over UI */}
                {gameState === GameState.GAME_OVER && (
                    <div className="absolute inset-0 z-200 animate-fade-in font-['var(--font-orbitron)'] pointer-events-auto overflow-hidden">
                        <img
                            src="/assets/game over.webp"
                            className="absolute inset-0 w-full h-full object-cover"
                            alt="Game Over"
                        />

                        {/* Stats & Actions at the bottom to let the "YOU GOT REKT" art shine */}
                        <div className="absolute inset-x-0 bottom-0 pb-16 pt-20 bg-linear-to-t from-black/90 via-black/60 to-transparent flex flex-col items-center px-6">

                            {/* Score Display */}
                            <div className="flex gap-4 mb-8 animate-zoom-in">
                                <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col items-center min-w-[100px]">
                                    <span className="text-[8px] uppercase tracking-widest text-white/40 mb-1">DISTANCE</span>
                                    <span className="text-3xl font-black tabular-nums text-white">{score}</span>
                                </div>
                                <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-[#FFD700]/20 flex flex-col items-center min-w-[100px]">
                                    <span className="text-[8px] uppercase tracking-widest text-[#FFD700]/60 mb-1">BEST</span>
                                    <span className="text-3xl font-black tabular-nums text-[#FFD700]">{highScore}</span>
                                </div>
                            </div>

                            <div className="w-full max-w-[320px] animate-slide-in-up">
                                <div className="w-full bg-[#14F195]/10 rounded-2xl py-3 px-4 mb-6 border border-[#14F195]/20 backdrop-blur-sm flex justify-between items-center">
                                    <span className="text-[9px] uppercase tracking-[3px] text-[#14F195] font-black">TOTAL OINKS</span>
                                    <span className="text-2xl font-black text-[#14F195] drop-shadow-[0_0_10px_rgba(20,241,149,0.3)]">{oinks}</span>
                                </div>

                                <div className="flex flex-col w-full gap-3">
                                    <button
                                        onClick={handleRestart}
                                        className="pill-button-gold w-full h-14 text-sm font-black tracking-[6px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                                    >
                                        RE-TRY
                                    </button>
                                    <button
                                        onClick={handleShare}
                                        className="w-full h-12 rounded-full font-black text-xs tracking-[4px] bg-[#1d9bf0] text-white hover:bg-[#1a8cd8] active:scale-95 flex items-center justify-center gap-3 transition-all"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                        </svg>
                                        SHARE TO X
                                    </button>

                                    <Link
                                        href="/"
                                        className="mt-6 text-white/20 hover:text-white text-[9px] uppercase font-black tracking-[5px] text-center transition-all"
                                    >
                                        QUIT SESSION
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}