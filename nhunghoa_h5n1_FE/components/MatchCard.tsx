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
                className="w-12 h-12 object-contain"
            />
        );
    }
    return (
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-logo-bg border border-border-theme">
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

    const cardClasses = 'flex flex-col bg-gradient-to-br from-mc-bg-start to-mc-bg-end border border-border-theme rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer relative group overflow-hidden hover:bg-mc-hover-bg hover:from-mc-hover-bg hover:to-mc-hover-bg hover:border-mc-hover-border';

    return (
        <div onClick={() => onClick(match)} className={cardClasses}>
            {isActive && <span className="absolute left-0 inset-y-0 w-1.5 bg-accent rounded-r-full" />}

            {/* 1. Top Header (League, Time, Date) */}
            <div className={`grid grid-cols-3 items-center gap-2 mb-4 pb-3 border-b ${isLive ? 'border-red-500/20' : 'border-border-theme'}`}>

                {/* Left (League) */}
                <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-logo-bg p-1 flex items-center justify-center text-foreground/50 border border-border-theme/50">
                        {match.leagueLogo && !leagueLogoErr ? (
                            <img src={match.leagueLogo} alt={match.league}
                                onError={() => setLeagueLogoErr(true)}
                                className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-xs">🏆</span>
                        )}
                    </div>
                    <span className="text-sm text-foreground/60 font-medium whitespace-normal line-clamp-2">
                        {match.league || 'Không rõ'}
                    </span>
                </div>

                {/* Center (Time) */}
                <div className="flex items-center justify-center text-[28px] font-black text-foreground tabular-nums tracking-tight">
                    {match.time}
                </div>

                {/* Right (Date/Status) */}
                <div className="flex flex-col items-center justify-center gap-1">
                    {isLive ? (
                        <span className="bg-accent-red/10 text-accent-red border border-accent-red/30 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider flex items-center gap-1.5 uppercase">
                            <span className="w-1 h-1 rounded-full bg-accent-red animate-pulse" />
                            {match.minute || 'LIVE'}
                        </span>
                    ) : (
                        <span className="text-sm font-bold text-foreground/70">
                            {match.date || (match.status === 'Đã kết thúc' ? 'FT' : match.status)}
                        </span>
                    )}

                    {match.isHot && !isLive && (
                        <span className="bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mt-1">
                            🔥 Hot
                        </span>
                    )}
                </div>
            </div>

            {/* 2. Teams & Score Area (Main Body) */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* Home Team */}
                <div className="flex flex-col items-center gap-2">
                    <TeamLogo src={match.homeLogo} name={match.home} />
                    <span className="text-base font-bold text-foreground text-center whitespace-normal line-clamp-2 min-h-[2rem]">
                        {match.home}
                    </span>
                </div>

                {/* Center (VS / Score) */}
                <div className="flex flex-col items-center justify-center px-2">
                    {hasScore ? (
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-[28px] font-black tabular-nums ${isLive ? 'text-red-500' : 'text-foreground'}`}>{match.homeScore}</span>
                                <span className="text-foreground/30 text-sm font-bold">-</span>
                                <span className={`text-[28px] font-black tabular-nums ${isLive ? 'text-red-500' : 'text-foreground'}`}>{match.awayScore}</span>
                            </div>
                            {isLive && match.minute && (
                                <span className="text-[10px] font-bold text-red-500 dark:text-red-500 tracking-wider">
                                    {match.minute}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            <span className="flex items-center justify-center px-2 text-sm font-bold italic text-foreground/30">
                                VS
                            </span>
                            {isLive && <Play className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-opacity fill-accent" />}
                        </div>
                    )}
                </div>

                {/* Away Team */}
                <div className="flex flex-col items-center gap-2">
                    <TeamLogo src={match.awayLogo} name={match.away} />
                    <span className="text-base font-bold text-foreground text-center whitespace-normal line-clamp-2 min-h-[2rem]">
                        {match.away}
                    </span>
                </div>
            </div>

        </div>
    );
}
