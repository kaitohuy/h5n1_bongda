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
    isMultiTable?: boolean;
    tables?: { title: string; teams: Team[] }[];
    isKnockout?: boolean;
    knockoutHtml?: string;
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

    // State variables for World Cup
    const [wcTab, setWcTab] = useState<'groups' | 'qualifiers' | 'knockout'>('groups');
    const [activeGroupIdx, setActiveGroupIdx] = useState<number>(0);
    const [activeRegionIdx, setActiveRegionIdx] = useState<number>(0);
    const [regionData, setRegionData] = useState<Record<string, { isMultiTable?: boolean; tables?: { title: string; teams: Team[] }[]; teams?: Team[]; isKnockout?: boolean; knockoutHtml?: string }>>({});
    const [regionLoading, setRegionLoading] = useState<boolean>(false);
    const [wcKnockoutHtml, setWcKnockoutHtml] = useState<string>('');
    const [wcKnockoutLoading, setWcKnockoutLoading] = useState<boolean>(false);

    const wcRegions = [
        { name: 'Châu Á', url: 'https://bongda24h.vn/vong-loai-world-cup-khu-vuc-chau-a/bang-xep-hang-82.html' },
        { name: 'Châu Âu', url: 'https://bongda24h.vn/vong-loai-world-cup-khu-vuc-chau-au/bang-xep-hang-89.html' },
        { name: 'Nam Mỹ', url: 'https://bongda24h.vn/vong-loai-world-cup-khu-vuc-nam-my/bang-xep-hang-83.html' },
        { name: 'Bắc Trung Mỹ', url: 'https://bongda24h.vn/vong-loai-world-cup-khu-vuc-bac-trung-my/bang-xep-hang-91.html' },
        { name: 'Châu Phi', url: 'https://bongda24h.vn/vong-loai-world-cup-khu-vuc-chau-phi/bang-xep-hang-201.html' },
        { name: 'Châu Đại Dương', url: 'https://bongda24h.vn/vong-loai-world-cup-khu-vuc-chau-dai-duong/bang-xep-hang-363.html' }
    ];

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

        // Ép category GIẢI NỔI BẬT cho WC / VCK World Cup để đồng bộ dữ liệu
        merged = merged.map(l => {
            const isWc = l.leagueName === 'WC' || l.leagueName === 'VCK World Cup' || l.fullUrl?.includes('vck-world-cup') || l.fullUrl?.includes('world-cup');
            if (isWc) {
                return { ...l, category: 'GIẢI NỔI BẬT' };
            }
            return l;
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
            if (data.success) {
                setLeagues(prevLeagues => {
                    const updated = [...prevLeagues];
                    if (data.isKnockout) {
                        updated[idx] = { 
                            ...updated[idx], 
                            isKnockout: true, 
                            knockoutHtml: data.html,
                            teams: []
                        };
                    } else if (data.isMultiTable) {
                        updated[idx] = { 
                            ...updated[idx], 
                            isMultiTable: true, 
                            tables: data.tables,
                            teams: []
                        };
                    } else {
                        updated[idx] = { 
                            ...updated[idx], 
                            isMultiTable: false, 
                            isKnockout: false,
                            teams: data.teams || []
                        };
                    }
                    return updated;
                });
            }
        } catch (error) {
            console.error('Lỗi khi tải bảng xếp hạng chi tiết:', error);
        } finally {
            setLoadingIdx(null);
        }
    };

    const fetchRegionStanding = async (regionName: string, url: string) => {
        if (regionData[regionName]) return;
        setRegionLoading(true);
        try {
            const res = await fetch(`${BE_URL}/api/standings/detail?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.success) {
                setRegionData(prev => ({
                    ...prev,
                    [regionName]: data
                }));
            }
        } catch (error) {
            console.error('Lỗi khi tải bảng xếp hạng vòng loại khu vực:', error);
        } finally {
            setRegionLoading(false);
        }
    };

    const fetchWcKnockout = async () => {
        if (wcKnockoutHtml) return;
        setWcKnockoutLoading(true);
        try {
            const res = await fetch(`${BE_URL}/api/standings/detail?url=${encodeURIComponent('https://bongda24h.vn/vck-world-cup/vong-loai-truc-tiep.html')}`);
            const data = await res.json();
            if (data.success && data.isKnockout) {
                setWcKnockoutHtml(data.html);
            }
        } catch (error) {
            console.error('Lỗi khi tải sơ đồ thi đấu knockout:', error);
        } finally {
            setWcKnockoutLoading(false);
        }
    };

    useEffect(() => {
        if (selectedLeagueIdx !== null) {
            const league = leagues[selectedLeagueIdx];
            const isWc = league && (league.leagueName === 'VCK World Cup' || league.fullUrl?.includes('vck-world-cup'));
            if (isWc && wcTab === 'qualifiers') {
                const region = wcRegions[activeRegionIdx];
                fetchRegionStanding(region.name, region.url);
            }
        }
    }, [selectedLeagueIdx, wcTab, activeRegionIdx, leagues]);

    useEffect(() => {
        if (selectedLeagueIdx !== null) {
            const league = leagues[selectedLeagueIdx];
            const isWc = league && (league.leagueName === 'VCK World Cup' || league.fullUrl?.includes('vck-world-cup'));
            if (isWc && wcTab === 'knockout') {
                fetchWcKnockout();
            }
        }
    }, [selectedLeagueIdx, wcTab, leagues]);

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

    const renderSingleWcTable = (title: string, teams: Team[]) => {
        return (
            <div className="w-full overflow-x-auto bg-[var(--card-bg)] border border-border-theme rounded-xl shadow-sm animate-in">
                <div className="bg-[var(--header-bg)] border-b border-border-theme px-4 py-3">
                    <h3 className="font-extrabold text-foreground tracking-tight text-sm uppercase">{title}</h3>
                </div>
                <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                        <tr className="bg-[var(--header-bg)] border-b border-border-theme text-foreground/75 text-xs font-bold uppercase">
                            <th className="py-3 px-3 w-12 text-center">TT</th>
                            <th className="py-3 px-3">Đội</th>
                            <th className="py-3 px-2 text-center w-16">Trận</th>
                            <th className="py-3 px-2 text-center w-16">Thắng</th>
                            <th className="py-3 px-2 text-center w-16">Hòa</th>
                            <th className="py-3 px-2 text-center w-16">Bại</th>
                            <th className="py-3 px-2 text-center w-16">HS</th>
                            <th className="py-3 px-2 text-center font-bold w-16">Điểm</th>
                            <th className="py-3 px-3 text-center w-40">5 trận gần nhất</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((team, tIdx) => {
                            const rankNum = parseInt(team.rank);
                            const isTop2 = rankNum <= 2;
                            return (
                                <tr key={`${title}-${team.teamName}-${tIdx}`} className={`border-b border-border-theme/40 hover:bg-[var(--header-btn-bg)] transition-colors text-sm ${tIdx % 2 === 0 ? 'bg-black/[0.01] dark:bg-white/[0.01]' : ''}`}>
                                    <td className="py-3.5 px-3 text-center font-semibold">
                                        <div className={`w-5 h-5 mx-auto flex items-center justify-center rounded-full text-[10px] font-bold text-white ${isTop2 ? 'bg-[#28A745]' : 'bg-gray-400 dark:bg-gray-600'}`}>
                                            {team.rank}
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-3 font-semibold flex items-center gap-3">
                                        {team.logo && (
                                            <div className="w-8 h-5.5 relative bg-foreground/5 border border-border-theme/30 rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                <img src={team.logo} alt={team.teamName} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <span className="hover:text-[var(--logo-text-accent)] transition-colors">{team.teamName}</span>
                                    </td>
                                    <td className="py-3.5 px-2 text-center text-foreground/80 font-medium">{team.played}</td>
                                    <td className="py-3.5 px-2 text-center text-foreground/80 font-medium">{team.won}</td>
                                    <td className="py-3.5 px-2 text-center text-foreground/80 font-medium">{team.drawn}</td>
                                    <td className="py-3.5 px-2 text-center text-foreground/80 font-medium">{team.lost}</td>
                                    <td className="py-3.5 px-2 text-center text-foreground/80 font-semibold">{team.gd}</td>
                                    <td className="py-3.5 px-2 text-center font-bold text-base">{team.points}</td>
                                    <td className="py-3.5 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {team.form && team.form.length > 0 ? team.form.map((f, i) => (
                                                <span key={`${team.teamName}-form-${i}`} className={`w-5 h-5 flex items-center justify-center text-[10px] font-black rounded ${getFormBadgeColor(f)}`} title={f === 'W' ? 'Thắng' : f === 'D' ? 'Hòa' : 'Thua'}>
                                                    {getFormLetter(f)}
                                                </span>
                                            )) : (
                                                <span className="text-xs text-foreground/40">-</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderWcGroups = (league: LeagueStandings, index: number) => {
        const isLoading = loadingIdx === index;
        const tables = league.tables || [];

        if (isLoading && tables.length === 0) {
            return (
                <div className="p-20 text-center flex flex-col items-center gap-4 bg-[var(--card-bg)] rounded-xl border border-border-theme shadow-sm">
                    <div className="w-12 h-12 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-foreground/70 font-medium">Đang tải danh sách bảng đấu...</p>
                </div>
            );
        }

        if (tables.length === 0) {
            return (
                <div className="p-10 text-center text-foreground/60 bg-[var(--card-bg)] border border-border-theme rounded-xl shadow-sm">
                    Không tìm thấy dữ liệu bảng đấu.
                </div>
            );
        }

        const groupNames = tables.map(t => t.title.replace('Bảng ', '').trim());

        const scrollToGroup = (gIdx: number) => {
            const el = document.getElementById(`wc-group-${gIdx}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        return (
            <div className="flex flex-col gap-6 w-full animate-in">
                {/* Group Selector bar */}
                <div className="w-full bg-[var(--card-bg)] border border-border-theme rounded-xl p-3.5 shadow-sm sticky top-[72px] z-20 backdrop-blur-md bg-opacity-80">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider pl-2 shrink-0 select-none">Bảng đấu:</span>
                        {groupNames.map((name, gIdx) => {
                            return (
                                <button
                                    key={`group-btn-${gIdx}`}
                                    onClick={() => scrollToGroup(gIdx)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-black bg-[var(--header-btn-bg)] hover:bg-[#28A745] hover:text-white text-foreground/85 transition-all shrink-0 cursor-pointer"
                                >
                                    Bảng {name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* List of all group tables */}
                <div className="flex flex-col gap-8">
                    {tables.map((table, gIdx) => (
                        <div 
                            id={`wc-group-${gIdx}`} 
                            key={`group-table-${gIdx}`} 
                            className="scroll-mt-24"
                            style={{ scrollMarginTop: '140px' }}
                        >
                            {renderSingleWcTable(table.title, table.teams)}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderWcQualifiers = () => {
        const region = wcRegions[activeRegionIdx];
        const data = regionData[region.name];
        const isLoading = regionLoading;

        return (
            <div className="flex flex-col gap-6 w-full animate-in">
                {/* Region Selector bar */}
                <div className="w-full bg-[var(--card-bg)] border border-border-theme rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                        <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider pl-2 shrink-0 select-none">Khu vực:</span>
                        {wcRegions.map((r, rIdx) => {
                            const isActive = activeRegionIdx === rIdx;
                            return (
                                <button
                                    key={`region-btn-${rIdx}`}
                                    onClick={() => setActiveRegionIdx(rIdx)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 ${
                                        isActive
                                            ? 'bg-[#28A745] text-white shadow-sm'
                                            : 'bg-[var(--header-btn-bg)] hover:bg-[var(--header-btn-hover)] text-foreground/80'
                                    }`}
                                >
                                    {r.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Qualifiers content */}
                {isLoading ? (
                    <div className="p-20 text-center flex flex-col items-center gap-4 bg-[var(--card-bg)] rounded-xl border border-border-theme shadow-sm">
                        <div className="w-12 h-12 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-foreground/70 font-medium">Đang tải bảng xếp hạng {region.name}...</p>
                    </div>
                ) : data ? (
                    data.isMultiTable ? (
                        <div className="flex flex-col gap-8 w-full">
                            {data.tables?.map((table, tIdx) => (
                                <div key={`region-table-${tIdx}`} className="w-full">
                                    {renderSingleWcTable(table.title, table.teams)}
                                </div>
                            ))}
                        </div>
                    ) : data.teams && data.teams.length > 0 ? (
                        renderSingleWcTable(`Vòng loại ${region.name}`, data.teams)
                    ) : (
                        <div className="p-10 text-center text-foreground/60 bg-[var(--card-bg)] border border-border-theme rounded-xl shadow-sm">
                            Không có dữ liệu bảng xếp hạng vòng loại cho khu vực {region.name}.
                        </div>
                    )
                ) : (
                    <div className="p-10 text-center text-foreground/60 bg-[var(--card-bg)] border border-border-theme rounded-xl shadow-sm">
                        Đang đợi tải dữ liệu...
                    </div>
                )}
            </div>
        );
    };

    const renderWcKnockout = () => {
        const isLoading = wcKnockoutLoading;
        const html = wcKnockoutHtml;

        if (isLoading) {
            return (
                <div className="p-20 text-center flex flex-col items-center gap-4 bg-[var(--card-bg)] rounded-xl border border-border-theme shadow-sm">
                    <div className="w-12 h-12 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-foreground/70 font-medium">Đang tải sơ đồ vòng knockout...</p>
                </div>
            );
        }

        if (!html) {
            return (
                <div className="p-10 text-center text-foreground/60 bg-[var(--card-bg)] border border-border-theme rounded-xl shadow-sm">
                    Không tìm thấy dữ liệu sơ đồ thi đấu.
                </div>
            );
        }

        return (
            <div className="w-full bg-[var(--card-bg)] border border-border-theme rounded-xl shadow-sm p-4 md:p-6 overflow-x-auto animate-in">
                <style dangerouslySetInnerHTML={{ __html: `
                    .worldcup-bracket-container {
                        min-width: 1200px;
                        overflow-x: auto;
                    }
                    .worldcup-bracket-container table.table-wcp {
                        width: 100%;
                        border-collapse: collapse;
                        font-family: inherit;
                    }
                    .worldcup-bracket-container table.table-wcp td {
                        padding: 10px 12px;
                        font-size: 13px;
                        vertical-align: middle;
                        border: none !important;
                    }
                    .worldcup-bracket-container .link-club {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-weight: 600;
                        color: var(--foreground);
                        text-decoration: none;
                    }
                    .worldcup-bracket-container .ic-link-club {
                        width: 24px;
                        height: 16px;
                        object-fit: cover;
                        border-radius: 2px;
                        border: 1px solid rgba(0,0,0,0.1);
                    }
                    .worldcup-bracket-container .v-green {
                        color: #28a745;
                        font-weight: bold;
                    }
                    /* Adapt to dark/light theme border and background */
                    .worldcup-bracket-container td[style*="border"] {
                        border-color: var(--border-theme) !important;
                    }
                    .worldcup-bracket-container td {
                        color: var(--foreground);
                    }
                    .dark .worldcup-bracket-container td {
                        border-color: rgba(255, 255, 255, 0.15) !important;
                    }
                `}} />
                <div className="worldcup-bracket-container" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        );
    };

    const renderWorldCupView = (league: LeagueStandings, index: number) => {
        const isLoading = loadingIdx === index;
        return (
            <div className="w-full flex flex-col min-w-0 animate-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 border-b pb-4 border-border-theme gap-4">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                        {league.leagueName}
                        {isLoading && <span className="text-sm font-normal text-foreground/50 animate-pulse">(Đang tải...)</span>}
                    </h2>
                </div>

                {/* Sub tabs for World Cup */}
                <div className="flex border-b border-border-theme mb-6 gap-2 sm:gap-4 overflow-x-auto hide-scrollbar">
                    <button
                        onClick={() => setWcTab('groups')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                            wcTab === 'groups'
                                ? 'border-[#28A745] text-[#28A745]'
                                : 'border-transparent text-foreground/60 hover:text-foreground'
                        }`}
                    >
                        Vòng đấu bảng
                    </button>
                    <button
                        onClick={() => setWcTab('qualifiers')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                            wcTab === 'qualifiers'
                                ? 'border-[#28A745] text-[#28A745]'
                                : 'border-transparent text-foreground/60 hover:text-foreground'
                        }`}
                    >
                        Vòng loại khu vực
                    </button>
                    <button
                        onClick={() => setWcTab('knockout')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                            wcTab === 'knockout'
                                ? 'border-[#28A745] text-[#28A745]'
                                : 'border-transparent text-foreground/60 hover:text-foreground'
                        }`}
                    >
                        Vòng loại trực tiếp
                    </button>
                </div>

                {/* Content */}
                <div className="w-full">
                    {wcTab === 'groups' && renderWcGroups(league, index)}
                    {wcTab === 'qualifiers' && renderWcQualifiers()}
                    {wcTab === 'knockout' && renderWcKnockout()}
                </div>
            </div>
        );
    };

    const cleanCat = (cat: string) => cat.replace(/KHU VỰC/i, '').trim();

    const prominentLeagues = leagues.filter(l => {
        const isWc = l.leagueName === 'WC' || l.leagueName === 'VCK World Cup' || l.fullUrl?.includes('vck-world-cup') || l.fullUrl?.includes('world-cup');
        return isWc || !l.category || l.category === 'GIẢI NỔI BẬT' || l.category === 'Giai noi bat' || l.category === 'BXH FIFA';
    });

    // Đưa WC/VCK World Cup lên đầu danh sách giải nổi bật
    const wcIndexInProminent = prominentLeagues.findIndex(l => 
        l.leagueName === 'WC' || 
        l.leagueName === 'VCK World Cup' || 
        l.fullUrl?.includes('vck-world-cup') ||
        l.fullUrl?.includes('world-cup')
    );
    if (wcIndexInProminent > 0) {
        const [wcLeague] = prominentLeagues.splice(wcIndexInProminent, 1);
        prominentLeagues.unshift(wcLeague);
    }
    
    // Thu thập danh mục từ leagues đã được merge
    const catGroups = leagues.reduce((acc, l) => {
        const cat = l.category || 'Hệ thống';
        if (cat === 'GIẢI NỔI BẬT' || cat === 'Giai noi bat' || cat === 'BXH FIFA') return acc;
        
        // Loại trừ WC/VCK World Cup ra khỏi danh sách khu vực ở dưới
        const isWc = l.leagueName === 'WC' || l.leagueName === 'VCK World Cup' || l.fullUrl?.includes('vck-world-cup') || l.fullUrl?.includes('world-cup');
        if (isWc) return acc;

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
                    (() => {
                        const selectedLeague = leagues[selectedLeagueIdx];
                        const isWc = selectedLeague && (selectedLeague.leagueName === 'VCK World Cup' || selectedLeague.fullUrl?.includes('vck-world-cup'));
                        if (isWc) {
                            return renderWorldCupView(selectedLeague, selectedLeagueIdx);
                        }
                        return renderTable(selectedLeague, null, selectedLeagueIdx);
                    })()
                )}
            </div>
        </div>
    );
}

