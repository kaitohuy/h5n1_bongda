'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type Team = {
    rank: string;
    teamName: string;
    logo: string;
    played: string;
    won: string;
    drawn: string;
    lost: string;
    gd: string;
    points: string;
    region?: string;
    form?: string[];
};

export type LeagueStandings = {
    leagueName: string;
    category?: string; // "GIẢI NỔI BẬT" hoặc tên khu vực (Anh, Pháp...)
    teams: Team[];
    fullUrl?: string;
    vnRank?: string; // Thứ hạng Việt Nam (chỉ cho FIFA)
};

export type NavigationItem = {
    name: string;
    leagues: { name: string; fullUrl: string }[];
};

export default function StandingsLayout({ leagues: initialLeagues, navigation = [] }: { leagues: LeagueStandings[], navigation?: NavigationItem[] }) {
    // Chúng ta sẽ trộn (merge) leagues có sẵn dữ liệu và navigation chưa có dữ liệu
    const [leagues, setLeagues] = useState<LeagueStandings[]>([]);
    const [selectedLeagueIdx, setSelectedLeagueIdx] = useState<number | null>(null);
    const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
    const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
    const [expandedLeagues, setExpandedLeagues] = useState<Record<number, boolean>>({});

    const BE_URL = process.env.NEXT_PUBLIC_BE_URL || 'http://localhost:8000';

    // Trộn dữ liệu khi mount hoặc khi props thay đổi
    useEffect(() => {
        let merged: LeagueStandings[] = [...initialLeagues];
        
        navigation.forEach(navCat => {
            navCat.leagues.forEach(navLeague => {
                const exists = merged.find(l => l.leagueName === navLeague.name);
                if (!exists) {
                    merged.push({
                        leagueName: navLeague.name,
                        category: navCat.name,
                        teams: [], // Chưa có dữ liệu
                        fullUrl: navLeague.fullUrl
                    });
                } else if (!exists.category) {
                    exists.category = navCat.name;
                }
            });
        });
        
        setLeagues(merged);
    }, [initialLeagues, navigation]);

    // Xử lý fetch dữ liệu chi tiết khi chọn giải đấu ở Sidebar hoặc nhấn Xem đầy đủ
    const handleExpandLeague = async (idx: number) => {
        const league = leagues[idx];
        // Fetch nếu chưa có dữ liệu hoặc dữ liệu quá ngắn (limit view)
        if (league.fullUrl && league.teams.length <= 10) {
            await fetchFullStandings(idx, league.fullUrl);
        }
        setExpandedLeagues(prev => ({ ...prev, [idx]: true }));
    };

    const fetchFullStandings = async (idx: number, url: string) => {
        setLoadingIdx(idx);
        try {
            const res = await fetch(`${BE_URL}/api/standings/detail?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.success && data.teams) {
                setLeagues(prevLeagues => {
                    const updated = [...prevLeagues];
                    updated[idx] = { ...updated[idx], teams: data.teams };
                    return updated;
                });
            }
        } catch (error) {
            console.error('Lỗi khi tải bảng xếp hạng chi tiết:', error);
        } finally {
            setLoadingIdx(null);
        }
    };

    // Khi chọn giải từ sidebar, ta chuyển sang chế độ tập trung vào 1 giải
    useEffect(() => {
        if (selectedLeagueIdx !== null) {
            handleExpandLeague(selectedLeagueIdx);
            // Cuộn lên đầu trang khi chọn giải mới
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // Khi quay lại "Tất cả cập nhật" cũng cuộn lên đầu
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [selectedLeagueIdx]);

    const toggleCat = (cat: string) => {
        setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const getFormBadgeColor = (result: string) => {
        if (result === 'W') return 'bg-green-500 text-white';
        if (result === 'L') return 'bg-red-500 text-white';
        if (result === 'D') return 'bg-yellow-500 text-white';
        return 'bg-gray-400 text-white';
    };

    const getFormLetter = (result: string) => {
        if (result === 'W') return 'T';
        if (result === 'L') return 'B';
        if (result === 'D') return 'H';
        return result || '';
    };

    const renderTable = (league: LeagueStandings, limit: number | null, index: number) => {
        if (!league) return null;
        
        const isFifa = league.category === 'BXH FIFA' || league.leagueName.includes('FIFA');
        const isExpanded = expandedLeagues[index] || limit === null;
        const teamsToShow = isExpanded ? league.teams : league.teams.slice(0, limit || 8);
        const isLoading = loadingIdx === index;

        return (
            <div 
                className={`mb-10 transition-opacity ${isLoading ? 'opacity-60' : 'opacity-100'}`} 
                key={`table-${league.leagueName}-${index}`}
                suppressHydrationWarning
            >
                <div className="flex items-center justify-between mb-4 border-b pb-2 border-border-theme">
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground">
                        {isFifa ? league.leagueName : `BXH ${league.leagueName}`}
                        {isLoading && <span className="text-sm font-normal text-foreground/50 animate-pulse">(Đang tải...)</span>}
                    </h2>
                </div>

                {isFifa && league.vnRank && (
                    <div className="mb-4 text-[#DC3545] font-bold text-lg animate-pulse tracking-tight">
                        {league.vnRank}
                    </div>
                )}

                <div className="w-full overflow-x-auto bg-[var(--card-bg)] border border-border-theme rounded-xl shadow-sm">
                    {teamsToShow.length > 0 ? (
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-[var(--header-bg)] border-b border-border-theme text-foreground/70 text-sm">
                                    <th className="py-3 px-3 w-12 text-center">TT</th>
                                    <th className="py-3 px-3">Đội</th>
                                    {isFifa ? (
                                        <>
                                            <th className="py-3 px-2 text-center font-bold">Tổng điểm</th>
                                            <th className="py-3 px-2 text-center text-xs opacity-60">Điểm trước</th>
                                            <th className="py-3 px-2 text-center">+/-</th>
                                            <th className="py-3 px-3 text-center">Khu vực</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="py-3 px-2 text-center">Trận</th>
                                            <th className="py-3 px-2 text-center">Thắng</th>
                                            <th className="py-3 px-2 text-center">Hòa</th>
                                            <th className="py-3 px-2 text-center">Bại</th>
                                            <th className="py-3 px-2 text-center">HS</th>
                                            <th className="py-3 px-2 text-center font-bold">Điểm</th>
                                            <th className="py-3 px-3 text-center w-36">5 trận gần nhất</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {teamsToShow.map((team, tIdx) => {
                                    const rankNum = parseInt(team.rank);
                                    const isTop4 = rankNum <= 4;
                                    const isRelegation = !isFifa && league.teams.length > 15 && rankNum >= league.teams.length - 2;

                                    return (
                                        <tr key={`${league.leagueName}-${team.teamName}-${tIdx}`} className={`border-b border-border-theme/40 hover:bg-[var(--header-btn-bg)] transition-colors ${tIdx % 2 === 0 ? 'bg-black/5 dark:bg-white/[0.02]' : ''}`}>
                                            <td className="py-3 px-3 text-center font-semibold">
                                                <div className={`w-6 h-6 mx-auto flex items-center justify-center rounded-full text-xs text-white ${isTop4 ? 'bg-[#28A745]' : isRelegation ? 'bg-[#DC3545]' : 'bg-gray-400 dark:bg-gray-600'}`}>
                                                    {team.rank}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 font-semibold flex items-center gap-3">
                                                {team.logo && (
                                                    <div className="w-9 h-6 relative bg-foreground/5 border border-border-theme/30 rounded-sm overflow-hidden flex-shrink-0">
                                                        <img src={team.logo} alt={team.teamName} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <span className="hover:text-[var(--logo-text-accent)] cursor-pointer">{team.teamName}</span>
                                            </td>
                                            {isFifa ? (
                                                <>
                                                    <td className="py-3 px-2 text-center font-bold text-lg">{team.points}</td>
                                                    <td className="py-3 px-2 text-center text-foreground/50 text-sm italic">{team.played !== '-' ? team.played : ''}</td>
                                                    <td className={`py-3 px-2 text-center font-medium ${team.gd.startsWith('+') ? 'text-green-500' : team.gd.startsWith('-') ? 'text-red-500' : 'text-foreground/80'}`}>
                                                        {team.gd}
                                                    </td>
                                                    <td className="py-3 px-3 text-center text-xs text-foreground/60">{team.region}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="py-3 px-2 text-center text-foreground/80">{team.played}</td>
                                                    <td className="py-3 px-2 text-center text-foreground/80">{team.won}</td>
                                                    <td className="py-3 px-2 text-center text-foreground/80">{team.drawn}</td>
                                                    <td className="py-3 px-2 text-center text-foreground/80">{team.lost}</td>
                                                    <td className="py-3 px-2 text-center text-foreground/80">{team.gd}</td>
                                                    <td className="py-3 px-2 text-center font-bold text-lg">{team.points}</td>
                                                    <td className="py-3 px-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {team.form && team.form.length > 0 ? team.form.map((f, i) => (
                                                                <span key={`${team.teamName}-form-${i}`} className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-sm ${getFormBadgeColor(f)}`} title={f === 'W' ? 'Thắng' : f === 'D' ? 'Hòa' : 'Thua'}>
                                                                    {getFormLetter(f)}
                                                                </span>
                                                            )) : (
                                                                <span className="text-xs text-foreground/40">-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-10 text-center flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-foreground/70 font-medium tracking-tight">Đang tải bảng xếp hạng chi tiết...</p>
                        </div>
                    )}
                    
                    {teamsToShow.length > 0 && !isExpanded && league.fullUrl && (
                        <div className="p-4 flex justify-center border-t border-border-theme/40 bg-[var(--card-bg)] rounded-b-xl">
                            <button 
                                onClick={() => handleExpandLeague(index)}
                                className="px-6 py-2.5 bg-[#f2f2f2] hover:bg-[#e2e2e2] text-[#333] dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 text-sm font-semibold rounded-[4px] border border-transparent transition-all shadow-sm flex items-center gap-2"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Đang tải dữ liệu...' : `Xem đầy đủ ${isFifa ? 'BXH' : 'BXH ' + league.leagueName}`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const cleanCat = (cat: string) => cat.replace(/KHU VỰC/i, '').trim();

    const prominentLeagues = leagues.filter(l => !l.category || l.category === 'GIẢI NỔI BẬT' || l.category === 'Giai noi bat' || l.category === 'BXH FIFA');
    
    // Thu thập danh mục từ leagues đã được merge
    const catGroups = leagues.reduce((acc, l) => {
        const cat = l.category || 'Hệ thống';
        if (cat === 'GIẢI NỔI BẬT' || cat === 'Giai noi bat' || cat === 'BXH FIFA') return acc;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(l);
        return acc;
    }, {} as Record<string, LeagueStandings[]>);

    const otherCats = Object.keys(catGroups).sort();

    return (
        <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
            {/* Sidebar vế trái */}
            <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-5">
                {/* Khối GIẢI NỔI BẬT & FIFA */}
                <div className="bg-[var(--card-bg)] border border-border-theme rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-[#28A745] p-3 border-b border-border-theme">
                        <h3 className="font-bold text-white text-sm uppercase tracking-wide">GIẢI NỔI BẬT</h3>
                    </div>
                    <ul className="flex flex-col">
                        <li>
                            <button
                                onClick={() => setSelectedLeagueIdx(null)}
                                className={`w-full text-left px-4 py-3 text-sm font-bold border-b border-border-theme/50 transition-colors ${
                                    selectedLeagueIdx === null
                                    ? 'bg-green-100 dark:bg-green-900/30 text-[#28A745]' 
                                    : 'hover:bg-[var(--header-btn-bg)] text-foreground/80'
                                }`}
                            >
                                Tất cả Cập Nhật
                            </button>
                        </li>
                        {prominentLeagues.map((league) => {
                            const actualIdx = leagues.findIndex(l => l.leagueName === league.leagueName);
                            const isActive = selectedLeagueIdx === actualIdx;
                            const isFifa = league.category === 'BXH FIFA';
                            
                            return (
                                <li key={`nav-${league.leagueName}-${actualIdx}`}>
                                    <button
                                        onClick={() => setSelectedLeagueIdx(actualIdx)}
                                        className={`w-full text-left px-5 py-3 text-sm font-medium border-b border-border-theme/50 transition-colors ${
                                            isActive 
                                            ? 'bg-green-100 dark:bg-green-900/30 text-[#28A745] font-bold' 
                                            : 'hover:bg-[var(--header-btn-bg)] text-foreground/80 hover:text-[#28A745]'
                                        } ${isFifa ? 'font-bold' : ''}`}
                                    >
                                        {league.leagueName}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                
                {/* Khối KHU VỰC (Lồng nhau) */}
                <div className="bg-[var(--card-bg)] border border-border-theme rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-[#28A745] p-3 border-b border-border-theme">
                        <h3 className="font-bold text-white text-sm uppercase tracking-wide">KHU VỰC</h3>
                    </div>
                    <div className="flex flex-col">
                        {otherCats.map(cat => {
                            const leaguesInCat = catGroups[cat];
                            const isExpanded = expandedCats[cat] || false;
                            const catLabel = cleanCat(cat);

                            return (
                                <div key={`cat-group-${cat}`} className="border-b border-border-theme/50">
                                    <button
                                        onClick={() => toggleCat(cat)}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold hover:bg-[var(--header-btn-bg)] transition-colors text-foreground"
                                    >
                                        <span>{catLabel}</span>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    
                                    {isExpanded && (
                                        <ul className="bg-gray-50/50 dark:bg-white/[0.01] flex flex-col">
                                            {leaguesInCat.map(league => {
                                                const actualIdx = leagues.findIndex(l => l.leagueName === league.leagueName);
                                                const isActive = selectedLeagueIdx === actualIdx;
                                                return (
                                                    <li key={`nav-sub-${league.leagueName}-${actualIdx}`}>
                                                        <button
                                                            onClick={() => setSelectedLeagueIdx(actualIdx)}
                                                            className={`w-full text-left pl-10 pr-4 py-2.5 text-xs font-medium border-b border-border-theme/30 last:border-0 transition-colors ${
                                                                isActive 
                                                                ? 'text-[#28A745] font-bold bg-green-50 dark:bg-green-900/10' 
                                                                : 'text-foreground/70 hover:text-[#28A745]'
                                                            }`}
                                                        >
                                                            {league.leagueName}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </aside>

            {/* Vùng nội dung bên phải */}
            <div className="flex-1 w-full flex flex-col min-w-0">
                {selectedLeagueIdx === null ? (
                    leagues.length > 0 ? (
                        leagues.map((league, idx) => {
                            // Chỉ hiện bảng ở trang chủ nếu thuộc GIẢI NỔI BẬT (tránh quá dài)
                            const isProminent = !league.category || league.category === 'GIẢI NỔI BẬT' || league.category === 'Giai noi bat';
                            if (!isProminent) return null;
                            return renderTable(league, 8, idx);
                        })
                    ) : (
                        <div className="p-20 text-center">
                             <div className="w-10 h-10 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                             <p className="text-foreground/50">Đang tải dữ liệu bảng xếp hạng...</p>
                        </div>
                    )
                ) : (
                    renderTable(leagues[selectedLeagueIdx], null, selectedLeagueIdx)
                )}
            </div>
        </div>
    );
}

