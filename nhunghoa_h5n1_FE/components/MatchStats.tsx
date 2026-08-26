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

    // Dynamic states for standing and H2H/upcoming tabs
    const [standingData, setStandingData] = useState<any>(null);
    const [isStandingLoading, setIsStandingLoading] = useState(false);

    const [h2hData, setH2HData] = useState<any>(null);
    const [isH2HLoading, setIsH2HLoading] = useState(false);

    const [h2hSubTab, setH2HSubTab] = useState<'home' | 'all' | 'away'>('all');
    const [upcomingSubTab, setUpcomingSubTab] = useState<'home' | 'away'>('home');

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
            setStandingData(null);
            setH2HData(null);

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

    // Fetch standing data when BXH tab is clicked and we have a competition_id / season_id
    useEffect(() => {
        if (activeTab === 'bxh' && matchData?.season_id && !standingData && !isStandingLoading) {
            const fetchStanding = async () => {
                setIsStandingLoading(true);
                try {
                    const res = await fetch(`${BE_URL}/api/match/${matchData.season_id}/score-data/standing`);
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success && json.data?.data) {
                            setStandingData(json.data.data);
                        }
                    }
                } catch (e) {
                    console.error("[MatchStats] Failed to fetch standings:", e);
                } finally {
                    setIsStandingLoading(false);
                }
            };
            fetchStanding();
        }
    }, [activeTab, matchData, BE_URL, standingData, isStandingLoading]);

    // Fetch H2H data when H2H or Upcoming tabs are clicked and we have activeMatchId
    useEffect(() => {
        const isH2HOrUpcoming = activeTab === 'h2h' || activeTab === 'upcoming';
        if (isH2HOrUpcoming && activeMatchId && !h2hData && !isH2HLoading) {
            const fetchH2H = async () => {
                setIsH2HLoading(true);
                try {
                    const res = await fetch(`${BE_URL}/api/match/${activeMatchId}/score-data/h2h`);
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success && json.data?.data) {
                            setH2HData(json.data.data);
                        }
                    }
                } catch (e) {
                    console.error("[MatchStats] Failed to fetch H2H:", e);
                } finally {
                    setIsH2HLoading(false);
                }
            };
            fetchH2H();
        }
    }, [activeTab, activeMatchId, BE_URL, h2hData, isH2HLoading]);

    // Helpers
    const getTeamFlag = (teamName: string, teamId?: string) => {
        if (matchData) {
            if (teamId === matchData.home_team?.id && matchData.home_team?.logo) {
                return matchData.home_team.logo;
            }
            if (teamId === matchData.away_team?.id && matchData.away_team?.logo) {
                return matchData.away_team.logo;
            }
            if (teamName.toLowerCase() === matchData.home_team?.name?.toLowerCase() && matchData.home_team?.logo) {
                return matchData.home_team.logo;
            }
            if (teamName.toLowerCase() === matchData.away_team?.name?.toLowerCase() && matchData.away_team?.logo) {
                return matchData.away_team.logo;
            }
        }

        const name = teamName.toLowerCase().trim();
        const countryMap: Record<string, string> = {
            'iran': 'ir', 'ir iran': 'ir', 'new zealand': 'nz', 'brazil': 'br',
            'netherlands': 'nl', 'hà lan': 'nl', 'egypt': 'eg', 'ai cập': 'eg',
            'morocco': 'ma', 'ma-rốc': 'ma', 'qatar': 'qa', 'spain': 'es', 'tây ban nha': 'es',
            'austria': 'at', 'áo': 'at', 'belgium': 'be', 'bỉ': 'be', 'mali': 'ml',
            'gambia': 'gm', 'switzerland': 'ch', 'thụy sỹ': 'ch', 'thụy sĩ': 'ch',
            'canada': 'ca', 'haiti': 'ht', 'china': 'cn', 'trung quốc': 'cn',
            'jordan': 'jo', 'saudi arabia': 'sa', 'ả rập xê út': 'sa',
            'cabo verde': 'cv', 'sweden': 'se', 'thụy điển': 'se', 'japan': 'jp', 'nhật bản': 'jp',
            'afghanistan': 'af', 'tanzania': 'tz', 'samoa': 'ws', 'new caledonia': 'nc',
            'vietnam': 'vn', 'việt nam': 'vn'
        };

        const code = countryMap[name];
        if (code) {
            return `https://flagcdn.com/w40/${code}.png`;
        }
        return 'https://img.thesports.com/football/team/default.png';
    };

    const getGroupName = (table: any) => {
        if (table.conference) {
            if (table.conference === 'Ranking of third placed teams') {
                return 'BXH các đội xếp thứ 3';
            }
            return table.conference;
        }
        if (table.group > 0 && table.group <= 26) {
            const char = String.fromCharCode(64 + table.group);
            return `Bảng ${char}`;
        }
        return `Bảng đấu ${table.group || ''}`;
    };

    const getMatchResult = (m: any, activeTeamId: string) => {
        const homeTeamId = m[5][0];
        const awayTeamId = m[6][0];
        const homeScore = Number(m[5][2] || 0);
        const awayScore = Number(m[6][2] || 0);

        const isActiveHome = homeTeamId === activeTeamId;
        const isActiveAway = awayTeamId === activeTeamId;

        if (!isActiveHome && !isActiveAway) return { text: 'N/A', color: 'bg-gray-500' };

        const activeScore = isActiveHome ? homeScore : awayScore;
        const oppScore = isActiveHome ? awayScore : homeScore;

        if (activeScore > oppScore) {
            return { text: 'Thắng', color: 'bg-emerald-600' };
        } else if (activeScore < oppScore) {
            return { text: 'Thua', color: 'bg-red-600' };
        } else {
            return { text: 'Hòa', color: 'bg-gray-500' };
        }
    };

    const formatMatchTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${hours}:${minutes} ${day}/${month}`;
    };

    const renderH2HMatchList = (matches: any[], activeTeamId: string) => {
        if (!matches || matches.length === 0) {
            return (
                <div className="text-center py-4 text-gray-500 text-xs italic">
                    Không có dữ liệu trận đấu.
                </div>
            );
        }
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((m: any) => {
                    const matchId = m[0];
                    const compId = m[1];
                    const timestamp = m[3];
                    const homeInfo = m[5];
                    const awayInfo = m[6];
                    
                    const homeTeamId = homeInfo[0];
                    const homeScore = homeInfo[2];
                    const homeHT = homeInfo[3];
                    
                    const awayTeamId = awayInfo[0];
                    const awayScore = awayInfo[2];
                    const awayHT = awayInfo[3];
                    
                    const homeTeamObj = h2hData?.teams ? Object.values(h2hData.teams).find((t: any) => t.id === homeTeamId) as any : null;
                    const homeTeamName = homeTeamObj?.short_name_vi || homeTeamObj?.name || homeTeamId;
                    
                    const awayTeamObj = h2hData?.teams ? Object.values(h2hData.teams).find((t: any) => t.id === awayTeamId) as any : null;
                    const awayTeamName = awayTeamObj?.short_name_vi || awayTeamObj?.name || awayTeamId;
                    
                    const compObj = h2hData?.competitions ? Object.values(h2hData.competitions).find((c: any) => c.id === compId) as any : null;
                    const compName = compObj?.short_name_vi || compObj?.name || compId;
                    
                    const result = getMatchResult(m, activeTeamId);
                    
                    return (
                        <div key={matchId} className="flex flex-col gap-2 bg-gray-50/50 dark:bg-[#181d29]/40 border border-border-theme p-4 rounded-xl relative transition-colors duration-300">
                            <div className="flex justify-between items-center text-[10px] md:text-xs text-gray-500 font-medium">
                                <span className="flex items-center gap-1 font-bold text-amber-500/80">🏆 {compName}</span>
                                <span className="bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded text-gray-400 font-semibold">{formatMatchTime(timestamp)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2">
                                <div className="w-2/5 flex items-center justify-end gap-2 text-right">
                                    <span className="text-xs md:text-sm font-semibold truncate max-w-[100px] md:max-w-[120px] text-foreground">{homeTeamName}</span>
                                    <img 
                                        src={getTeamFlag(homeTeamObj?.name || homeTeamName, homeTeamId)} 
                                        alt="flag" 
                                        className="w-5 h-5 rounded-full object-cover border border-border-theme bg-gray-100 dark:bg-gray-800" 
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/team/default.png'; }} 
                                    />
                                </div>

                                <div className="w-1/5 flex flex-col items-center justify-center shrink-0">
                                    {activeTeamId && (
                                        <span className={`text-[8px] md:text-[9px] font-bold text-white px-2 py-0.5 rounded uppercase mb-1 shadow-sm ${result.color}`}>
                                            {result.text}
                                        </span>
                                    )}
                                    <span className="bg-blue-600 text-white text-xs md:text-sm font-bold px-3 py-1 rounded-full shadow-md">
                                        {homeScore} : {awayScore}
                                    </span>
                                </div>

                                <div className="w-2/5 flex items-center justify-start gap-2 text-left">
                                    <img 
                                        src={getTeamFlag(awayTeamObj?.name || awayTeamName, awayTeamId)} 
                                        alt="flag" 
                                        className="w-5 h-5 rounded-full object-cover border border-border-theme bg-gray-100 dark:bg-gray-800" 
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/team/default.png'; }} 
                                    />
                                    <span className="text-xs md:text-sm font-semibold truncate max-w-[100px] md:max-w-[120px] text-foreground">{awayTeamName}</span>
                                </div>
                            </div>

                            <div className="text-center text-[10px] text-gray-400 mt-1.5 border-t border-border-theme/40 pt-1.5 font-medium">
                                HT {homeHT} - {awayHT} | 🟨 0 - 0 | 🟥 0 - 0
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderUpcomingMatchList = (matches: any[]) => {
        if (!matches || matches.length === 0) {
            return (
                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl">
                    <span className="text-3xl block mb-2">📅</span>
                    <p className="text-sm font-semibold mb-1">Chưa có trận đấu sắp tới</p>
                    <p className="text-xs text-gray-400">Không tìm thấy lịch thi đấu tiếp theo.</p>
                </div>
            );
        }
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((m: any) => {
                    const matchId = m[0];
                    const compId = m[1];
                    const timestamp = m[3];
                    const homeInfo = m[5];
                    const awayInfo = m[6];
                    
                    const homeTeamId = homeInfo[0];
                    const awayTeamId = awayInfo[0];
                    
                    const homeTeamObj = h2hData?.teams ? Object.values(h2hData.teams).find((t: any) => t.id === homeTeamId) as any : null;
                    const homeTeamName = homeTeamObj?.short_name_vi || homeTeamObj?.name || homeTeamId;
                    
                    const awayTeamObj = h2hData?.teams ? Object.values(h2hData.teams).find((t: any) => t.id === awayTeamId) as any : null;
                    const awayTeamName = awayTeamObj?.short_name_vi || awayTeamObj?.name || awayTeamId;
                    
                    const compObj = h2hData?.competitions ? Object.values(h2hData.competitions).find((c: any) => c.id === compId) as any : null;
                    const compName = compObj?.short_name_vi || compObj?.name || compId;
                    
                    return (
                        <div key={matchId} className="flex flex-col gap-2 bg-gray-50/50 dark:bg-[#181d29]/40 border border-border-theme p-4 rounded-xl relative transition-colors duration-300">
                            <div className="flex justify-between items-center text-[10px] md:text-xs text-gray-500 font-medium">
                                <span className="flex items-center gap-1 font-bold text-amber-500/80">🏆 {compName}</span>
                                <span className="bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded text-gray-400 font-semibold">{formatMatchTime(timestamp)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2">
                                <div className="w-2/5 flex items-center justify-end gap-2 text-right">
                                    <span className="text-xs md:text-sm font-semibold truncate max-w-[100px] md:max-w-[120px] text-foreground">{homeTeamName}</span>
                                    <img 
                                        src={getTeamFlag(homeTeamObj?.name || homeTeamName, homeTeamId)} 
                                        alt="flag" 
                                        className="w-5 h-5 rounded-full object-cover border border-border-theme bg-gray-100 dark:bg-gray-800" 
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/team/default.png'; }} 
                                    />
                                </div>

                                <div className="w-1/5 flex flex-col items-center justify-center shrink-0">
                                    <span className="bg-blue-600 text-white text-xs md:text-sm font-bold px-3 py-1 rounded-full shadow-md">
                                        VS
                                    </span>
                                </div>

                                <div className="w-2/5 flex items-center justify-start gap-2 text-left">
                                    <img 
                                        src={getTeamFlag(awayTeamObj?.name || awayTeamName, awayTeamId)} 
                                        alt="flag" 
                                        className="w-5 h-5 rounded-full object-cover border border-border-theme bg-gray-100 dark:bg-gray-800" 
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/team/default.png'; }} 
                                    />
                                    <span className="text-xs md:text-sm font-semibold truncate max-w-[100px] md:max-w-[120px] text-foreground">{awayTeamName}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

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
    const activeStatsObj = Array.isArray(statsData) ? statsData.find((s: any) => s && s.type === (statsSubTab === 'all' ? 0 : 1)) : null;
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

                {/* --- TAB 5: BXH --- */}
                {activeTab === 'bxh' && (
                    <div className="flex flex-col gap-6 max-h-[600px] overflow-y-auto pr-1">
                        {isStandingLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl">
                                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                                <p className="text-sm font-semibold">Đang tải bảng xếp hạng...</p>
                            </div>
                        ) : !standingData || !standingData.standing?.tables || standingData.standing.tables.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl">
                                <span className="text-3xl block mb-2">📊</span>
                                <p className="text-sm font-semibold mb-1">Bảng xếp hạng đang được cập nhật</p>
                                <p className="text-xs text-gray-400">Dữ liệu BXH cho giải đấu {matchData.competition?.name || 'này'} sẽ xuất hiện tại đây.</p>
                            </div>
                        ) : (
                            standingData.standing.tables.map((table: any) => (
                                <div key={table.id} className="bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl p-4 flex flex-col gap-3 transition-colors duration-300">
                                    <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wide border-b border-border-theme pb-2 flex items-center gap-2">
                                        <span>🏆</span> {getGroupName(table)}
                                    </h4>
                                    
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs md:text-sm">
                                            <thead>
                                                <tr className="border-b border-border-theme text-foreground/70 font-semibold">
                                                    <th className="py-2 px-1 text-center w-10">TT</th>
                                                    <th className="py-2 px-2">Đội bóng</th>
                                                    <th className="py-2 px-2 text-center w-12">Trận</th>
                                                    <th className="py-2 px-2 text-center w-10">W</th>
                                                    <th className="py-2 px-2 text-center w-10">D</th>
                                                    <th className="py-2 px-2 text-center w-10">L</th>
                                                    <th className="py-2 px-2 text-center w-12 font-bold">Điểm</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {table.rows?.map((row: any) => {
                                                    const teamObj = standingData.teams?.find((t: any) => t.id === row.team_id);
                                                    const teamName = teamObj?.short_name_vi || teamObj?.name || row.team_id;
                                                    const teamLogo = teamObj?.logo || getTeamFlag(teamName, row.team_id);
                                                    
                                                    const rankNum = parseInt(row.position);
                                                    const isTop = rankNum <= 4;
                                                    const isRelegation = table.rows.length > 8 && rankNum >= table.rows.length - 2;

                                                    return (
                                                        <tr key={row.team_id} className="border-b border-border-theme/40 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                                            <td className="py-2.5 px-1 text-center">
                                                                <div className={`w-5 h-5 mx-auto flex items-center justify-center rounded-full text-[10px] font-bold text-white ${
                                                                    isTop ? 'bg-[#28A745]' : isRelegation ? 'bg-[#DC3545]' : 'bg-gray-400 dark:bg-gray-600'
                                                                }`}>
                                                                    {row.position}
                                                                </div>
                                                            </td>
                                                            <td className="py-2.5 px-2 font-semibold flex items-center gap-2">
                                                                <img 
                                                                    src={teamLogo} 
                                                                    alt={teamName} 
                                                                    className="w-5 h-5 object-contain" 
                                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://img.thesports.com/football/team/default.png'; }} 
                                                                />
                                                                <span className="text-foreground truncate max-w-[120px] md:max-w-[200px]">{teamName}</span>
                                                            </td>
                                                            <td className="py-2.5 px-2 text-center text-foreground/80">{row.total}</td>
                                                            <td className="py-2.5 px-2 text-center text-foreground/80">{row.won}</td>
                                                            <td className="py-2.5 px-2 text-center text-foreground/80">{row.draw}</td>
                                                            <td className="py-2.5 px-2 text-center text-foreground/80">{row.loss}</td>
                                                            <td className="py-2.5 px-2 text-center font-bold text-amber-500 text-sm">{row.points}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* --- TAB 6: ĐỐI ĐẦU --- */}
                {activeTab === 'h2h' && (
                    <div className="flex flex-col gap-6">
                        {/* H2H Sub-tabs */}
                        <div className="flex items-center justify-center gap-2 border-b border-border-theme pb-4">
                            <button
                                onClick={() => setH2HSubTab('home')}
                                className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg border transition-all duration-300 ${
                                    h2hSubTab === 'home'
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                                        : 'bg-transparent border-border-theme hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80'
                                }`}
                            >
                                {matchData.home_team?.name?.toUpperCase()}
                            </button>
                            <button
                                onClick={() => setH2HSubTab('all')}
                                className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg border transition-all duration-300 ${
                                    h2hSubTab === 'all'
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                                        : 'bg-transparent border-border-theme hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80'
                                }`}
                            >
                                TOÀN BỘ
                            </button>
                            <button
                                onClick={() => setH2HSubTab('away')}
                                className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg border transition-all duration-300 ${
                                    h2hSubTab === 'away'
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                                        : 'bg-transparent border-border-theme hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80'
                                }`}
                            >
                                {matchData.away_team?.name?.toUpperCase()}
                            </button>
                        </div>

                        {isH2HLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl">
                                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                                <p className="text-sm font-semibold">Đang tải lịch sử đối đầu...</p>
                            </div>
                        ) : !h2hData ? (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl">
                                <span className="text-3xl block mb-2">⚔️</span>
                                <p className="text-sm font-semibold mb-1">Không có dữ liệu đối đầu</p>
                                <p className="text-xs text-gray-400">Không tìm thấy thông tin lịch sử đấu.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 max-h-[600px] overflow-y-auto pr-1">
                                {/* Option 1: View Home only */}
                                {h2hSubTab === 'home' && (
                                    <div className="flex flex-col gap-3">
                                        <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wide border-b border-border-theme pb-2">
                                            CÁC TRẬN GẦN NHẤT: {matchData.home_team?.name}
                                        </h4>
                                        {renderH2HMatchList(h2hData.home, matchData.home_team?.id)}
                                    </div>
                                )}

                                {/* Option 2: View Away only */}
                                {h2hSubTab === 'away' && (
                                    <div className="flex flex-col gap-3">
                                        <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wide border-b border-border-theme pb-2">
                                            CÁC TRẬN GẦN NHẤT: {matchData.away_team?.name}
                                        </h4>
                                        {renderH2HMatchList(h2hData.away, matchData.away_team?.id)}
                                    </div>
                                )}

                                {/* Option 3: View All */}
                                {h2hSubTab === 'all' && (
                                    <>
                                        <div className="flex flex-col gap-3">
                                            <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wide border-b border-border-theme pb-2">
                                                CÁC TRẬN ĐỐI ĐẦU
                                            </h4>
                                            {(!h2hData.vs || h2hData.vs.length === 0) ? (
                                                <div className="text-center py-6 text-gray-500 text-xs italic bg-gray-50/20 dark:bg-white/[0.01] border border-border-theme rounded-lg">
                                                    Không có dữ liệu đối đầu trực tiếp gần đây.
                                                </div>
                                            ) : (
                                                renderH2HMatchList(h2hData.vs, matchData.home_team?.id)
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wide border-b border-border-theme pb-2">
                                                CÁC TRẬN GẦN NHẤT: {matchData.home_team?.name}
                                            </h4>
                                            {renderH2HMatchList(h2hData.home, matchData.home_team?.id)}
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wide border-b border-border-theme pb-2">
                                                CÁC TRẬN GẦN NHẤT: {matchData.away_team?.name}
                                            </h4>
                                            {renderH2HMatchList(h2hData.away, matchData.away_team?.id)}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB 7: TRẬN SẮP TỚI --- */}
                {activeTab === 'upcoming' && (
                    <div className="flex flex-col gap-6">
                        {/* Upcoming Sub-tabs */}
                        <div className="flex items-center justify-center gap-2 border-b border-border-theme pb-4">
                            <button
                                onClick={() => setUpcomingSubTab('home')}
                                className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg border transition-all duration-300 ${
                                    upcomingSubTab === 'home'
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                                        : 'bg-transparent border-border-theme hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80'
                                }`}
                            >
                                {matchData.home_team?.name?.toUpperCase()}
                            </button>
                            <button
                                onClick={() => setUpcomingSubTab('away')}
                                className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg border transition-all duration-300 ${
                                    upcomingSubTab === 'away'
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                                        : 'bg-transparent border-border-theme hover:bg-black/5 dark:hover:bg-white/5 text-foreground/80'
                                }`}
                            >
                                {matchData.away_team?.name?.toUpperCase()}
                            </button>
                        </div>

                        {isH2HLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl">
                                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                                <p className="text-sm font-semibold">Đang tải lịch thi đấu sắp tới...</p>
                            </div>
                        ) : !h2hData || !h2hData.future ? (
                            <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-[#181d29]/40 border border-border-theme rounded-xl">
                                <span className="text-3xl block mb-2">📅</span>
                                <p className="text-sm font-semibold mb-1">Không có thông tin lịch đấu sắp tới</p>
                                <p className="text-xs text-gray-400">Lịch thi đấu sắp tới chưa được cập nhật.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
                                <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wide border-b border-border-theme pb-2">
                                    LỊCH THI ĐẤU TIẾP THEO
                                </h4>
                                {upcomingSubTab === 'home' 
                                    ? renderUpcomingMatchList(h2hData.future.home || [])
                                    : renderUpcomingMatchList(h2hData.future.away || [])
                                }
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
