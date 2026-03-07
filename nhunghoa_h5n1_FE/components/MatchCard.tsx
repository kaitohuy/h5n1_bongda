'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Match } from '@/app/types';

interface MatchCardProps {
    match: Match;
    onClick: (match: Match) => void;
    isActive?: boolean;
}

function TeamLogo({ src, name }: { src: string; name: string }) {
    const [failed, setFailed] = useState(false);
    if (src && !failed) {
        return (
            <img
                src={src} alt={name}
                onError={() => setFailed(true)}
                className="w-14 h-14 object-contain"
            />
        );
    }
    return (
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-logo-bg border border-border-theme">
            <span className="text-xs font-black text-foreground/40 select-none">
                {name.slice(0, 2).toUpperCase()}
            </span>
        </div>
    );
}

export default function MatchCard({ match, onClick, isActive = false }: MatchCardProps) {
    const isLive = match.status === 'Trực tiếp';
    const hasScore = match.homeScore !== null && match.awayScore !== null;
    const [leagueLogoErr, setLeagueLogoErr] = useState(false);

    return (
        <div
            onClick={() => onClick(match)}
            className={`relative flex flex-col h-full bg-gradient-to-br from-mc-bg-start to-mc-bg-end border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer overflow-hidden group
                ${isActive ? 'border-accent' : 'border-border-theme hover:border-mc-hover-border hover:from-mc-hover-bg hover:to-mc-hover-bg'}`}
        >
            {isActive && <span className="absolute left-0 inset-y-0 w-1.5 bg-accent rounded-r-full" />}

            {/* ── Row 1: Status | League | HOT ── */}
            <div className="flex items-center justify-between gap-2 mb-3">
                {/* Status */}
                <div className="flex-shrink-0">
                    {isLive ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-accent-red">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
                            Live
                        </span>
                    ) : match.status === 'Đã kết thúc' ? (
                        <span className="text-[13px] font-bold text-foreground/40">▶ FT</span>
                    ) : (
                        <span className="text-[13px] font-bold text-foreground/50">▶ Sắp đấu</span>
                    )}
                </div>

                {/* League */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-center">
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                        {match.leagueLogo && !leagueLogoErr ? (
                            <img src={match.leagueLogo} alt={match.league}
                                onError={() => setLeagueLogoErr(true)}
                                className="w-full h-full object-contain" />
                        ) : <span className="text-xs">⚽</span>}
                    </div>
                    <span className="text-md font-semibold text-foreground/70 truncate">
                        {match.league || 'Không rõ'}
                    </span>
                </div>

                {/* HOT badge */}
                {match.isHot && (
                    <span className="flex-shrink-0 text-[13px] font-black text-hot uppercase">HOT🔥</span>
                )}
            </div>

            {/* ── Row 2: Logo | Minute + Score | Logo ── */}
            <div className="flex items-center justify-between gap-2 my-4">
                <div className="flex justify-center flex-1">
                    <TeamLogo src={match.homeLogo} name={match.home} />
                </div>

                {/* Center: minute on top (always rendered for consistent height), score below */}
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    {/* Luôn render minute — invisible khi không có để giữ chiều cao card */}
                    <span className={`text-[18px] font-black tracking-widest ${match.minute
                            ? (isLive ? 'text-hot' : 'text-red-700 dark:text-red-400')
                            : 'invisible select-none'
                        }`}>
                        {match.minute || '00\''}
                    </span>
                    {hasScore ? (
                        <div className="flex items-center gap-2">
                            <span className={`text-[32px] font-black tabular-nums ${isLive ? 'text-red-500' : 'text-foreground'}`}>
                                {match.homeScore}
                            </span>
                            <span className={`text-[32px] mb-1 font-black tabular-nums ${isLive ? 'text-red-500' : 'text-foreground'}`}>:</span>
                            <span className={`text-[32px] font-black tabular-nums ${isLive ? 'text-red-500' : 'text-foreground'}`}>
                                {match.awayScore}
                            </span>
                        </div>
                    ) : (
                        <span className="text-sm font-bold italic text-foreground/30 px-2">VS</span>
                    )}
                </div>

                <div className="flex justify-center flex-1">
                    <TeamLogo src={match.awayLogo} name={match.away} />
                </div>
            </div>

            {/* ── Row 3: Team names (symmetric, min-height để đồng đều) ── */}
            <div className="flex items-start gap-2">
                <span className="text-lg font-bold text-foreground text-center flex-1 line-clamp-2 leading-tight min-h-[2.5rem] flex items-start justify-center">
                    {match.home}
                </span>
                <div className="w-[90px] flex-shrink-0" />
                <span className="text-lg font-bold text-foreground text-center flex-1 line-clamp-2 leading-tight min-h-[2.5rem] flex items-start justify-center">
                    {match.away}
                </span>
            </div>

            {/* ── Row 4: Time + Date pill (gradient, centered) ── */}
            <div className="flex justify-center">
                <span className="time-pill">
                    {match.time}{match.date ? ` ${match.date}` : ''}
                </span>
            </div>

            {/* ── Row 5: BLV + Xem ngay ── */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-theme">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm flex-shrink-0">🎧</span>
                    <span className="text-sm font-semibold text-hot truncate">
                        {match.commentator || 'BLV'}
                    </span>
                </div>
                <button
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-all
                        ${isLive
                            ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20'
                            : 'bg-hot-bg text-hot border border-hot-border hover:opacity-80'
                        }`}
                    onClick={e => { e.stopPropagation(); }}
                >
                    <Play className="w-3 h-3 fill-current" />
                    Xem ngay
                </button>
            </div>
        </div>
    );
}
