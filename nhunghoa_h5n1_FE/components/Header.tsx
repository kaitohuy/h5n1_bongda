'use client';

import { Search, Sun, Moon, Radio } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface HeaderProps {
    onLogoClick?: () => void;
    currentSource?: 'timbageek' | 'gavangtv';
    onSourceChange?: (source: 'timbageek' | 'gavangtv') => void;
}

export default function Header({ onLogoClick, currentSource, onSourceChange }: HeaderProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Đồng bộ local source state
    const [localSource, setLocalSource] = useState<'timbageek' | 'gavangtv'>('gavangtv');

    useEffect(() => {
        setMounted(true);
        const savedSource = localStorage.getItem('h5n1_preferred_source') as 'timbageek' | 'gavangtv';
        if (savedSource && (savedSource === 'timbageek' || savedSource === 'gavangtv')) {
            setLocalSource(savedSource);
            if (onSourceChange && !currentSource) {
                onSourceChange(savedSource);
            }
        }
    }, [currentSource, onSourceChange]);

    const activeSource = currentSource || localSource;

    const handleSourceSelect = (src: 'timbageek' | 'gavangtv') => {
        localStorage.setItem('h5n1_preferred_source', src);
        setLocalSource(src);
        if (onSourceChange) {
            onSourceChange(src);
        } else {
            // Nếu không ở trang chủ (chưa truyền callback), chuyển hướng về trang chủ kèm query source
            router.push(`/?source=${src}`);
        }
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-[var(--header-bg)] border-b border-border-theme/40 backdrop-blur-md transition-colors duration-200 shadow-sm">
            {/* Top row: Logo & Action buttons */}
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
                {/* ── Logo / Brand ── */}
                <button
                    onClick={() => {
                        if (onLogoClick) onLogoClick();
                        else router.push('/');
                    }}
                    className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity"
                    aria-label="Về trang chủ"
                >
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="h-10 w-auto object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span
                        className="font-extrabold tracking-normal flex gap-1 items-baseline"
                        style={{ fontFamily: 'var(--font-meow-script), cursive', fontSize: '32px', lineHeight: '1' }}
                    >
                        <span className="text-[var(--logo-text-primary)]">H5N1</span>
                        <span className="text-[var(--logo-text-accent)] text-lg font-bold font-sans tracking-tight ml-1 hidden xs:inline">Bóng Đá</span>
                    </span>
                </button>

                {/* ── Desktop Segmented Control (Hidden on Mobile) ── */}
                <div className="hidden md:flex items-center bg-slate-200/60 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-border-theme/60 gap-4 text-xs font-bold shadow-inner">
                    {/* Hàng 1: Tabs Điều Hướng */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900/80 p-0.5 rounded-xl border border-border-theme/20 shadow-sm">
                        <Link 
                            href="/" 
                            className={`px-4 py-1.5 rounded-lg transition-all duration-200 ${
                                pathname === '/' 
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                                    : 'text-foreground/70 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            Trực Tiếp
                        </Link>
                        <Link 
                            href="/bang-xep-hang" 
                            className={`px-4 py-1.5 rounded-lg transition-all duration-200 ${
                                pathname === '/bang-xep-hang' 
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                                    : 'text-foreground/70 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            Bảng Xếp Hạng
                        </Link>
                    </div>

                    {/* Dải phân cách dọc */}
                    <div className="w-[1px] h-6 bg-border-theme/80" />

                    {/* Hàng 2: Bộ chọn nguồn */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-foreground/45 uppercase tracking-wider pl-1">Nguồn:</span>
                        <button
                            onClick={() => handleSourceSelect('timbageek')}
                            className={`relative px-3.5 py-1.5 rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                                activeSource === 'timbageek'
                                    ? 'bg-slate-100 dark:bg-slate-700 text-foreground border border-border-theme shadow-sm font-black'
                                    : 'text-foreground/60 hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${activeSource === 'timbageek' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            Lương Sơn
                        </button>
                        <button
                            onClick={() => handleSourceSelect('gavangtv')}
                            className={`relative px-3.5 py-1.5 rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                                activeSource === 'gavangtv'
                                    ? 'bg-slate-100 dark:bg-slate-700 text-foreground border border-border-theme shadow-sm font-black'
                                    : 'text-foreground/60 hover:text-foreground hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${activeSource === 'gavangtv' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            Gà Vàng
                        </button>
                    </div>
                </div>

                {/* ── Right Action Buttons ── */}
                <div className="flex items-center gap-1.5">
                    {/* Theme Toggle */}
                    {mounted && (
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="
                                p-2 rounded-xl text-foreground/60 hover:text-foreground
                                bg-[var(--header-btn-bg)] hover:bg-[var(--header-btn-hover)] border border-transparent hover:border-border-theme
                                transition-all duration-150 shadow-sm
                            "
                            aria-label="Chuyển giao diện"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Mobile Double Row Layout (Always Visible on Mobile) ── */}
            <div className="md:hidden w-full px-4 pb-3 pt-1 border-t border-border-theme/20 bg-[var(--header-bg)] flex justify-center">
                <div className="w-full max-w-sm flex items-center justify-between bg-slate-200/60 dark:bg-slate-800/40 p-1 rounded-xl border border-border-theme/60 text-[11px] font-bold shadow-inner gap-1">
                    {/* Mobile Tabs */}
                    <div className="flex items-center bg-white dark:bg-slate-900/80 p-0.5 rounded-lg border border-border-theme/20 shadow-sm">
                        <Link 
                            href="/" 
                            className={`px-3 py-1.5 rounded-md transition-all duration-150 ${
                                pathname === '/' 
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold shadow-sm' 
                                    : 'text-foreground/70 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            Trực Tiếp
                        </Link>
                        <Link 
                            href="/bang-xep-hang" 
                            className={`px-3 py-1.5 rounded-md transition-all duration-150 ${
                                pathname === '/bang-xep-hang' 
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold shadow-sm' 
                                    : 'text-foreground/70 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            BXH
                        </Link>
                    </div>

                    {/* Dải phân cách dọc */}
                    <div className="w-[1px] h-4 bg-border-theme/40" />

                    {/* Mobile Sources */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handleSourceSelect('timbageek')}
                            className={`px-2.5 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-1 ${
                                activeSource === 'timbageek'
                                    ? 'bg-slate-100 dark:bg-slate-700 text-foreground border border-border-theme shadow-xs font-black'
                                    : 'text-foreground/60'
                            }`}
                        >
                            <span className={`w-1 h-1 rounded-full ${activeSource === 'timbageek' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            Lương Sơn
                        </button>
                        <button
                            onClick={() => handleSourceSelect('gavangtv')}
                            className={`px-2.5 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-1 ${
                                activeSource === 'gavangtv'
                                    ? 'bg-slate-100 dark:bg-slate-700 text-foreground border border-border-theme shadow-xs font-black'
                                    : 'text-foreground/60'
                            }`}
                        >
                            <span className={`w-1 h-1 rounded-full ${activeSource === 'gavangtv' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            Gà Vàng
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
