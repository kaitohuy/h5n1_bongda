'use client';

import { FilterTab } from '@/app/types';

const TABS: { id: FilterTab; label: string; icon: string }[] = [
    { id: 'live', label: 'LIVE', icon: '🔴' },
    { id: 'hot', label: 'Trận Hot', icon: '🔥' },
    { id: 'today', label: 'Hôm nay', icon: '📅' },
    { id: 'tomorrow', label: 'Ngày mai', icon: '🗓️' },
    { id: 'all', label: 'Tất cả', icon: '⚽' },
];

interface SubTabBarProps {
    active: FilterTab;
    counts: Record<FilterTab, number>;
    onChange: (tab: FilterTab) => void;
}

export default function SubTabBar({ active, counts, onChange }: SubTabBarProps) {
    return (
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
            {TABS.map(tab => {
                const count = counts[tab.id] ?? 0;
                const isActive = active === tab.id;
                const isLive = tab.id === 'live';
                const isHot = tab.id === 'hot';
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap border ${isActive
                            ? 'bg-accent-red/10 text-accent-red border-accent-red shadow-sm'
                            : 'bg-surface border-border-theme text-foreground/80 hover:bg-surface-hover'
                            }`}
                    >
                        {/* Live tab: pulsing dot */}
                        {isLive && (
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${isActive ? 'bg-accent-red' : 'bg-red-500'}`} />
                        )}
                        {!isLive && <span className="text-sm leading-none">{tab.icon}</span>}
                        <span>{tab.label}</span>
                        {count > 0 && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${isActive
                                ? 'bg-accent-red/20 text-accent-red'
                                : 'bg-surface-hover text-foreground/60'
                                }`}>
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
