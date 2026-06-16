'use client';

import { Trophy, CalendarRange, MapPin, Thermometer, UserCheck, Loader2, BarChart2, Clock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Match } from '@/app/types';

interface MatchStatsProps {
    match: Match;
    servers: any[];
    BE_URL: string;
}

type TabType = 'info' | 'stats' | 'incidents' | 'lineups' | 'bxh' | 'h2h' | 'upcoming';
type LineupSubTab = 'formation' | 'starting' | 'injury';
type StatsSubTab = 'all' | 'half1';

export default function MatchStats({ match, servers, BE_URL }: MatchStatsProps) {
    const [activeTab, setActiveTab] = useState<TabType>('info');
    const [lineupSubTab, setLineupSubTab] = useState<LineupSubTab>('formation');
    const [statsSubTab, setStatsSubTab] = useState<StatsSubTab>('all');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

    // Tab data states
    const [matchData, setMatchData] = useState<any>(null);
    const [statsData, setStatsData] = useState<any>(null);
    const [incidentsData, setIncidentsData] = useState<any[]>([]);
    const [lineupsData, setLineupsData] = useState<any>(null);

    // 1. Try to find the correct Match ID from the list of servers or the main match ID
    useEffect(() => {
        if (!match) return;

        let mounted = true;
        const idsToCheck: string[] = [];

        // Add main match ID/slug
        if (match.id) idsToCheck.push(match.id);
        
        // Add all commentator/server IDs
        if (servers && servers.length > 0) {
            servers.forEach((s: any) => {
                if (s.commentatorId && !idsToCheck.includes(s.commentatorId)) {
                    idsToCheck.push(s.commentatorId);
                }
                if (s.slug && !idsToCheck.includes(s.slug)) {
                    idsToCheck.push(s.slug);
                }
            });
        }

        const resolveData = async () => {
            setIsLoading(true);
            setError(null);
            setMatchData(null);
            setStatsData(null);
            setIncidentsData([]);
            setLineupsData(null);

            let foundId: string | null = null;
            let resolvedMatchData: any = null;

            // Sequentially check IDs to find the one with valid statistics data
            for (const id of idsToCheck) {
                try {
                    const res = await fetch(`${BE_URL}/api/match/${id}/score-data/match`);
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success && json.data && json.data.code === 0 && json.data.data) {
                            foundId = id;
                            resolvedMatchData = json.data.data;
                            break; // Stop at first successful ID
                        }
                    }
                } catch (e) {
                    console.warn(`[MatchStats] Failed to resolve ID: ${id}`, e);
                }
            }

            if (!mounted) return;

            if (foundId && resolvedMatchData) {
                setActiveMatchId(foundId);
                setMatchData(resolvedMatchData);
                
                // Fetch the rest of the endpoints in parallel
                try {
                    const [statsRes, incidentsRes, lineupsRes] = await Promise.all([
                        fetch(`${BE_URL}/api/match/${foundId}/score-data/statistics`).then(r => r.json()),
                        fetch(`${BE_URL}/api/match/${foundId}/score-data/incidents`).then(r => r.json()),
                        fetch(`${BE_URL}/api/match/${foundId}/score-data/lineups`).then(r => r.json())
                    ]);

                    if (mounted) {
                        if (statsRes.success) setStatsData(statsRes.data?.data || null);
                        if (incidentsRes.success) setIncidentsData(incidentsRes.data?.data || []);
                        if (lineupsRes.success) setLineupsData(lineupsRes.data?.data || null);
                    }
                } catch (err) {
                    console.error("[MatchStats] Error fetching details:", err);
                }
                setIsLoading(false);
            } else {
                setActiveMatchId(null);
                setIsLoading(false);
                setError("Trận đấu này hiện tại chưa hỗ trợ bảng thống kê chi tiết.");
            }
        };

        resolveData();

        return () => {
            mounted = false;
        };
    }, [match, servers, BE_URL]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border-theme text-foreground/60 gap-4 mt-6 rounded-2xl">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
                <p className="text-sm font-semibold tracking-wide">Đang tải thống kê trận đấu...</p>
            </div>
        );
    }

    if (error || !matchData) {
        return (
            <div className="flex flex-col items-center justify-center py-10 bg-surface/60 border border-border-theme text-foreground/50 gap-2 mt-6 rounded-2xl">
                <span className="text-3xl">📊</span>
                <p className="text-sm font-semibold">{error || "Không tìm thấy dữ liệu thống kê."}</p>
            </div>
        );
    }

    // --- Weather helper ---
    const getWeatherText = (code: number) => {
        switch (code) {
            case 1: return 'Nắng ráo';
            case 2: return 'Nhiều mây';
            case 3: return 'U ám';
            case 4: return 'Mưa rào';
            case 5: return 'Có mưa';
            case 6: return 'Tuyết rơi';
            case 7: return 'Sương mù';
            default: return 'Bình thường';
        }
    };

    // --- Incident parser ---
    const getIncidentDetails = (inc: any) => {
        const type = Number(inc.type);
        switch (type) {
            case 1:
                return {
                    icon: '⚽',
                    title: 'Bàn thắng',
                    color: 'bg-green-600/10 border-green-500/20 text-green-500'
                };
            case 2:
                return {
                    icon: '🟥',
                    title: 'Thẻ đỏ',
                    color: 'bg-red-600/10 border-red-500/20 text-red-500'
                };
            case 3:
                return {
                    icon: '🟨',
                    title: 'Thẻ vàng',
                    color: 'bg-yellow-600/10 border-yellow-500/20 text-yellow-500'
                };
            case 4:
                return {
                    icon: '🟨🟥',
                    title: 'Thẻ vàng thứ 2',
                    color: 'bg-red-600/10 border-red-500/20 text-red-500'
                };
            case 7:
                return {
                    icon: '🥅',
                    title: 'Bàn thắng Penalty',
                    color: 'bg-green-600/10 border-green-500/20 text-green-500'
                };
            case 8:
                return {
                    icon: '🔴⚽',
                    title: 'Phản lưới nhà',
                    color: 'bg-red-600/10 border-red-500/20 text-red-500'
                };
            case 9:
                return {
                    icon: '⇅',
                    title: 'Thay người',
                    color: 'bg-sky-600/10 border-sky-500/20 text-sky-500'
                };
            case 11:
                return {
                    icon: '🎬',
                    title: 'Bắt đầu',
                    color: 'bg-gray-600/10 border-gray-500/20 text-gray-500'
                };
            case 15:
                return {
                    icon: '❌⚽',
                    title: 'Đá hỏng Penalty',
                    color: 'bg-red-600/10 border-red-500/20 text-red-500'
                };
            default:
                return {
                    icon: 'ℹ️',
                    title: 'Sự kiện',
                    color: 'bg-gray-600/10 border-gray-500/20 text-gray-500'
                };
        }
    };

    // --- Statistics processing ---
    const activeStatsObj = statsData ? statsData.find((s: any) => s.type === (statsSubTab === 'all' ? 0 : 1)) : null;
    const homeStats = activeStatsObj?.stats?.[0] || {};
    const awayStats = activeStatsObj?.stats?.[1] || {};

    const statsList = [
        { key: 'ball_possession', label: 'Kiểm soát bóng', isPercent: true },
        { key: 'goals', label: 'Bàn thắng' },
        { key: 'shots', label: 'Sút bóng' },
        { key: 'shots_on_target', label: 'Sút cầu môn' },
        { key: 'corner_kicks', label: 'Phạt góc' },
        { key: 'passes', label: 'Chuyền bóng' },
        { key: 'passes_accuracy', label: 'Chuyền bóng thành công', isPassAcc: true },
        { key: 'dribble', label: 'Rê bóng' },
        { key: 'dribble_succ', label: 'Rê bóng thành công' },
        { key: 'interceptions', label: 'Đánh chặn' },
        { key: 'tackles', label: 'Cản phá' },
        { key: 'saves', label: 'Cứu thua' },
        { key: 'yellow_cards', label: 'Thẻ vàng' },
        { key: 'red_cards', label: 'Thẻ đỏ' },
        { key: 'offsides', label: 'Việt vị' },
        { key: 'freekicks', label: 'Đá phạt' },
        { key: 'attacks', label: 'Tấn công' },
        { key: 'dangerous_attack', label: 'Tấn công nguy hiểm' },
    ];

    // --- Lineup processing ---
    const homeStarting = lineupsData?.lineup?.home?.filter((p: any) => p.first === 1) || [];
    const awayStarting = lineupsData?.lineup?.away?.filter((p: any) => p.first === 1) || [];
    const homeSubs = lineupsData?.lineup?.home?.filter((p: any) => p.first === 0) || [];
    const awaySubs = lineupsData?.lineup?.away?.filter((p: any) => p.first === 0) || [];
    const homeInjuries = lineupsData?.injury?.home || [];
    const awayInjuries = lineupsData?.injury?.away || [];

    return (
        <div className="w-full bg-surface border border-border-theme rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col gap-6 mt-6 text-foreground transition-all duration-300">
            
            {/* 1. Gold Header */}
            <div className="flex items-center gap-3 border-b border-border-theme pb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500">
                    <BarChart2 className="w-5 h-5" />
                </div>
                <h3 className="text-base md:text-lg font-bold tracking-wider text-amber-500 uppercase">
                    Thống kê trận đấu
                </h3>
            </div>

            {/* 2. Tabs Bar */}
            <div className="w-full overflow-x-auto hide-scrollbar">
                <div className="flex bg-gray-100 dark:bg-[#181d29]/40 p-1 rounded-xl border border-border-theme min-w-[640px] transition-colors duration-300">
                    {[
                        { id: 'info', label: 'Thông tin' },
                        { id: 'stats', label: 'Thông số' },
                        { id: 'incidents', label: 'Tóm tắt' },
                        { id: 'lineups', label: 'Đội hình' },
                        { id: 'bxh', label: 'BXH' },
                        { id: 'h2h', label: 'Đối đầu' },
                        { id: 'upcoming', label: 'Trận sắp tới' }
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex-1 text-center py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 ${
                                    isActive
                                        ? 'bg-white dark:bg-[#222938] text-amber-600 dark:text-amber-500 border border-amber-500/20 shadow-md'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-foreground hover:bg-white/50 dark:hover:bg-white/[0.02]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 3. Tiếu Lâm TV Affiliate Text */}
            <div className="text-center bg-amber-500/5 border border-amber-500/10 rounded-lg py-2 text-[11px] md:text-xs text-amber-500 dark:text-amber-400 font-medium leading-relaxed">
                Ae nhớ lưu lại link <span className="font-bold underline text-foreground">bit.ly/tieulamtv</span> để truy cập website của <span className="font-bold text-amber-500">Tiếu Lâm TV</span>
            </div>

            {/* 4. Tab Content Area */}
            <div className="flex-1">

                {/* --- TAB 1: THÔNG TIN --- */}
                {activeTab === 'info' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Giải đấu */}
                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme p-4 rounded-xl transition-colors duration-300">
                            {matchData.competition?.logo ? (
                                <img src={matchData.competition.logo} alt="League" className="w-12 h-12 object-contain" />
                            ) : (
                                <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500"><Trophy className="w-6 h-6" /></div>
                            )}
                            <div>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 block uppercase font-medium">Giải đấu</span>
                                <span className="text-sm font-bold text-foreground">{matchData.competition?.name || 'Không rõ'}</span>
                            </div>
                        </div>

                        {/* Vòng thi đấu */}
                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme p-4 rounded-xl transition-colors duration-300">
                            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
                                <CalendarRange className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 block uppercase font-medium">Vòng thi đấu</span>
                                <span className="text-sm font-bold text-foreground">Vòng {matchData.round?.round_num || '1'}</span>
                            </div>
                        </div>

                        {/* Sân vận động */}
                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme p-4 rounded-xl transition-colors duration-300">
                            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
                                <MapPin className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 block uppercase font-medium">Sân vận động</span>
                                <span className="text-sm font-bold text-foreground">
                                    {matchData.venue?.name || 'Không rõ'} {matchData.venue?.capacity ? `(${matchData.venue.capacity.toLocaleString()} chỗ)` : ''}
                                </span>
                            </div>
                        </div>

                        {/* Nhiệt độ / Thời tiết */}
                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme p-4 rounded-xl transition-colors duration-300">
                            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
                                <Thermometer className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 block uppercase font-medium">Thời tiết & Nhiệt độ</span>
                                <span className="text-sm font-bold text-foreground">
                                    {matchData.environment?.temperature || '19°C'} - {getWeatherText(matchData.environment?.weather || 5)} {matchData.environment?.humidity ? `(Độ ẩm ${matchData.environment.humidity})` : ''}
                                </span>
                            </div>
                        </div>

                        {/* Trọng tài */}
                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme p-4 rounded-xl md:col-span-2 transition-colors duration-300">
                            {matchData.referee?.logo ? (
                                <img src={matchData.referee.logo} alt="Referee" className="w-12 h-12 rounded-full object-cover border border-border-theme bg-[#222938]" />
                            ) : (
                                <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500"><UserCheck className="w-6 h-6" /></div>
                            )}
                            <div className="flex-1 flex justify-between items-center pr-2">
                                <div>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block uppercase font-medium">Trọng tài chính</span>
                                    <span className="text-sm font-bold text-foreground">{matchData.referee?.name || 'Đang cập nhật...'}</span>
                                </div>
                                {matchData.home_team?.country_logo && (
                                    <img src={matchData.home_team.country_logo} alt="Flag" className="w-6 h-4 object-cover shadow-sm rounded-sm" />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 2: THÔNG SỐ --- */}
                {activeTab === 'stats' && (
                    <div className="flex flex-col gap-6">
                        {/* Sub tabs */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStatsSubTab('all')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    statsSubTab === 'all'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
                                }`}
                            >
                                CẢ TRẬN
                            </button>
                            <button
                                onClick={() => setStatsSubTab('half1')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    statsSubTab === 'half1'
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
                                }`}
                            >
                                HIỆP 1
                            </button>
                        </div>

                        {/* List of statistics */}
                        {!activeStatsObj ? (
                            <div className="text-center py-10 text-gray-500 text-sm">Chưa có thông số trận đấu tại thời điểm này.</div>
                        ) : (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                                {statsList.map((stat) => {
                                    let homeVal = homeStats[stat.key];
                                    let awayVal = awayStats[stat.key];

                                    if (homeVal === undefined && awayVal === undefined) return null;

                                    homeVal = homeVal || 0;
                                    awayVal = awayVal || 0;

                                    let homeLabel = String(homeVal);
                                    let awayLabel = String(awayVal);

                                    // Special formatting
                                    if (stat.isPercent) {
                                        homeLabel = `${homeVal}%`;
                                        awayLabel = `${awayVal}%`;
                                    } else if (stat.isPassAcc) {
                                        const homeTotal = homeStats['passes'] || 1;
                                        const awayTotal = awayStats['passes'] || 1;
                                        homeLabel = `${homeVal} (${Math.round((homeVal / homeTotal) * 100)}%)`;
                                        awayLabel = `${awayVal} (${Math.round((awayVal / awayTotal) * 100)}%)`;
                                    }

                                    // Calculate progress bar percentages
                                    let homePercent = 50;
                                    let awayPercent = 50;
                                    const total = homeVal + awayVal;
                                    if (total > 0) {
                                        homePercent = (homeVal / total) * 100;
                                        awayPercent = (awayVal / total) * 100;
                                    }

                                    return (
                                        <div key={stat.key} className="flex flex-col gap-1.5 bg-gray-50/50 dark:bg-[#181d29]/20 border border-border-theme p-2.5 rounded-xl transition-colors duration-300">
                                            {/* Labels */}
                                            <div className="flex justify-between items-center text-xs md:text-sm font-semibold">
                                                <span className="text-sky-500 dark:text-sky-400">{homeLabel}</span>
                                                <span className="text-gray-600 dark:text-gray-400 text-[10px] md:text-xs bg-gray-200/60 dark:bg-gray-800/50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                    {stat.label}
                                                </span>
                                                <span className="text-emerald-600 dark:text-emerald-400">{awayLabel}</span>
                                            </div>
                                            {/* Progress bars */}
                                            <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 transition-colors duration-300">
                                                {/* Left / Home: blue */}
                                                <div 
                                                    style={{ width: `${homePercent}%` }} 
                                                    className="bg-sky-500 rounded-l-full border-r border-white dark:border-[#121620]" 
                                                />
                                                {/* Right / Away: green */}
                                                <div 
                                                    style={{ width: `${awayPercent}%` }} 
                                                    className="bg-emerald-500 rounded-r-full" 
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB 3: TÓM TẮT (TREE TIMELINE LAYOUT) --- */}
                {activeTab === 'incidents' && (
                    <div className="flex flex-col gap-6">
                        {/* Timeline tree container */}
                        <div className="relative flex flex-col py-4 max-h-[500px] overflow-y-auto pr-1">
                            
                            {/* Central Vertical Line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gray-200 dark:bg-gray-800 -translate-x-1/2 z-0" />

                            {incidentsData.length === 0 ? (
                                <div className="text-center py-10 text-gray-500 text-sm z-10">Chưa có sự kiện nổi bật nào được ghi nhận.</div>
                            ) : (
                                incidentsData
                                    .sort((a, b) => Number(b.time) - Number(a.time)) // Newest at top
                                    .map((inc, index) => {
                                        const details = getIncidentDetails(inc);
                                        const isHome = inc.position === 1;
                                        const isAway = inc.position === 2;
                                        const isNeutral = inc.position === 0;

                                        // Substitution details
                                        const playerIn = inc.type === 9 ? (inc.player_in || inc.assist1) : null;
                                        const playerOut = inc.type === 9 ? inc.player : null;

                                        return (
                                            <div key={index} className="relative flex items-center w-full py-4 z-10">
                                                
                                                {/* Time Marker on far left */}
                                                <div className="absolute left-4 text-xs md:text-sm font-bold text-gray-400 w-12">
                                                    {inc.time}&apos;
                                                </div>

                                                {/* Tree Row */}
                                                <div className="flex-1 flex items-center relative pl-16 md:pl-0">
                                                    
                                                    {/* Home Side Content (Left Column) */}
                                                    <div className="w-1/2 pr-6 flex items-center justify-end gap-2 text-right">
                                                        {isHome && (
                                                            <>
                                                                {/* Substitution layout */}
                                                                {inc.type === 9 ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex flex-col text-xs text-right">
                                                                            <span className="font-bold text-foreground">{playerIn?.name || 'N/A'}</span>
                                                                            {playerOut && <span className="text-[10px] text-gray-400">{playerOut.name}</span>}
                                                                        </div>
                                                                        <div className="relative w-10 h-7 flex items-center justify-end shrink-0">
                                                                            {playerOut?.logo && (
                                                                                <img src={playerOut.logo} alt="Out" className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-800 object-cover bg-gray-700 absolute right-4 z-0 opacity-50" onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }} />
                                                                            )}
                                                                            {playerIn?.logo && (
                                                                                <img src={playerIn.logo} alt="In" className="w-6 h-6 rounded-full border border-white dark:border-gray-800 object-cover bg-gray-700 z-10" onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }} />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* Standard home details */
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex flex-col text-xs text-right">
                                                                            <span className="font-bold text-foreground">{inc.player?.name || 'Cầu thủ'}</span>
                                                                            {inc.assist1 && <span className="text-[9px] text-gray-400">{inc.assist1.name}</span>}
                                                                        </div>
                                                                        {inc.player?.logo && (
                                                                            <img src={inc.player.logo} alt="Player" className="w-7 h-7 rounded-full object-cover border border-gray-300 dark:border-gray-800 bg-[#222938]" onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }} />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* Score capsule for Away goals on the Left side */}
                                                        {isAway && (inc.type === 1 || inc.type === 7 || inc.type === 8) && (
                                                            <span className="text-[10px] md:text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-0.5 rounded-full border border-border-theme">
                                                                {inc.home_score} - {inc.away_score}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Center node */}
                                                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
                                                        {isNeutral ? (
                                                            /* Period badges HT/FT */
                                                            inc.type === 19 ? (
                                                                <span className="bg-blue-600 text-white text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border border-blue-500 shadow-md whitespace-nowrap z-20">
                                                                    HT {inc.home_score} : {inc.away_score}
                                                                </span>
                                                            ) : (
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-md z-10 bg-surface ${details.color}`}>
                                                                    <span className="text-base">{details.icon}</span>
                                                                </div>
                                                            )
                                                        ) : (
                                                            /* Standard event node icon */
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-md z-10 bg-white dark:bg-[#1a202c] border-border-theme`}>
                                                                <span className="text-base">{details.icon}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Away Side Content (Right Column) */}
                                                    <div className="w-1/2 pl-6 flex items-center justify-start gap-2 text-left">
                                                        {isAway && (
                                                            <>
                                                                {/* Substitution layout */}
                                                                {inc.type === 9 ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="relative w-10 h-7 flex items-center shrink-0">
                                                                            {playerIn?.logo && (
                                                                                <img src={playerIn.logo} alt="In" className="w-6 h-6 rounded-full border border-white dark:border-gray-800 object-cover bg-gray-700 z-10" onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }} />
                                                                            )}
                                                                            {playerOut?.logo && (
                                                                                <img src={playerOut.logo} alt="Out" className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-800 object-cover bg-gray-700 absolute left-4 z-0 opacity-50" onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }} />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-col text-xs text-left">
                                                                            <span className="font-bold text-foreground">{playerIn?.name || 'N/A'}</span>
                                                                            {playerOut && <span className="text-[10px] text-gray-400">{playerOut.name}</span>}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    /* Standard away details */
                                                                    <div className="flex items-center gap-2">
                                                                        {inc.player?.logo && (
                                                                            <img src={inc.player.logo} alt="Player" className="w-7 h-7 rounded-full object-cover border border-gray-300 dark:border-gray-800 bg-[#222938]" onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }} />
                                                                        )}
                                                                        <div className="flex flex-col text-xs text-left">
                                                                            <span className="font-bold text-foreground">{inc.player?.name || 'Cầu thủ'}</span>
                                                                            {inc.assist1 && <span className="text-[9px] text-gray-400">{inc.assist1.name}</span>}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        {/* Score capsule for Home goals on the Right side */}
                                                        {isHome && (inc.type === 1 || inc.type === 7 || inc.type === 8) && (
                                                            <span className="text-[10px] md:text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-0.5 rounded-full border border-border-theme">
                                                                {inc.home_score} - {inc.away_score}
                                                            </span>
                                                        )}
                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    })
                            )}

                            {/* Clock icon at the bottom of the timeline line */}
                            {incidentsData.length > 0 && (
                                <div className="relative flex items-center justify-center py-2 w-full">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 shadow z-10">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Event legend at the bottom */}
                        {incidentsData.length > 0 && (
                            <div className="border-t border-border-theme pt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1"><span>⚽</span><span>Bàn thắng</span></div>
                                <div className="flex items-center gap-1"><span>🔴⚽</span><span>Phản lưới nhà</span></div>
                                <div className="flex items-center gap-1"><span>🟨</span><span>Thẻ vàng</span></div>
                                <div className="flex items-center gap-1"><span>🟥</span><span>Thẻ đỏ</span></div>
                                <div className="flex items-center gap-1"><span>🟨🟥</span><span>Thẻ vàng thứ hai</span></div>
                                <div className="flex items-center gap-1"><span>🥅</span><span>Penalty</span></div>
                                <div className="flex items-center gap-1"><span>⇅</span><span>Thay người</span></div>
                                <div className="flex items-center gap-1"><span>🚑</span><span>Chấn thương</span></div>
                                <div className="flex items-center gap-1"><span>📺</span><span>Check var</span></div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB 4: ĐỘI HÌNH --- */}
                {activeTab === 'lineups' && (
                    <div className="flex flex-col gap-4">
                        {/* Sub-tabs bar */}
                        <div className="flex gap-2 border-b border-border-theme pb-3">
                            {[
                                { id: 'formation', label: 'SƠ ĐỒ' },
                                { id: 'starting', label: 'RA SÂN' },
                                { id: 'injury', label: 'CHẤN THƯƠNG & TREO GIÒ' }
                            ].map((subTab) => (
                                <button
                                    key={subTab.id}
                                    onClick={() => setLineupSubTab(subTab.id as LineupSubTab)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                                        lineupSubTab === subTab.id
                                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-500'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-foreground'
                                    }`}
                                >
                                    {subTab.label}
                                </button>
                            ))}
                        </div>

                        {/* LINEUP TAB 1: SƠ ĐỒ SÂN BÓNG */}
                        {lineupSubTab === 'formation' && (
                            <div className="flex flex-col gap-6 max-h-[700px] overflow-y-auto pr-1">
                                
                                {/* Home Team Pitch */}
                                <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#181d29]/60 border border-border-theme rounded-xl p-3 transition-colors duration-300">
                                    <div className="flex justify-between items-center text-xs md:text-sm font-bold text-foreground px-1">
                                        <div className="flex items-center gap-2">
                                            {matchData.home_team?.logo && <img src={matchData.home_team.logo} alt="Logo" className="w-5 h-5 object-contain" />}
                                            <span>{matchData.home_team?.name} ({lineupsData?.home_formation || '4-4-2'})</span>
                                        </div>
                                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Huấn luyện viên: {lineupsData?.coach?.home?.name || matchData.coach?.home?.name || 'N/A'}</span>
                                    </div>
                                    
                                    {/* Football Pitch Container */}
                                    <div className="relative w-full aspect-[4/3] max-w-[600px] mx-auto bg-[#1b4332] rounded-xl overflow-hidden border border-emerald-900/60 shadow-inner">
                                        {/* Pitch Markings */}
                                        <div className="absolute inset-4 border border-white/10 pointer-events-none">
                                            {/* Midfield line */}
                                            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/10" />
                                            {/* Center circle */}
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border border-white/10" />
                                            {/* Penalty area (top half) */}
                                            <div className="absolute top-0 left-1/4 right-1/4 h-16 border-b border-x border-white/10" />
                                            {/* Goal area */}
                                            <div className="absolute top-0 left-[38%] right-[38%] h-6 border-b border-x border-white/10" />
                                        </div>

                                        {/* Players */}
                                        {homeStarting.map((player: any) => (
                                            <div
                                                key={player.id}
                                                style={{ left: `${player.x}%`, top: `${player.y}%` }}
                                                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none"
                                            >
                                                <div className="relative">
                                                    <img 
                                                        src={player.logo || 'https://img.thesports.com/football/player/default.png'} 
                                                        alt={player.name}
                                                        className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-white object-cover bg-emerald-800 shadow"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }}
                                                    />
                                                    {player.rating && player.rating !== "0.0" && (
                                                        <span className="absolute -top-1 -right-1.5 bg-emerald-600 text-white text-[8px] font-bold px-0.5 rounded shadow-sm">
                                                            {player.rating}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[8px] md:text-[9px] font-semibold text-white bg-black/60 px-1 py-0.5 rounded mt-1 truncate max-w-[65px] text-center shadow-sm">
                                                    {player.shirt_number}. {player.short_name || player.name.split(' ').pop()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Away Team Pitch (Flipped Y) */}
                                <div className="flex flex-col gap-2 bg-gray-50 dark:bg-[#181d29]/60 border border-border-theme rounded-xl p-3 transition-colors duration-300">
                                    <div className="flex justify-between items-center text-xs md:text-sm font-bold text-foreground px-1">
                                        <div className="flex items-center gap-2">
                                            {matchData.away_team?.logo && <img src={matchData.away_team.logo} alt="Logo" className="w-5 h-5 object-contain" />}
                                            <span>{matchData.away_team?.name} ({lineupsData?.away_formation || '4-2-3-1'})</span>
                                        </div>
                                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Huấn luyện viên: {lineupsData?.coach?.away?.name || matchData.coach?.away?.name || 'N/A'}</span>
                                    </div>
                                    
                                    {/* Football Pitch Container */}
                                    <div className="relative w-full aspect-[4/3] max-w-[600px] mx-auto bg-[#1b4332] rounded-xl overflow-hidden border border-emerald-900/60 shadow-inner">
                                        {/* Pitch Markings */}
                                        <div className="absolute inset-4 border border-white/10 pointer-events-none">
                                            {/* Midfield line */}
                                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/10" />
                                            {/* Center circle */}
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border border-white/10" />
                                            {/* Penalty area (bottom half) */}
                                            <div className="absolute bottom-0 left-1/4 right-1/4 h-16 border-t border-x border-white/10" />
                                            {/* Goal area */}
                                            <div className="absolute bottom-0 left-[38%] right-[38%] h-6 border-t border-x border-white/10" />
                                        </div>

                                        {/* Players */}
                                        {awayStarting.map((player: any) => (
                                            <div
                                                key={player.id}
                                                style={{ left: `${player.x}%`, top: `${100 - player.y}%` }}
                                                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none"
                                            >
                                                <div className="relative">
                                                    <img 
                                                        src={player.logo || 'https://img.thesports.com/football/player/default.png'} 
                                                        alt={player.name}
                                                        className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-white object-cover bg-emerald-800 shadow"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }}
                                                    />
                                                    {player.rating && player.rating !== "0.0" && (
                                                        <span className="absolute -top-1 -right-1.5 bg-emerald-600 text-white text-[8px] font-bold px-0.5 rounded shadow-sm">
                                                            {player.rating}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[8px] md:text-[9px] font-semibold text-white bg-black/60 px-1 py-0.5 rounded mt-1 truncate max-w-[65px] text-center shadow-sm">
                                                    {player.shirt_number}. {player.short_name || player.name.split(' ').pop()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* LINEUP TAB 2: DANH SÁCH RA SÂN */}
                        {lineupSubTab === 'starting' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[500px] overflow-y-auto pr-1">
                                
                                {/* Home Team List */}
                                <div className="bg-gray-50 dark:bg-[#181d29] border border-border-theme rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300">
                                    <h4 className="text-sm font-bold text-sky-600 dark:text-sky-400 border-b border-border-theme pb-2 flex items-center justify-between">
                                        <span>{matchData.home_team?.name}</span>
                                        <span className="text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded uppercase">Đội hình chính</span>
                                    </h4>
                                    <div className="space-y-2">
                                        {homeStarting.map((p: any) => (
                                            <div key={p.id} className="flex justify-between items-center text-xs py-1 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded px-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-5 text-gray-400 dark:text-gray-500 font-bold">{p.shirt_number}</span>
                                                    <img src={p.logo} alt="avatar" className="w-6 h-6 rounded-full object-cover bg-gray-200 dark:bg-gray-800" onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }} />
                                                    <span className="font-semibold text-foreground">{p.name}</span>
                                                    <span className="text-[10px] text-gray-500 font-medium bg-gray-200 dark:bg-gray-800/40 px-1 py-0.2 rounded uppercase">{p.position}</span>
                                                </div>
                                                {p.rating && p.rating !== "0.0" && (
                                                    <span className="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                        {p.rating}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Substitutes */}
                                    <h4 className="text-xs font-bold text-gray-400 border-b border-border-theme pt-4 pb-2 uppercase">Dự bị</h4>
                                    <div className="space-y-2">
                                        {homeSubs.length === 0 ? (
                                            <span className="text-xs text-gray-500">Chưa có thông tin dự bị</span>
                                        ) : (
                                            homeSubs.map((p: any) => (
                                                <div key={p.id} className="flex justify-between items-center text-xs py-1 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded px-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-5 text-gray-400 dark:text-gray-500 font-bold">{p.shirt_number}</span>
                                                        <span className="font-medium text-foreground">{p.name}</span>
                                                        <span className="text-[10px] text-gray-500 font-medium bg-gray-200 dark:bg-gray-800/40 px-1 py-0.2 rounded uppercase">{p.position}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Away Team List */}
                                <div className="bg-gray-50 dark:bg-[#181d29] border border-border-theme rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300">
                                    <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 border-b border-border-theme pb-2 flex items-center justify-between">
                                        <span>{matchData.away_team?.name}</span>
                                        <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded uppercase">Đội hình chính</span>
                                    </h4>
                                    <div className="space-y-2">
                                        {awayStarting.map((p: any) => (
                                            <div key={p.id} className="flex justify-between items-center text-xs py-1 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded px-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-5 text-gray-400 dark:text-gray-500 font-bold">{p.shirt_number}</span>
                                                    <img src={p.logo} alt="avatar" className="w-6 h-6 rounded-full object-cover bg-gray-200 dark:bg-gray-800" onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/player/default.png'; }} />
                                                    <span className="font-semibold text-foreground">{p.name}</span>
                                                    <span className="text-[10px] text-gray-500 font-medium bg-gray-200 dark:bg-gray-800/40 px-1 py-0.2 rounded uppercase">{p.position}</span>
                                                </div>
                                                {p.rating && p.rating !== "0.0" && (
                                                    <span className="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                        {p.rating}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Substitutes */}
                                    <h4 className="text-xs font-bold text-gray-400 border-b border-border-theme pt-4 pb-2 uppercase">Dự bị</h4>
                                    <div className="space-y-2">
                                        {awaySubs.length === 0 ? (
                                            <span className="text-xs text-gray-500">Chưa có thông tin dự bị</span>
                                        ) : (
                                            awaySubs.map((p: any) => (
                                                <div key={p.id} className="flex justify-between items-center text-xs py-1 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded px-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-5 text-gray-400 dark:text-gray-500 font-bold">{p.shirt_number}</span>
                                                        <span className="font-medium text-foreground">{p.name}</span>
                                                        <span className="text-[10px] text-gray-500 font-medium bg-gray-200 dark:bg-gray-800/40 px-1 py-0.2 rounded uppercase">{p.position}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* LINEUP TAB 3: CHẤN THƯƠNG & TREO GIÒ */}
                        {lineupSubTab === 'injury' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Home Team Injuries */}
                                <div className="bg-gray-50 dark:bg-[#181d29] border border-border-theme rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300">
                                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-300 border-b border-border-theme pb-2 uppercase">
                                        {matchData.home_team?.name}
                                    </h4>
                                    {homeInjuries.length === 0 ? (
                                        <div className="text-center py-6 text-gray-500 text-xs">Không có thông tin chấn thương hay treo giò.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {homeInjuries.map((p: any) => (
                                                <div key={p.id} className="flex justify-between items-center bg-gray-100 dark:bg-[#222938]/30 border border-border-theme p-2.5 rounded-lg text-xs transition-colors duration-300">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">🚑</span>
                                                        <div>
                                                            <span className="font-bold block text-foreground">{p.shirt_number ? `#${p.shirt_number} ` : ''}{p.name}</span>
                                                            <span className="text-[10px] text-gray-500 uppercase">{p.position} - {p.reason || 'Chấn thương'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Away Team Injuries */}
                                <div className="bg-gray-50 dark:bg-[#181d29] border border-border-theme rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300">
                                    <h4 className="text-xs font-bold text-gray-400 dark:text-gray-300 border-b border-border-theme pb-2 uppercase">
                                        {matchData.away_team?.name}
                                    </h4>
                                    {awayInjuries.length === 0 ? (
                                        <div className="text-center py-6 text-gray-500 text-xs">Không có thông tin chấn thương hay treo giò.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {awayInjuries.map((p: any) => (
                                                <div key={p.id} className="flex justify-between items-center bg-gray-100 dark:bg-[#222938]/30 border border-border-theme p-2.5 rounded-lg text-xs transition-colors duration-300">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">🚑</span>
                                                        <div>
                                                            <span className="font-bold block text-foreground">{p.shirt_number ? `#${p.shirt_number} ` : ''}{p.name}</span>
                                                            <span className="text-[10px] text-gray-500 uppercase">{p.position} - {p.reason || 'Chấn thương'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB 5: BXH (PLACEHOLDER) --- */}
                {activeTab === 'bxh' && (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl transition-colors duration-300">
                        <span className="text-3xl block mb-2">📊</span>
                        <p className="text-sm font-semibold mb-1">Bảng xếp hạng đang được cập nhật</p>
                        <p className="text-xs text-gray-400">Dữ liệu BXH cho giải đấu {matchData.competition?.name} sẽ xuất hiện tại đây.</p>
                    </div>
                )}

                {/* --- TAB 6: ĐỐI ĐẦU (PLACEHOLDER) --- */}
                {activeTab === 'h2h' && (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl transition-colors duration-300">
                        <span className="text-3xl block mb-2">⚔️</span>
                        <p className="text-sm font-semibold mb-1">Lịch sử đối đầu</p>
                        <p className="text-xs text-gray-400">Thống kê các trận đối đầu gần đây giữa {matchData.home_team?.name} và {matchData.away_team?.name} đang được xử lý.</p>
                    </div>
                )}

                {/* --- TAB 7: TRẬN SẮP TỚI (PLACEHOLDER) --- */}
                {activeTab === 'upcoming' && (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl transition-colors duration-300">
                        <span className="text-3xl block mb-2">📅</span>
                        <p className="text-sm font-semibold mb-1">Trận đấu tiếp theo</p>
                        <p className="text-xs text-gray-400">Danh sách các trận đấu sắp tới của hai đội bóng sẽ sớm được cập nhật.</p>
                    </div>
                )}

            </div>
        </div>
    );
}
