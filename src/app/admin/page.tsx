'use client';
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

// --- Sub-components (Premium UI) ---

function TabButton({ id, label, activeTab, onClick, sublabel }: { id: string, label: string, activeTab: string, onClick: (id: string) => void, sublabel?: string }) {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => onClick(id)}
            className={`flex flex-col items-start gap-1 px-8 py-5 border-b-2 transition-all group ${isActive ? 'bg-white/5 border-[#14F195] opacity-100' : 'border-transparent opacity-40 hover:opacity-100 hover:bg-white/2'}`}
        >
            <span className={`text-[10px] font-black tracking-[4px] uppercase ${isActive ? 'text-[#14F195]' : 'text-white'}`}>{label}</span>
            {sublabel && <span className="text-[7px] text-white/30 font-bold uppercase tracking-[2px]">{sublabel}</span>}
        </button>
    );
}

function Modal({ isOpen, title, children, onClose }: { isOpen: boolean, title: string, children: React.ReactNode, onClose: () => void }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl animate-fade-in pointer-events-auto">
            <div className="bg-[#0A0A0A] border-2 border-[#FFD700]/20 rounded-4xl w-full max-w-[500px] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)] animate-zoom-in relative">
                {/* Gold Glow Decor */}
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-[#FFD700]/40 to-transparent" />
                <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/2">
                    <h3 className="text-sm font-black text-[#FFD700] tracking-[5px] uppercase">{title}</h3>
                    <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-all text-sm font-black">CLOSE</button>
                </div>
                <div className="p-10">{children}</div>
            </div>
        </div>
    );
}

// --- Main Admin Dashboard ---

export default function AdminPage() {
    const { publicKey, connected } = useWallet();
    const [secret, setSecret] = useState('');
    const [isAuth, setIsAuth] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    
    // Data State
    const [stats, setStats] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [skins, setSkins] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');

    // Modal State
    const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
    const [newTournament, setNewTournament] = useState({ name: '', description: 'Custom Zone', entry_fee_mpig: 100 });
    const [isSkinModalOpen, setIsSkinModalOpen] = useState(false);
    const [newSkin, setNewSkin] = useState({ name: '', rarity: 'COMMON', price_mpig: 100, image_url: '/assets/player.webp' });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [notification, setNotification] = useState<{ type: 'SUCCESS' | 'ERROR' | 'INFO', message: string } | null>(null);

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
                
                const tRes = await fetch(`/api/tournaments?secret=${secret}`);
                if (tRes.ok) setTournaments(await tRes.json());

                // Fetch skins separately
                const sRes = await fetch(`/api/skins`); // Public for viewing
                if (sRes.ok) setSkins(await sRes.json());
                
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

    const handleExportData = () => {
        if (!players || players.length === 0) return;
        
        // CSV Header
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Rank,Wallet,Score,Oinks,Verified,Banned\n";
        
        // Data Rows
        players.sort((a,b) => b.high_score - a.high_score).forEach((p, index) => {
            csvContent += `${index + 1},${p.wallet_address},${p.high_score},${p.oinks},${p.is_verified},${p.is_banned}\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `mpig_mission_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleAction = async (action: string, extraData?: any) => {
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
                setNotification({ type: 'SUCCESS', message: data.message || 'Mission Updated' });
                fetchAdminData();
            } else {
                setNotification({ type: 'ERROR', message: data.error });
            }
        } catch (err) {
            setNotification({ type: 'ERROR', message: 'Connection Protocol Failed' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTournamentAction = async (action: string, tournament_id?: string, tournament_data?: any) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret, action, tournament_id, tournament_data })
            });
            if (res.ok) {
                setNotification({ type: 'SUCCESS', message: `Tournament ${action} Confirmed` });
                fetchAdminData();
                setIsTournamentModalOpen(false);
            } else {
                const err = await res.json();
                setNotification({ type: 'ERROR', message: `Protocol Error: ${err.error}` });
            }
        } catch (err) {
            setNotification({ type: 'ERROR', message: 'Mission Control Unreachable' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkinAction = async (action: string, skin_id?: string, skin_data?: any) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/skins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret, action, skin_id, skin_data })
            });
            if (res.ok) {
                setNotification({ type: 'SUCCESS', message: `Cosmetic ${action} Synchronized` });
                fetchAdminData();
                setIsSkinModalOpen(false);
            } else {
                const err = await res.json();
                setNotification({ type: 'ERROR', message: `Inventory Error: ${err.error}` });
            }
        } catch (err) {
            setNotification({ type: 'ERROR', message: 'Engine Connection Terminated' });
        } finally {
            setIsLoading(false);
        }
    };

    const saveConfig = () => handleAction('UPDATE_CONFIG', { config });

    if (!isAdminWallet) {
        return (
            <main className="min-h-dvh bg-black flex flex-col items-center justify-center p-6 font-['var(--font-orbitron)']">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="max-w-[500px] bg-white/2 border border-white/5 backdrop-blur-3xl rounded-4xl p-12 text-center shadow-2xl">
                    <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                        <span className="text-5xl">🛑</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-[8px] uppercase mb-4">ACCESS DENIED</h1>
                    <p className="text-white/40 text-[10px] tracking-[4px] uppercase mb-10 italic leading-relaxed">ONLY COMMANDER WALLET RECOGNIZED AS AUTHORIZED COMMAND</p>
                    <WalletMultiButton />
                </div>
            </main>
        );
    }

    if (!isAuth) {
        return (
            <main className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center p-6 font-['var(--font-orbitron)']">
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#14F195]/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="w-full max-w-[450px] bg-white/5 border border-white/10 p-12 rounded-4xl backdrop-blur-2xl shadow-2xl animate-fade-in">
                    <h3 className="text-xs font-black text-[#FFD700] tracking-[8px] uppercase text-center mb-10">DECRYPTION REQUIRED</h3>
                    <input
                        type="password"
                        placeholder="SECURITY SECRET..."
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchAdminData()}
                        className="w-full h-16 bg-black/80 border-2 border-white/5 rounded-2xl px-8 text-center text-white text-lg tracking-[8px] outline-none focus:border-[#14F195]/40 transition-all mb-8 shadow-inner"
                    />
                    <button onClick={fetchAdminData} className="w-full h-16 bg-linear-to-r from-[#14F195] to-[#9945FF] text-white font-black tracking-[10px] uppercase rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-xl">
                        {isLoading ? 'DECRYPTING...' : 'INITIATE FEED'}
                    </button>
                    {status && <p className="text-center text-red-400 text-[10px] font-black uppercase mt-6 tracking-widest">{status}</p>}
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-dvh bg-[#050505] text-white font-['var(--font-orbitron)'] relative overflow-x-hidden flex flex-col w-screen">
            {/* Nav Header */}
            <div className="w-full bg-black/60 border-b border-white/5 backdrop-blur-md px-6 md:px-10 py-6 flex justify-between items-center z-100">
                <div className="flex items-center gap-4 md:gap-10">
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 bg-white/5 rounded-lg border border-white/10 md:hidden hover:bg-white/10 transition-all text-[#14F195]"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {isSidebarOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
                        </svg>
                    </button>
                    <Link href="/" className="hidden lg:flex text-[#14F195] text-[10px] font-black tracking-[4px] uppercase hover:opacity-70 transition-opacity items-center gap-2">
                        ← RETURN
                    </Link>
                    <h1 className="text-sm md:xl font-black tracking-[4px] md:tracking-[8px] uppercase">MISSION <span className="text-[#14F195]">CONTROL</span></h1>
                </div>
                <div className="flex items-center gap-4 md:gap-6">
                    <div className="hidden md:block text-[10px] text-white/20 font-mono">{publicKey?.toBase58().slice(0, 10)}...</div>
                    <WalletMultiButton />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                    <div 
                        className="absolute inset-0 bg-black/80 backdrop-blur-md z-40 md:hidden animate-fade-in"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Side-Nav Tabs */}
                <div className={`fixed md:relative z-50 md:z-20 w-80 md:w-64 h-full bg-black md:bg-black/20 border-r border-white/5 flex flex-col transition-transform duration-500 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                    <div className="p-8 md:hidden border-b border-white/5 mb-4">
                        <p className="text-[10px] text-white/40 font-black tracking-[4px] uppercase">TACTICAL DRAWER</p>
                    </div>
                    <TabButton id="overview" label="OVERVIEW" sublabel="Live Mission Status" activeTab={activeTab} onClick={(id) => { setActiveTab(id); setIsSidebarOpen(false); }} />
                    <TabButton id="tuning" label="TUNING" sublabel="Engine Properties" activeTab={activeTab} onClick={(id) => { setActiveTab(id); setIsSidebarOpen(false); }} />
                    <TabButton id="tournaments" label="TOURNAMENTS" sublabel="Tournament Factory" activeTab={activeTab} onClick={(id) => { setActiveTab(id); setIsSidebarOpen(false); }} />
                    <TabButton id="skins" label="SKINS" sublabel="Skins Workshop" activeTab={activeTab} onClick={(id) => { setActiveTab(id); setIsSidebarOpen(false); }} />
                    <TabButton id="economy" label="ECONOMY" sublabel="Treasury & Payouts" activeTab={activeTab} onClick={(id) => { setActiveTab(id); setIsSidebarOpen(false); }} />
                    <TabButton id="agents" label="AGENTS" sublabel="Player Registry" activeTab={activeTab} onClick={(id) => { setActiveTab(id); setIsSidebarOpen(false); }} />
                    
                    <div className="mt-auto p-8 opacity-20 hover:opacity-100 transition-opacity">
                        <button onClick={() => { handleAction('START_NEW_SEASON'); setIsSidebarOpen(false); }} className="text-red-500 text-[10px] font-black tracking-[3px] uppercase flex items-center gap-3">
                            ⚠️ RESET SEASON
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-[#070707] custom-scrollbar shadow-inner">
                    {activeTab === 'overview' && (
                        <div className="max-w-[1000px] animate-fade-in space-y-8 md:space-y-12">
                            {/* Mission Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                                <div className="p-8 bg-white/2 border border-white/5 rounded-3xl">
                                    <p className="text-[9px] text-white/30 font-black tracking-[3px] uppercase mb-2">IDENTIFIED AGENTS</p>
                                    <p className="text-4xl font-black text-white">{stats?.totalPlayers || 0}</p>
                                </div>
                                <div className="p-8 bg-white/2 border border-white/5 rounded-3xl">
                                    <p className="text-[9px] text-white/30 font-black tracking-[3px] uppercase mb-2">CUMULATIVE OINKS</p>
                                    <p className="text-4xl font-black text-[#FFD700]">{stats?.totalOinks?.toLocaleString() || 0}</p>
                                </div>
                                <div className="p-8 bg-white/2 border border-white/5 rounded-3xl">
                                    <p className="text-[9px] text-white/30 font-black tracking-[3px] uppercase mb-2">MISSION RECORD</p>
                                    <p className="text-4xl font-black text-[#14F195]">{stats?.highestScore?.toLocaleString() || 0}</p>
                                </div>
                            </div>

                            {/* Global Broadcast */}
                            <div className="bg-white/5 border border-white/10 rounded-4xl p-10 backdrop-blur-md">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-sm font-black tracking-[4px] uppercase text-[#14F195]">GLOBAL MISSION BROADCAST</h2>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[9px] font-black tracking-[2px] uppercase opacity-40">MAINTENANCE</span>
                                        <button
                                            onClick={() => setConfig({ ...config, maintenance_mode: !config.maintenance_mode })}
                                            className={`w-14 h-8 rounded-full relative transition-all ${config.maintenance_mode ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-white/10'}`}
                                        >
                                            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${config.maintenance_mode ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={config.announcement_text}
                                    onChange={(e) => setConfig({ ...config, announcement_text: e.target.value.toUpperCase() })}
                                    className="w-full h-32 bg-black/60 border-2 border-white/5 rounded-2xl p-8 text-white font-bold tracking-widest focus:border-[#14F195]/20 outline-none resize-none mb-6 shadow-inner"
                                    placeholder="TYPE ANNOUNCEMENT..."
                                />
                                <button onClick={saveConfig} className="px-10 py-5 bg-[#14F195] text-black font-black text-[12px] tracking-[4px] uppercase rounded-2xl hover:scale-105 transition-all shadow-xl">
                                    PUBLISH BROADCAST
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tuning' && (
                        <div className="max-w-[700px] animate-fade-in bg-white/5 border border-white/10 p-12 rounded-4xl">
                            <h2 className="text-sm font-black tracking-[6px] uppercase text-[#FFD700] mb-12 border-b border-white/5 pb-8">FLIGHT CONTROL TUNING</h2>
                            <div className="space-y-12">
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[10px] font-black tracking-[3px] uppercase">
                                        <span>PHYSICS SPEED MULTIPLIER</span>
                                        <span className="text-[#14F195]">{config.base_speed_multiplier}X</span>
                                    </div>
                                    <input type="range" min="0.5" max="3" step="0.1" value={config.base_speed_multiplier} onChange={(e) => setConfig({ ...config, base_speed_multiplier: parseFloat(e.target.value) })} className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-[#14F195]" />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[10px] font-black tracking-[3px] uppercase">
                                        <span>COIN GENERATION RATE</span>
                                        <span className="text-[#FFD700]">{config.oink_multiplier}X</span>
                                    </div>
                                    <input type="range" min="1" max="10" step="1" value={config.oink_multiplier} onChange={(e) => setConfig({ ...config, oink_multiplier: parseInt(e.target.value) })} className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-[#FFD700]" />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[10px] font-black tracking-[3px] uppercase">
                                        <span>OBSTACLE SPAWN FREQUENCY</span>
                                        <span className="text-white/60">{config.obstacle_spawn_rate}X</span>
                                    </div>
                                    <input type="range" min="0.5" max="2" step="0.1" value={config.obstacle_spawn_rate} onChange={(e) => setConfig({ ...config, obstacle_spawn_rate: parseFloat(e.target.value) })} className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-white" />
                                </div>
                            </div>
                            <button onClick={saveConfig} className="mt-16 w-full py-5 bg-white/10 hover:bg-white/20 text-white font-black tracking-[4px] uppercase rounded-2xl border border-white/10 transition-all">
                                CALIBRATE ENGINE
                            </button>
                        </div>
                    )}

                    {activeTab === 'tournaments' && (
                        <div className="animate-fade-in space-y-10">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-xl font-black tracking-[8px] uppercase text-[#FFD700]">TOURNAMENT FACTORY</h2>
                                    <p className="text-[9px] text-white/30 tracking-[4px] uppercase mt-2">DEPLOY AND MANAGE INDEPENDENT COMBAT ZONES</p>
                                </div>
                                <button onClick={() => setIsTournamentModalOpen(true)} className="px-8 py-4 bg-linear-to-r from-[#FF9800] to-[#FFD700] text-black font-black text-[10px] tracking-[4px] uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl">
                                    + DEPLOY TOURNAMENT
                                </button>
                            </div>
                            
                            <div className="bg-white/2 border border-white/10 rounded-4xl overflow-hidden backdrop-blur-xl">
                                <table className="w-full text-left text-[11px] font-bold">
                                    <thead className="bg-black/60 text-white/40 uppercase tracking-[4px] border-b border-white/5">
                                        <tr>
                                            <th className="px-12 py-8">IDENTITY</th>
                                            <th className="px-6 py-8 text-center uppercase">STATUS</th>
                                            <th className="px-6 py-8 text-center uppercase">ENTRY FEE</th>
                                            <th className="px-12 py-8 text-right uppercase">PROTOCOL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {tournaments.map((t) => (
                                            <tr key={t.id} className="hover:bg-white/5 transition-all group">
                                                <td className="px-12 py-10">
                                                    <p className="text-lg font-black tracking-widest text-white tracking-[2px]">{t.name}</p>
                                                    <p className="text-[8px] font-mono text-white/20 mt-1 uppercase tracking-widest">{t.id}</p>
                                                </td>
                                                <td className="px-6 py-10 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-[8px] font-black tracking-[3px] ${t.is_active ? 'bg-[#14F195]/20 text-[#14F195]' : 'bg-white/10 text-white/20'}`}>
                                                        {t.is_active ? 'ACTIVE' : 'STANDBY'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-10 text-center">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <span className="text-xl font-black text-white">{t.entry_fee_mpig}</span>
                                                        <span className="text-[7px] text-[#FFD700] font-black tracking-[2px]">MPIG COIN</span>
                                                    </div>
                                                </td>
                                                <td className="px-12 py-10 text-right space-x-4">
                                                    <button onClick={() => handleTournamentAction('TOGGLE_STATUS', t.id)} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black tracking-[2px] uppercase hover:bg-white/10 transition-all">
                                                        TOGGLE
                                                    </button>
                                                    <button onClick={() => handleTournamentAction('DELETE', t.id)} className="px-5 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[9px] font-black tracking-[2px] uppercase hover:bg-red-500 hover:text-white transition-all">
                                                        TERMINATE
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'skins' && (
                        <div className="animate-fade-in space-y-10">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-xl font-black tracking-[8px] uppercase text-[#14F195]">SKINS WORKSHOP</h2>
                                    <p className="text-[9px] text-white/30 tracking-[4px] uppercase mt-2">DEPLOY AND MANAGE COMPETING COSMETICS</p>
                                </div>
                                <button onClick={() => setIsSkinModalOpen(true)} className="px-8 py-4 bg-linear-to-r from-[#14F195] to-[#9945FF] text-white font-black text-[10px] tracking-[4px] uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl">
                                    + DEPLOY SKIN
                                </button>
                            </div>
                            
                            <div className="bg-white/2 border border-white/10 rounded-4xl overflow-hidden backdrop-blur-xl">
                                <table className="w-full text-left text-[11px] font-bold">
                                    <thead className="bg-black/60 text-white/40 uppercase tracking-[4px] border-b border-white/5">
                                        <tr>
                                            <th className="px-12 py-8">SKIN IDENTITY</th>
                                            <th className="px-6 py-8 text-center uppercase">RARITY</th>
                                            <th className="px-6 py-8 text-center uppercase">PRICE ($MPIG)</th>
                                            <th className="px-12 py-8 text-right uppercase">PROTOCOL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {skins.map((s) => (
                                            <tr key={s.id} className="hover:bg-white/5 transition-all group">
                                                <td className="px-12 py-10">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-16 h-16 bg-black/40 border border-white/10 rounded-xl overflow-hidden flex items-center justify-center p-2 relative">
                                                            <img src={s.image_url} alt={s.name} className="w-full h-full object-contain pixel-art" />
                                                            {!s.is_active && <div className="absolute inset-0 bg-red-500/20 backdrop-blur-xs flex items-center justify-center text-[6px] font-black text-white tracking-[2px] uppercase">OFFLINE</div>}
                                                        </div>
                                                        <div>
                                                            <p className="text-lg font-black tracking-widest text-[#14F195]">{s.name}</p>
                                                            <p className="text-[8px] font-mono text-white/20 mt-1 uppercase tracking-widest">{s.id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-10 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-[8px] font-black tracking-[3px] shadow-[0_0_15px_rgba(0,0,0,0.5)] ${s.rarity === 'LEGENDARY' ? 'bg-[#FFD700] text-black' : s.rarity === 'RARE' ? 'bg-[#9945FF] text-white' : 'bg-white/5 text-white/40 border border-white/5'}`}>
                                                        {s.rarity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-10 text-center">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <span className="text-xl font-black text-white">{s.price_mpig}</span>
                                                        <span className="text-[7px] text-[#FFD700] font-black tracking-[2px]">MPIG COIN</span>
                                                    </div>
                                                </td>
                                                <td className="px-12 py-10 text-right space-x-4">
                                                    <button onClick={() => handleSkinAction('TOGGLE_STATUS', s.id)} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black tracking-[2px] uppercase hover:bg-white/10 transition-all">
                                                        TOGGLE
                                                    </button>
                                                    <button onClick={() => handleSkinAction('DELETE', s.id)} className="px-5 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[9px] font-black tracking-[2px] uppercase hover:bg-red-500 hover:text-white transition-all">
                                                        DELETE
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'economy' && (
                        <div className="animate-fade-in space-y-12 max-w-[1000px]">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-xl font-black tracking-[8px] uppercase text-[#FFD700]">TREASURY INTELLIGENCE</h2>
                                    <p className="text-[9px] text-white/30 tracking-[4px] uppercase mt-2">MONITOR $MPIG INFLOW AND REWARD OBLIGATIONS</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                <div className="p-8 md:p-10 bg-white/5 border border-white/10 rounded-4xl backdrop-blur-md relative overflow-hidden group">
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FFD700]/5 rounded-full blur-3xl group-hover:bg-[#FFD700]/10 transition-all" />
                                    <span className="text-[8px] font-black text-white/20 tracking-[3px] uppercase">TOURNAMENT REVENUE</span>
                                    <p className="text-5xl font-black text-white mt-4">{stats?.tournamentRevenue || 0} <span className="text-[#FFD700] text-sm tracking-widest">$MPIG</span></p>
                                    <div className="w-full h-1 bg-white/5 mt-8 rounded-full overflow-hidden">
                                        <div className="w-2/3 h-full bg-[#FFD700]/40" />
                                    </div>
                                </div>
                                <div className="p-10 bg-white/5 border border-white/10 rounded-4xl backdrop-blur-md relative overflow-hidden group">
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#14F195]/5 rounded-full blur-3xl group-hover:bg-[#14F195]/10 transition-all" />
                                    <span className="text-[8px] font-black text-white/20 tracking-[3px] uppercase">COSMETIC REVENUE</span>
                                    <p className="text-5xl font-black text-white mt-4">{stats?.skinRevenue || 0} <span className="text-[#14F195] text-sm tracking-widest">$MPIG</span></p>
                                    <div className="w-full h-1 bg-white/5 mt-8 rounded-full overflow-hidden">
                                        <div className="w-1/3 h-full bg-[#14F195]/40" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black tracking-[5px] uppercase text-[#14F195] border-b border-white/5 pb-4">WINNER PAYOUT LOGISTICS</h3>
                                <div className="bg-white/2 border border-white/10 rounded-3xl overflow-hidden">
                                    <div className="p-4 flex justify-end">
                                        <button 
                                            onClick={handleExportData}
                                            className="px-6 py-2 bg-[#14F195]/10 text-[#14F195] rounded-full text-[8px] font-black uppercase tracking-[3px] border border-[#14F195]/20 hover:bg-[#14F195] hover:text-black transition-all"
                                        >
                                            🚀 EXPORT CSV REPORT
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left text-[10px] font-bold min-w-[600px] md:min-w-0">
                                        <thead className="bg-black/40 text-white/20 uppercase tracking-[3px] border-b border-white/5">
                                            <tr>
                                                <th className="px-8 py-6">IDENTIFIED WINNER</th>
                                                <th className="px-6 py-6 text-center">SCORE</th>
                                                <th className="px-6 py-6 text-center">WALLET</th>
                                                <th className="px-8 py-6 text-right">PROTOCOL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/2">
                                            {players.sort((a,b) => b.high_score - a.high_score).slice(0, 5).map((p, i) => (
                                                <tr key={i} className="hover:bg-white/2 transition-all">
                                                    <td className="px-8 py-6 text-white font-black">{p.username || 'ANONYMOUS'}</td>
                                                    <td className="px-6 py-6 text-center text-[#14F195]">{p.high_score}</td>
                                                    <td className="px-6 py-6 text-center text-white/30 font-mono">{p.wallet_address.slice(0, 10)}...</td>
                                                    <td className="px-8 py-6 text-right">
                                                        <button className="px-4 py-2 bg-[#14F195]/10 text-[#14F195] rounded-xl text-[8px] font-black uppercase tracking-[2px] border border-[#14F195]/20 hover:bg-[#14F195] hover:text-black transition-all">
                                                            EXPORT DATA
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'agents' && (
                        <div className="animate-fade-in space-y-10">
                            <div>
                                <h2 className="text-xl font-black tracking-[8px] uppercase text-[#14F195]">AGENT REGISTRY</h2>
                                <p className="text-[9px] text-white/30 tracking-[4px] uppercase mt-2">ID VERIFICATION AND ENFORCEMENT</p>
                            </div>
                            
                            <div className="bg-white/2 border border-white/10 rounded-4xl overflow-hidden backdrop-blur-xl">
                                <table className="w-full text-left text-[11px] font-bold">
                                    <thead className="bg-black/60 text-white/40 uppercase tracking-[4px] border-b border-white/5 text-[9px]">
                                        <tr>
                                            <th className="px-12 py-8">AGENT IDENTITY</th>
                                            <th className="px-6 py-8 text-center uppercase">DISTANCE</th>
                                            <th className="px-6 py-8 text-center uppercase">OINKS</th>
                                            <th className="px-6 py-8 text-center uppercase">ID VERIFIED</th>
                                            <th className="px-12 py-8 text-right uppercase">OPERATIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {players.map((p) => (
                                            <tr key={p.wallet_address} className={`hover:bg-white/5 transition-all group ${p.is_banned ? 'opacity-30' : ''}`}>
                                                <td className="px-12 py-8">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-base font-black tracking-widest ${p.is_verified ? 'text-[#14F195]' : 'text-white'}`}>
                                                            {p.username || 'ANONYMOUS'}
                                                        </span>
                                                        <span className="text-[9px] font-mono text-white/20">{p.wallet_address.slice(0, 16)}...</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-8 text-center text-lg">{p.high_score.toLocaleString()}</td>
                                                <td className="px-6 py-8 text-center text-[#FFD700] text-lg">{p.oinks || 0}</td>
                                                <td className="px-6 py-8 text-center">
                                                    <button onClick={() => handleAction('TOGGLE_VERIFIED', { target_wallet: p.wallet_address })} className={`w-8 h-8 rounded-xl border-2 transition-all mx-auto flex items-center justify-center ${p.is_verified ? 'bg-[#14F195] border-[#14F195]' : 'bg-transparent border-white/10 hover:border-[#14F195]/40'}`}>
                                                        {p.is_verified && <span className="text-black text-xs">✓</span>}
                                                    </button>
                                                </td>
                                                <td className="px-12 py-8 text-right space-x-3">
                                                    <button onClick={() => handleAction('RESET_SCORE', { target_wallet: p.wallet_address })} className="px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-[2px] hover:text-white">
                                                        RESET
                                                    </button>
                                                    <button onClick={() => handleAction('TOGGLE_BAN', { target_wallet: p.wallet_address })} className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-[2px] transition-all ${p.is_banned ? 'bg-red-500 text-white' : 'bg-red-500/10 border border-red-500/20 text-red-500'}`}>
                                                        {p.is_banned ? 'UNBANNED' : 'EXPELL'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals Container */}
            <Modal
                isOpen={isTournamentModalOpen}
                title="DEPLOY NEW TOURNAMENT"
                onClose={() => setIsTournamentModalOpen(false)}
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-[#FFD700] tracking-[3px] uppercase">ZONE IDENTITY</label>
                        <input type="text" placeholder="LEADERBOARD NAME..." value={newTournament.name} onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value.toUpperCase() })} className="w-full h-14 bg-black/60 border-2 border-white/5 rounded-2xl px-6 text-white font-bold tracking-widest outline-none focus:border-[#FF9800]/40" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/40 tracking-[3px] uppercase">ENTRY FEE (MPIG)</label>
                            <input type="number" value={newTournament.entry_fee_mpig} onChange={(e) => setNewTournament({ ...newTournament, entry_fee_mpig: parseInt(e.target.value) })} className="w-full h-14 bg-black/60 border-2 border-white/5 rounded-2xl px-6 text-white font-bold tracking-widest outline-none focus:border-[#14F195]/20" />
                        </div>
                        <div className="flex items-end">
                            <button onClick={() => handleTournamentAction('CREATE', undefined, newTournament)} className="w-full h-14 bg-[#14F195] text-black font-black tracking-[4px] uppercase rounded-2xl transition-all shadow-xl">
                                DEPLOY ZONE
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isSkinModalOpen}
                title="DEPLOY NEW SKIN"
                onClose={() => setIsSkinModalOpen(false)}
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-[#14F195] tracking-[3px] uppercase">SKIN IDENTITY</label>
                        <input type="text" placeholder="SKIN NAME..." value={newSkin.name} onChange={(e) => setNewSkin({ ...newSkin, name: e.target.value.toUpperCase() })} className="w-full h-14 bg-black/60 border-2 border-white/5 rounded-2xl px-6 text-white font-bold tracking-widest outline-none focus:border-[#14F195]/40" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/40 tracking-[3px] uppercase">RARITY LEVEL</label>
                            <select value={newSkin.rarity} onChange={(e) => setNewSkin({ ...newSkin, rarity: e.target.value })} className="w-full h-14 bg-black/60 border-2 border-white/5 rounded-2xl px-6 text-white font-bold tracking-widest outline-none focus:border-[#9945FF]/40">
                                <option value="COMMON">COMMON</option>
                                <option value="RARE">RARE</option>
                                <option value="LEGENDARY">LEGENDARY</option>
                                <option value="LIMITED">LIMITED</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-white/40 tracking-[3px] uppercase">PRICE (MPIG)</label>
                            <input type="number" value={newSkin.price_mpig} onChange={(e) => setNewSkin({ ...newSkin, price_mpig: parseInt(e.target.value) })} className="w-full h-14 bg-black/60 border-2 border-white/5 rounded-2xl px-6 text-white font-bold tracking-widest outline-none focus:border-[#FFD700]/20" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/40 tracking-[3px] uppercase">ASSET URL</label>
                        <input type="text" value={newSkin.image_url} onChange={(e) => setNewSkin({ ...newSkin, image_url: e.target.value })} className="w-full h-14 bg-black/60 border-2 border-white/5 rounded-2xl px-6 text-white font-mono text-[10px] outline-none focus:border-white/20" />
                    </div>
                    <button onClick={() => handleSkinAction('CREATE', undefined, newSkin)} className="w-full h-16 bg-linear-to-r from-[#14F195] to-[#9945FF] text-white font-black tracking-[10px] uppercase rounded-2xl transition-all shadow-xl">
                        DEPLOY COSMETIC
                    </button>
                </div>
            </Modal>

            {/* Notification Modal */}
            {notification && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-fade-in pointer-events-auto">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setNotification(null)} />
                    <div className="w-full max-w-[400px] bg-white/2 border border-white/10 rounded-4xl p-10 backdrop-blur-3xl animate-zoom-in relative">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${notification.type === 'SUCCESS' ? 'bg-[#14F195]/20 text-[#14F195]' : notification.type === 'ERROR' ? 'bg-red-500/20 text-red-500' : 'bg-[#FFD700]/20 text-[#FFD700]'}`}>
                            <span className="text-3xl font-bold">{notification.type === 'SUCCESS' ? '✓' : notification.type === 'ERROR' ? '✕' : '!'}</span>
                        </div>
                        <h3 className={`text-sm font-black tracking-[8px] uppercase text-center mb-4 ${notification.type === 'SUCCESS' ? 'text-[#14F195]' : notification.type === 'ERROR' ? 'text-red-500' : 'text-[#FFD700]'}`}>
                            {notification.type} PROTOCOL
                        </h3>
                        <p className="text-white/40 text-[10px] tracking-[4px] uppercase text-center mb-10 leading-relaxed font-black">
                            {notification.message}
                        </p>
                        <button onClick={() => setNotification(null)} className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-white/60 text-[8px] font-black tracking-[4px] uppercase hover:bg-white/10 transition-all">
                            CONFIRM & CLOSE
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
