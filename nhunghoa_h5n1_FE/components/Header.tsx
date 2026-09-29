'use client';

import { Sun, Moon, Settings, Tv, ChevronDown, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import CommentatorSettingsModal from './CommentatorSettingsModal';

interface HeaderProps {
    onLogoClick?: () => void;
    currentSource?: string;
    onSourceChange?: (source: string) => void;
    onSettingsChanged?: () => void;
}

const SOURCES = [
    { id: 'gavangtv', label: 'Gà Vàng TV', shortLabel: 'Gà Vàng', color: 'bg-gradient-to-r from-yellow-500 to-amber-600', dot: 'bg-amber-400' },
    { id: 'cakhiatv', label: 'CakhiaTV',   shortLabel: 'CakhiaTV', color: 'bg-gradient-to-r from-amber-500 to-orange-500', dot: 'bg-orange-400' },
    { id: 'colatv',   label: 'ColaTV',     shortLabel: 'ColaTV',   color: 'bg-gradient-to-r from-emerald-500 to-teal-500', dot: 'bg-emerald-400' },
    { id: 'vtv6',      label: 'VTV6',       shortLabel: 'VTV6',     color: 'bg-gradient-to-r from-red-600 to-rose-500',    dot: 'bg-red-500' },
];

export default function Header({ onLogoClick, currentSource = 'gavangtv', onSourceChange, onSettingsChanged }: HeaderProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const router = useRouter();

    const BE_URL = process.env.NEXT_PUBLIC_BE_URL || 'http://localhost:8000';

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close mobile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsSourceDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeSourceObj = SOURCES.find(s => s.id === currentSource) || SOURCES[0];

    return (
        <>
            <header className="sticky top-0 z-50 w-full bg-[var(--header-bg)] border-b border-border-theme/40 backdrop-blur-md transition-colors duration-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-1.5 sm:gap-4">
                    {/* ── Left: Logo / Brand ── */}
                    <button
                        onClick={() => {
                            if (onLogoClick) onLogoClick();
                            else router.push('/');
                        }}
                        className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity"
                        aria-label="Về trang chủ"
                    >
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="h-8 sm:h-10 w-auto object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span
                            className="font-extrabold tracking-normal flex gap-1 items-baseline"
                            style={{ fontFamily: 'var(--font-meow-script), cursive', fontSize: '28px', lineHeight: '1' }}
                        >
                            <span className="text-[var(--logo-text-primary)]">H5N1</span>
                            <span className="text-[var(--logo-text-accent)] text-base sm:text-lg font-bold font-sans tracking-tight ml-1 hidden sm:inline">Bóng Đá</span>
                        </span>
                    </button>

                    {/* ── Center: Source Switcher ── */}
                    {pathname === '/' && onSourceChange && (
                        <>
                            {/* Mobile Source Dropdown (< md) */}
                            <div className="relative md:hidden" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border-theme/80 bg-slate-200/80 dark:bg-slate-800/80 text-foreground text-xs font-black shadow-sm transition-all active:scale-95"
                                >
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${activeSourceObj.dot}`} />
                                    <span className="max-w-[85px] truncate">{activeSourceObj.label}</span>
                                    <ChevronDown size={14} className={`text-foreground/60 transition-transform duration-200 ${isSourceDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isSourceDropdownOpen && (
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-44 bg-[var(--surface-bg)] dark:bg-slate-900 border border-border-theme/80 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
                                        <div className="px-2.5 py-1 text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                                            Chọn Nguồn Phát
                                        </div>
                                        <div className="space-y-1">
                                            {SOURCES.map(src => {
                                                const isSelected = mounted && currentSource === src.id;
                                                return (
                                                    <button
                                                        key={src.id}
                                                        onClick={() => {
                                                            onSourceChange(src.id);
                                                            setIsSourceDropdownOpen(false);
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                                            isSelected
                                                                ? `${src.color} text-white shadow-md font-extrabold`
                                                                : 'text-foreground/80 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${src.dot}`} />
                                                            <span>{src.label}</span>
                                                        </div>
                                                        {isSelected && <Check size={14} className="stroke-[3]" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-border-theme/40">
                                            <Link
                                                href="/bang-xep-hang"
                                                onClick={() => setIsSourceDropdownOpen(false)}
                                                className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-foreground/70 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60"
                                            >
                                                <span>📊 Bảng Xếp Hạng</span>
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Desktop Source Switcher & Navigation (>= md) */}
                            <div className="hidden md:flex items-center gap-2 lg:gap-3">
                                <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/60 p-1 rounded-xl border border-border-theme/60 text-xs font-extrabold shadow-inner">
                                    {SOURCES.map(src => {
                                        const isSelected = mounted && currentSource === src.id;
                                        return (
                                            <button
                                                key={src.id}
                                                onClick={() => onSourceChange(src.id)}
                                                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all duration-200 ${
                                                    isSelected
                                                        ? `${src.color} text-white shadow-md font-black`
                                                        : 'text-foreground/70 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                {src.id === 'vtv6' && <Tv size={13} />}
                                                <span>{src.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Navigation Tabs */}
                                <div className="flex items-center bg-slate-200/60 dark:bg-slate-800/40 p-1 rounded-xl border border-border-theme/60 gap-1 text-xs font-bold shadow-inner">
                                    <Link 
                                        href="/" 
                                        className={`px-3.5 py-1.5 rounded-lg transition-all duration-200 ${
                                            pathname === '/' 
                                                ? 'bg-white dark:bg-slate-900 text-foreground shadow-sm' 
                                                : 'text-foreground/70 hover:text-foreground'
                                        }`}
                                    >
                                        Trực Tiếp
                                    </Link>
                                    <Link 
                                        href="/bang-xep-hang" 
                                        className="px-3.5 py-1.5 rounded-lg transition-all duration-200 text-foreground/70 hover:text-foreground"
                                    >
                                        BXH
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Right: Setting & Theme Light/Dark ── */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Commentator / Source Settings Button */}
                        {mounted && (
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="
                                    p-2 rounded-xl text-foreground/70 hover:text-foreground
                                    bg-[var(--header-btn-bg)] hover:bg-[var(--header-btn-hover)] border border-transparent hover:border-border-theme
                                    transition-all duration-150 shadow-sm flex items-center justify-center
                                "
                                title="Cài đặt nguồn phát & BLV yêu thích"
                                aria-label="Cài đặt nguồn phát & BLV yêu thích"
                            >
                                <Settings size={18} />
                            </button>
                        )}

                        {/* Theme Toggle (Light / Dark) */}
                        {mounted && (
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className="
                                    p-2 rounded-xl text-foreground/70 hover:text-foreground
                                    bg-[var(--header-btn-bg)] hover:bg-[var(--header-btn-hover)] border border-transparent hover:border-border-theme
                                    transition-all duration-150 shadow-sm flex items-center justify-center
                                "
                                aria-label="Chuyển giao diện sáng/tối"
                                title="Chuyển đổi giao diện sáng / tối"
                            >
                                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Commentator & Source Settings Modal */}
            <CommentatorSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                BE_URL={BE_URL}
                currentSource={currentSource}
                onSourceChange={onSourceChange}
                onSaveSuccess={onSettingsChanged}
            />
        </>
    );
}
