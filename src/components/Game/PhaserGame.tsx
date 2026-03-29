'use client';
// src/components/Game/PhaserGame.tsx
import { useEffect, useRef, useState } from 'react';
import { GameConfig } from '@/game/config';
import { MainScene, GameState } from '@/game/scenes/MainScene';
import Link from 'next/link';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { 
    WalletMultiButton,
    useWalletModal 
} from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';
import { 
    createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import { 
    Transaction, 
    PublicKey, 
    SystemProgram, 
    LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { getSolPriceInUSD, usdToSol } from '@/lib/price';

// Base style for wallet button overrides
const WALLET_STYLES = {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    borderRadius: '12px',
    fontSize: '10px',
    height: '40px',
    fontFamily: 'var(--font-orbitron)',
    textTransform: 'uppercase',
    color: '#FFD700',
    letterSpacing: '2px',
    fontWeight: '900',
    padding: '0 20px',
    width: '100%'
};

export default function PhaserGame() {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const { publicKey, connected, signMessage, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();

    // Auth & Payment State
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [isSigning, setIsSigning] = useState(false);
    const [hasPaid, setHasPaid] = useState(false);
    const [isPaying, setIsPaying] = useState(false);

    // Skin & Inventory State
    const [isSkinShopOpen, setIsSkinShopOpen] = useState(false);
    const [shopSkins, setShopSkins] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [selectedSkin, setSelectedSkin] = useState<any>(null);

    // Load saved skin on mount
    useEffect(() => {
        const saved = localStorage.getItem('mpig-equipped-skin');
        if (saved) {
            try {
                setSelectedSkin(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved skin");
            }
        }
    }, []);

    const handleEquipSkin = async (skin: any) => {
        if (publicKey) {
            await fetch('/api/skins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'EQUIP', 
                    skin_id: skin.id, 
                    wallet_address: publicKey.toBase58() 
                })
            });
        }
        
        setSelectedSkin(skin);
        localStorage.setItem('mpig-equipped-skin', JSON.stringify(skin));
        
        // Also tell Phaser immediately if game is initialized
        if (gameRef.current) {
            gameRef.current.events.emit('request-start-mission', { 
                skinUrl: skin.image_url,
                autoStart: false
            });
        }
    };

    // UI State
    const [score, setScore] = useState(0);
    const [oinks, setOinks] = useState(0);
    const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
    const [highScore, setHighScore] = useState(0);
    const [levelTheme, setLevelTheme] = useState('Neon');
    const [isPaused, setIsPaused] = useState(false);
    const [status, setStatus] = useState('');

    // Settings
    const [soundOn, setSoundOn] = useState(true);
    const [musicOn, setMusicOn] = useState(true);
    const [globalLeaderboard, setGlobalLeaderboard] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [playerRank, setPlayerRank] = useState<number | null>(null);
    const [config, setConfig] = useState<any>(null);
    const [isBanned, setIsBanned] = useState(false);

    // Tournament State
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [activeTournament, setActiveTournament] = useState<string>('00000000-0000-0000-0000-000000000000');

    // Use Refs to provide "live" access to state inside Phaser listeners (fixes stale closure bug)
    const walletRef = useRef({ publicKey, connected });
    const authRef = useRef(authToken);
    const tournamentRef = useRef(activeTournament);
    const bannedRef = useRef(isBanned);

    useEffect(() => {
        walletRef.current = { publicKey, connected };
        authRef.current = authToken;
        tournamentRef.current = activeTournament;
        bannedRef.current = isBanned;
    }, [publicKey, connected, authToken, activeTournament, isBanned]);

    useEffect(() => {
        const storedHighScore = localStorage.getItem('mpig-highscore');
        if (storedHighScore) setHighScore(parseInt(storedHighScore));

        const storedToken = localStorage.getItem('mpig-auth-token');
        if (storedToken) setAuthToken(storedToken);

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

                game.events.on('game-over', async (data: { score: number, oinks: number }) => {
                    // Check live ban status
                    if (bannedRef.current) return;

                    setGameState(GameState.GAME_OVER);
                    setIsPaused(false);

                    const finalScore = data.score;
                    const finalOinks = data.oinks;

                    // Local highscore update
                    const currentHigh = parseInt(localStorage.getItem('mpig-highscore') || '0');
                    if (finalScore > currentHigh) {
                        setHighScore(finalScore);
                        localStorage.setItem('mpig-highscore', finalScore.toString());
                    }

                    // Global sync if connected using live Refs
                    const currentWallet = walletRef.current;
                    if (currentWallet.connected && currentWallet.publicKey) {
                        await submitScore(currentWallet.publicKey.toBase58(), finalScore, finalOinks);
                        // Explicitly FORCE a new leaderboard fetch to update Global Rank UI
                        await fetchLeaderboard(tournamentRef.current);
                    }
                });
            }
        }

        initPhaser();
        fetchLeaderboard();
        fetchConfig();
        
        // Fetch Tournaments
        const fetchTournaments = async () => {
            const res = await fetch('/api/tournaments');
            if (res.ok) {
                const data = await res.json();
                setTournaments(data.filter((t: any) => t.is_active));
            }
        };
        fetchTournaments();

        // Fetch Skins
        const fetchSkins = async () => {
            const res = await fetch('/api/skins');
            if (res.ok) setShopSkins(await res.json());
        };
        fetchSkins();
        
        const fetchMyStats = async () => {
            if (publicKey) {
                const tourId = activeTournament || '00000000-0000-0000-0000-000000000000';
                const res = await fetch(`/api/leaderboard?address=${publicKey.toBase58()}&tournament_id=${tourId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.rank !== null && data.leaderboard) {
                        // Find this player's data in the results or just trust the rank fetch data
                        // The API returns 'rank' and 'has_paid' directly now
                        const myEntry = data.leaderboard.find((p: any) => p.wallet_address === publicKey.toBase58());
                        if (myEntry) {
                            setHighScore(myEntry.high_score || 0);
                            localStorage.setItem('mpig-highscore', (myEntry.high_score || 0).toString());
                        }
                    }
                    if (data.has_paid !== undefined) setHasPaid(data.has_paid);
                }
            }
        };

        const fetchMyInventory = async () => {
            if (publicKey) {
                const res = await fetch(`/api/skins?action=INVENTORY&address=${publicKey.toBase58()}`);
                if (res.ok) {
                    const data = await res.json();
                    // Always ensure default skin is in inventory
                    if (!data.some((s: any) => s.id === '00000000-0000-0000-0000-000000000000')) {
                        data.unshift({
                            id: '00000000-0000-0000-0000-000000000000',
                            name: 'Classic MPIG',
                            rarity: 'COMMON',
                            price_usd: 0,
                            image_url: '/assets/mpig.png',
                            is_active: true
                        });
                    }
                    setInventory(data);
                }
            }
        };

        const fetchMyProfile = async () => {
            if (publicKey) {
                const res = await fetch(`/api/skins?action=GET_PROFILE&address=${publicKey.toBase58()}`);
                if (res.ok) {
                    const skin = await res.json();
                    if (skin) {
                        setSelectedSkin(skin);
                    }
                }
            }
        };

        if (connected) {
            fetchMyStats();
            fetchMyInventory();
            fetchMyProfile();
        }

        // Poll for config changes (Maintenance, Announcements)
        const configPoll = setInterval(fetchConfig, 10000);

        return () => {
            clearInterval(configPoll);
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
    }, [connected, publicKey, activeTournament, activeTournament]); // Fetch profile and stats when wallet or tournament changes

    useEffect(() => {
        if (!connected) {
            setAuthToken(null);
            localStorage.removeItem('mpig-auth-token');
            setHighScore(0);
        } else {
            const fetchMyStats = async () => {
                if (publicKey) {
                    const tourId = activeTournament || '00000000-0000-0000-0000-000000000000';
                    const res = await fetch(`/api/leaderboard?address=${publicKey.toBase58()}&tournament_id=${tourId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setHasPaid(data.has_paid || false);
                        
                        const myEntry = data.leaderboard?.find((p: any) => p.wallet_address === publicKey.toBase58());
                        if (myEntry) {
                            setHighScore(myEntry.high_score || 0);
                            localStorage.setItem('mpig-highscore', (myEntry.high_score || 0).toString());
                        }
                    }
                }
            };
            fetchMyStats();
        }
    }, [connected, publicKey, activeTournament]);

    // Sync modal state to Phaser input to prevent "click-through"
    useEffect(() => {
        if (!gameRef.current) return;
        const isMenuOpen = isSkinShopOpen || isPaused || isBanned;
        gameRef.current.events.emit('toggle-input', !isMenuOpen);
    }, [isSkinShopOpen, isPaused, isBanned]);

    const togglePause = () => {
        if (gameRef.current) {
            gameRef.current.events.emit('request-pause');
        }
    };

    const handleRestart = () => {
        if (gameRef.current) {
            // Re-emit with specific skin to ensure texture reloads correctly
            gameRef.current.events.emit('request-start-mission', { 
                skinUrl: selectedSkin?.image_url || '/assets/mpig.png',
                autoStart: true
            });
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
        if (!gameRef.current) return;
        // Tell Phaser to start the mission - this will trigger restart and then game-start event
        gameRef.current.events.emit('request-start-mission', { 
            skinUrl: selectedSkin?.image_url || '/assets/mpig.png',
            autoStart: true
        });
    };

    const handleSignToPlay = async () => {
        if (!publicKey || !signMessage) return;
        try {
            setIsSigning(true);
            const message = "Sign this message to authenticate your USD game session.";
            const messageBytes = new TextEncoder().encode(message);
            const signature = await signMessage(messageBytes);
            const signatureBs58 = bs58.encode(signature);

            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    publicKey: publicKey.toBase58(),
                    signature: signatureBs58,
                    message
                })
            });
            const data = await res.json();
            if (data.token) {
                setAuthToken(data.token);
                localStorage.setItem('mpig-auth-token', data.token);
                // Auto start game after sign
                handleActionInPhaser();
            } else {
                alert("Authentication failed. Please try again.");
            }
        } catch (err) {
            console.error('Signing failed:', err);
            alert("Signature rejected. Operations restricted.");
        } finally {
            setIsSigning(false);
        }
    };

    const handleStartClick = async () => {
        if (!connected) {
            // Trigger wallet connection modal explicitly
            setVisible(true);
            return;
        }

        // 1. Check if tournament requires a fee and if paid
        const selectedT = tournaments.find(t => t.id === activeTournament);
        const amountUsd = selectedT?.entry_fee_usd || 0;

        if (amountUsd > 0 && !hasPaid) {
            handlePayEntry(amountUsd);
            return;
        }

        if (!authToken) {
            handleSignToPlay();
        } else {
            handleActionInPhaser();
        }
    };

    const handlePayEntry = async (amountUsd: number) => {
        if (!publicKey || !sendTransaction) return;
        setIsPaying(true);
        setStatus('Negotiating Exchange...');

        try {
            const transaction = new Transaction();
            const TREASURY = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET || 'BM1HwiJ1hJBpadQF5tXu5qJYoVGQCXR3ABm4pJ4wepSQ');

            // --- NATIVE SOL PAYMENT (BASED ON USD) ---
            const solPrice = await getSolPriceInUSD();
            const solRequired = usdToSol(amountUsd, solPrice);
            const lamports = Math.floor(solRequired * LAMPORTS_PER_SOL);
            
            setStatus(`Paying ${solRequired.toFixed(4)} SOL ($${amountUsd})...`);
            
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: TREASURY,
                    lamports: lamports
                })
            );

            const signature = await sendTransaction(transaction, connection);
            setStatus('Confirming Chain...');
            
            // Verify with our backend
            const verifyRes = await fetch('/api/tournaments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txHash: signature,
                    walletAddress: publicKey.toBase58(),
                    tournamentId: activeTournament
                })
            });

            if (verifyRes.ok) {
                setHasPaid(true);
                setStatus('Payment Verified!');
                // Automatically proceed to sign or start
                if (!authToken) handleSignToPlay();
                else handleActionInPhaser();
            } else {
                const err = await verifyRes.json();
                alert(`Verification Error: ${err.error}`);
            }
        } catch (err: any) {
            console.error('Payment failed:', err);
            alert(`Payment Failed: ${err.message}`);
        } finally {
            setIsPaying(false);
            setTimeout(() => setStatus(''), 5000);
        }
    };

    const handlePurchaseSkin = async (skin: any) => {
        if (!publicKey || !sendTransaction) return;
        setIsPaying(true);
        setStatus(`Unlocking ${skin.name}...`);
        
        try {
            const transaction = new Transaction();
            const TREASURY = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET || 'BM1HwiJ1hJBpadQF5tXu5qJYoVGQCXR3ABm4pJ4wepSQ');
            let signature = '';

            if (skin.price_usd > 0) {
                // --- USD SOL PAYMENT ---
                const solPrice = await getSolPriceInUSD();
                const solRequired = usdToSol(skin.price_usd, solPrice);
                const lamports = Math.floor(solRequired * LAMPORTS_PER_SOL);
                
                setStatus(`Paying ${solRequired.toFixed(4)} SOL ($${skin.price_usd})...`);
                
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: TREASURY,
                        lamports: lamports
                    })
                );
                signature = await sendTransaction(transaction, connection);
            } 
            else {
                // Free skin or price set to 0
                signature = 'FREE_UNLOCK'; 
            }

            // Sync with backend
            const res = await fetch('/api/skins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'PURCHASE', 
                    skin_id: skin.id, 
                    wallet_address: publicKey.toBase58(),
                    txHash: signature 
                })
            });

            if (res.ok) {
                setInventory(prev => [...prev, skin]);
                setSelectedSkin(skin);
                setStatus('Skin Unlocked!');
            } else {
                const err = await res.json();
                alert(`Unlock Error: ${err.error}`);
            }
        } catch (err: any) {
            console.error('Skin purchase failed:', err);
            alert(`Purchase Failed: ${err.message}`);
        } finally {
            setIsPaying(false);
            setTimeout(() => setStatus(''), 5000);
        }
    };

    const handleShare = async () => {
        const shareText = `I just scored ${score} in USD RUN 🐷🔥\nThink you can beat my score?\n\n$MPIG`;
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

    const fetchLeaderboard = async (tId?: string) => {
        try {
            const currentWallet = walletRef.current;
            const targetTournament = tId || tournamentRef.current;
            
            const url = currentWallet.connected && currentWallet.publicKey
                ? `/api/leaderboard?address=${currentWallet.publicKey.toBase58()}&tournament_id=${targetTournament}`
                : `/api/leaderboard?tournament_id=${targetTournament}`;
            const res = await fetch(url);
            const data = await res.json();

            if (res.ok) {
                setGlobalLeaderboard(data.leaderboard);
                setPlayerRank(data.rank);
                setHasPaid(data.has_paid);
            }
            // Anti-cheat check
            if (currentWallet.connected && currentWallet.publicKey) {
                const me = data.leaderboard?.find((p: any) => p.wallet_address === currentWallet.publicKey?.toBase58());
                if (me?.is_banned) {
                    setIsBanned(true);
                }
            }
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            setConfig(data);

            // Pass tuning to Phaser
            if (gameRef.current) {
                gameRef.current.events.emit('update-tuning', {
                    speedMult: data.base_speed_multiplier,
                    oinkMult: data.oink_multiplier,
                    spawnMult: data.obstacle_spawn_rate
                });

                if (data.maintenance_mode && gameState === GameState.PLAYING) {
                    gameRef.current.events.emit('request-pause');
                }
            }
        } catch (err) {
            console.error('Failed to fetch config:', err);
        }
    };

    const submitScore = async (address: string, finalScore: number, finalOinks: number) => {
        try {
            setIsSyncing(true);
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const currentToken = authRef.current;
            
            if (currentToken) {
                headers['Authorization'] = `Bearer ${currentToken}`;
            }

            await fetch('/api/leaderboard', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    wallet_address: address,
                    high_score: finalScore,
                    oinks: finalOinks,
                    tournament_id: tournamentRef.current
                })
            });
        } catch (error) {
            console.error('Failed to submit score:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="relative w-full h-dvh flex items-center justify-center overflow-hidden bg-black">
            {/* The Actual Canvas Wrapper */}
            <div ref={gameContainerRef} className="w-full h-full max-w-[450px] max-h-[800px] shadow-[0_0_100px_rgba(20,241,149,0.1)] relative overflow-hidden md:rounded-3xl md:border md:border-white/5" id="game-container">

                {/* Main HUD Overlay - Contained inside the aspect ratio box */}
                <div className="absolute inset-0 pointer-events-none flex flex-col font-['var(--font-orbitron)'] z-10">

                    {/* Announcement Ticker */}
                    {config?.announcement_text && !config.maintenance_mode && (
                        <div className="w-full bg-[#14F195]/20 backdrop-blur-md border-b border-[#14F195]/30 overflow-hidden py-1 pointer-events-auto">
                            <div className="whitespace-nowrap flex animate-marquee">
                                <span className="text-[7px] font-black text-[#14F195] tracking-[4px] uppercase px-4 italic">
                                    {config.announcement_text} • {config.announcement_text} • {config.announcement_text}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Top HUD - Mobile Optimized */}
                    {/* 1. Maintenance Screen */}
                    {config?.maintenance_mode && (
                        <div className="absolute inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center pointer-events-auto">
                            <div className="w-24 h-24 border-2 border-red-500/20 rounded-full flex items-center justify-center mb-8 animate-pulse shadow-[0_0_50px_rgba(255,0,0,0.2)]">
                                <span className="text-5xl">🛑</span>
                            </div>
                            <h2 className="text-3xl font-black text-red-500 tracking-[8px] uppercase mb-4">MISSION SUSPENDED</h2>
                            <p className="text-white/40 text-[10px] font-black tracking-[3px] uppercase max-w-[250px] leading-relaxed italic mb-10">
                                Command terminal is undergoing maintenance protocols. Standby for reconnection.
                            </p>
                            <Link href="/" className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl text-white/60 text-[8px] font-black tracking-[4px] uppercase hover:bg-white/10 transition-all">
                                EXIT TERMINAL
                            </Link>
                        </div>
                    )}

                    {/* 2. Ban Screen */}
                    {isBanned && (
                        <div className="absolute inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center pointer-events-auto">
                            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-8 animate-bounce">
                                <span className="text-5xl">🚫</span>
                            </div>
                            <h2 className="text-3xl font-black text-red-500 tracking-[8px] uppercase mb-4">ACCESS TERMINATED</h2>
                            <p className="text-white/40 text-[10px] font-black tracking-[3px] uppercase max-w-[250px] leading-relaxed italic mb-10">
                                Your wallet has been blacklisted for violating mission protocols.
                            </p>
                            <Link href="/" className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl text-white/60 text-[8px] font-black tracking-[4px] uppercase hover:bg-white/10 transition-all">
                                RETURN TO CIVILIAN LIFE
                            </Link>
                        </div>
                    )}

                    {/* Pause/Game Over Screen Handling... */}
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
                                        onClick={handleStartClick}
                                        disabled={isSigning || isPaying}
                                        className="pill-button-gold w-full h-16 text-lg font-black tracking-[8px] hover:scale-[1.05] transition-all active:scale-95 shadow-[0_10px_40px_rgba(212,175,55,0.4)] border-2 border-[#FFE44D]/30"
                                    >
                                        {!connected ? 'CONNECT TO START' : isPaying ? 'PAYING...' : isSigning ? 'AUTHENTICATING...' : (!hasPaid && tournaments.find(t => t.id === activeTournament)?.entry_fee_mpig > 0) ? `PAY ${tournaments.find(t => t.id === activeTournament)?.entry_fee_mpig} USD` : (!authToken) ? 'SIGN SECURELY' : 'TAP TO START'}
                                    </button>

                                {/* Tournament Selection */}
                                {tournaments.length > 1 && (
                                    <div className="mt-6 w-full space-y-2">
                                        <p className="text-[7px] text-white/30 uppercase tracking-[3px] font-black">SELECT COMBAT ZONE</p>
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                            {tournaments.map((t) => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        setActiveTournament(t.id);
                                                        // Refresh leaderboard when changing tournament
                                                        fetchLeaderboard();
                                                    }}
                                                    className={`px-4 py-2 rounded-lg border text-[8px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTournament === t.id ? 'bg-[#FFD700] text-black border-[#FFD700]' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'}`}
                                                >
                                                    {t.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 animate-pulse flex flex-col items-center">
                                    <span className="text-[10px] text-[#14F195] font-black tracking-[4px] uppercase">TAP TO JUMP</span>
                                    <span className="text-[7px] text-white/40 uppercase tracking-[2px]">AVOID THE RED CANDLES</span>
                                </div>
                                
                                <div className="mt-8 flex gap-4">
                                    <button 
                                        onClick={() => setIsSkinShopOpen(true)}
                                        className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[3px] text-white/60 hover:text-white transition-all flex items-center gap-2 pointer-events-auto"
                                    >
                                        ✨ SKINS
                                    </button>
                                    <Link href="/leaderboard" className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[3px] text-white/60 hover:text-white transition-all pointer-events-auto">
                                        🏆 RANKS
                                    </Link>
                                </div>

                                <div className="flex flex-col gap-1 items-center mt-6 opacity-80">
                                    <p className="text-[#14F195] text-[10px] font-black uppercase tracking-[6px] drop-shadow-[0_0_10px_rgba(20,241,149,0.5)]">DODGE THE CANDLES</p>
                                    <p className="text-[#FFD700] text-[8px] font-black uppercase tracking-[4px]">STACK $MPIG</p>
                                </div>

                                <div className="mt-8 w-full flex flex-col gap-3">
                                    <div className="relative group">
                                        <div className="absolute -inset-0.5 bg-linear-to-r from-[#FFD700] to-[#B8860B] rounded-xl blur-xs opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                        <WalletMultiButton style={WALLET_STYLES} />
                                    </div>

                                    {connected && publicKey && (
                                        <div className="mt-2 py-2 px-4 rounded-full bg-[#14F195]/10 border border-[#14F195]/30">
                                            <p className="text-[#14F195] text-[7px] uppercase tracking-[2px] font-black text-center">
                                                IDENTITY SECURED: {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                                            </p>
                                        </div>
                                    )}

                                    <div className="py-2 px-4 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm group cursor-pointer active:scale-95 transition-all text-center"
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
                                <div className="w-full bg-[#14F195]/10 rounded-2xl py-3 px-4 mb-4 border border-[#14F195]/20 backdrop-blur-sm flex justify-between items-center">
                                    <span className="text-[9px] uppercase tracking-[3px] text-[#14F195] font-black">TOTAL OINKS</span>
                                    <span className="text-2xl font-black text-[#14F195] drop-shadow-[0_0_10px_rgba(20,241,149,0.3)]">{oinks}</span>
                                </div>

                                {/* Individual Rank Display */}
                                <div className="w-full bg-white/5 rounded-2xl p-4 mb-4 border border-white/10 backdrop-blur-sm flex flex-col items-center justify-center min-h-[100px] relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-linear-to-b from-[#14F195]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <h3 className="text-[8px] uppercase tracking-[4px] text-white/40 font-black mb-3">GLOBAL RANKING</h3>

                                    {connected ? (
                                        <div className="flex flex-col items-center animate-zoom-in">
                                            <span className="text-4xl font-black italic text-[#14F195] drop-shadow-[0_0_15px_rgba(20,241,149,0.5)]">
                                                #{playerRank || '??'}
                                            </span>
                                            <span className="text-[7px] text-white/60 uppercase tracking-[2px] font-bold mt-2">OUT OF ALL MISSIONS</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="text-[10px] text-red-500/80 font-black uppercase tracking-[2px] text-center animate-pulse px-4">
                                                IDENTITY NOT SECURED
                                            </span>
                                            <button
                                                onClick={() => setVisible(true)}
                                                className="text-[8px] text-[#14F195] font-black uppercase tracking-[2px] underline hover:text-white transition-colors"
                                            >
                                                CONNECT TO SAVE RANK
                                            </button>
                                        </div>
                                    )}

                                    {isSyncing && (
                                        <div className="absolute bottom-2 right-3 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-ping" />
                                            <span className="text-[6px] text-[#14F195] font-black tracking-widest uppercase">SYNCING</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <Link href="/profile" className="h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 group">
                                        <span className="text-[8px] font-black text-white/60 group-hover:text-white uppercase tracking-[2px]">MY PROFILE</span>
                                    </Link>
                                    <Link href="/leaderboard" className="h-10 bg-[#14F195]/5 border border-[#14F195]/20 rounded-xl flex items-center justify-center hover:bg-[#14F195]/10 transition-all active:scale-95 group">
                                        <span className="text-[8px] font-black text-[#14F195] uppercase tracking-[2px]">HALL OF FAME</span>
                                    </Link>
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
 
             {/* Skin Shop Modal */}
             {isSkinShopOpen && (
                 <div className="absolute inset-0 bg-black/80 backdrop-blur-3xl z-[300] flex flex-col p-6 animate-fade-in font-['var(--font-orbitron)'] pointer-events-auto">
                     <div className="flex justify-between items-center mb-8 px-4">
                         <div>
                             <h3 className="text-xl font-black text-[#14F195] tracking-[8px] uppercase">SKIN WORKSHOP</h3>
                             <p className="text-[8px] text-white/40 uppercase tracking-[3px]">PREMIUM COMMANDER OVERLAYS</p>
                         </div>
                         <button onClick={() => setIsSkinShopOpen(false)} className="bg-white/5 p-4 rounded-full text-white/40 hover:text-white transition-all">CLOSE</button>
                     </div>
 
                     <div className="grid grid-cols-2 gap-4 overflow-y-auto px-4 pb-20 custom-scrollbar">
                         {shopSkins.map((s) => {
                             const isOwned = inventory.some(i => i.id === s.id);
                             const isEquipped = selectedSkin?.id === s.id;
                             return (
                                 <div key={s.id} className={`p-4 bg-white/2 border-2 rounded-3xl flex flex-col items-center gap-4 transition-all ${isEquipped ? 'border-[#14F195] bg-[#14F195]/5 shadow-[0_0_30px_rgba(20,241,149,0.1)]' : 'border-white/5'}`}>
                                     <div className="w-24 h-24 bg-black/40 rounded-2xl flex items-center justify-center p-4">
                                         <img src={s.image_url} alt={s.name} className="w-full h-full object-contain pixel-art" />
                                     </div>
                                     <div className="text-center">
                                         <p className="text-[10px] font-black tracking-widest text-white uppercase truncate w-full">{s.name}</p>
                                         <p className={`text-[7px] font-black uppercase tracking-[2px] mt-1 ${s.rarity === 'LEGENDARY' ? 'text-[#FFD700]' : 'text-[#9945FF]'}`}>{s.rarity}</p>
                                     </div>
                                     <button 
                                         onClick={() => isOwned ? handleEquipSkin(s) : handlePurchaseSkin(s)}
                                         className={`w-full py-2 rounded-xl text-[8px] font-black uppercase tracking-[4px] shadow-lg transition-all ${isEquipped ? 'bg-[#14F195] text-black shadow-[#14F195]/20' : isOwned ? 'bg-white/10 text-white' : 'bg-[#FFD700] text-black shadow-[#FFD700]/20 hover:scale-105 active:scale-95'}`}
                                     >
                                         {isEquipped ? 'EQUIPPED' : isOwned ? 'EQUIP' : `$${s.price_usd} USD`}
                                     </button>
                                 </div>
                             )
                         })}
                     </div>
                 </div>
             )}
         </div>
    );
}
