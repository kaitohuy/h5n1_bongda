'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { LeagueInfo } from '@/app/types';

interface LeagueFilterProps {
    leagues: LeagueInfo[];
    activeLeagueId: string;
    onChange: (leagueId: string) => void;
}

export default function LeagueFilter({ leagues, activeLeagueId, onChange }: LeagueFilterProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const active = leagues.find(l => l.leagueId === activeLeagueId);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative shrink-0">
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap border ${activeLeagueId
                    ? 'bg-accent text-white shadow-md border-transparent'
                    : 'bg-surface border-border-theme text-foreground/80 hover:bg-surface-hover'
                    }`}
            >
                {active?.leagueLogo && (
                    <img
                        src={active.leagueLogo}
                        alt={active.league}
                        className="w-4 h-4 object-contain rounded-sm"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                )}
                <span>{active ? active.league : 'Tất cả giải đấu'}</span>
                {activeLeagueId ? (
                    <X
                        className="w-3.5 h-3.5 opacity-60 hover:opacity-100"
                        onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); }}
                    />
                ) : (
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
            </button>

            {open && leagues.length > 0 && (
                <div className="
                    absolute right-0 top-full mt-2 z-50 w-64 max-h-80 overflow-y-auto
                    bg-surface border border-border-theme shadow-xl rounded-xl
                    hide-scrollbar
                ">
                    {/* All option */}
                    <button
                        onClick={() => { onChange(''); setOpen(false); }}
                        className={`
                            w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold
                            transition-colors hover:bg-surface-hover
                            ${!activeLeagueId ? 'text-accent' : 'text-foreground/80'}
                        `}
                    >
                        <span>Tất cả giải đấu</span>
                        <span className="text-xs text-foreground/40">{leagues.reduce((s, l) => s + l.count, 0)}</span>
                    </button>
                    <div className="border-t border-border/50 mx-2" />

                    {leagues.map(league => (
                        <button
                            key={league.leagueId}
                            onClick={() => { onChange(league.leagueId); setOpen(false); }}
                            className={`
                                w-full flex items-center gap-3 px-4 py-2.5 text-sm
                                transition-colors hover:bg-surface-hover text-left
                                ${activeLeagueId === league.leagueId ? 'text-accent font-bold' : 'text-foreground/80 font-medium'}
                            `}
                        >
                            {league.leagueLogo && (
                                <div className="w-6 h-6 rounded-full bg-surface-hover p-0.5 flex-shrink-0 flex items-center justify-center">
                                    <img
                                        src={league.leagueLogo}
                                        alt={league.league}
                                        className="w-full h-full object-contain"
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                            )}
                            <span className="flex-1 truncate">{league.league}</span>
                            <span className="text-xs text-foreground/40 shrink-0">{league.count}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
