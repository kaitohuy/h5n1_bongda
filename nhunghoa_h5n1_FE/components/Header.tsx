'use client';

import { Sun, Moon, Settings, Tv } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import CommentatorSettingsModal from './CommentatorSettingsModal';

interface HeaderProps {
    onLogoClick?: () => void;
    currentSource?: string;
    onSourceChange?: (source: string) => void;
    onSettingsChanged?: () => void;
}

export default function Header({ onLogoClick, currentSource = 'vtv6', onSourceChange, onSettingsChanged }: HeaderProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const BE_URL = process.env.NEXT_PUBLIC_BE_URL || 'http://localhost:8000';

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <>
            <header className="sticky top-0 z-50 w-full bg-[var(--header-bg)] border-b border-border-theme/40 backdrop-blur-md transition-colors duration-200 shadow-sm">
                {/* Top row: Logo & Action buttons */}
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
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
                            className="h-9 sm:h-10 w-auto object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span
                            className="font-extrabold tracking-normal flex gap-1 items-baseline"
                            style={{ fontFamily: 'var(--font-meow-script), cursive', fontSize: '30px', lineHeight: '1' }}
                        >
                            <span className="text-[var(--logo-text-primary)]">H5N1</span>
                            <span className="text-[var(--logo-text-accent)] text-base sm:text-lg font-bold font-sans tracking-tight ml-1 hidden xs:inline">Bóng Đá</span>
                        </span>
                    </button>

                    {/* ── Center: Source Switcher & Navigation Tabs ── */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Source Switcher Toggle */}
                        {pathname === '/' && onSourceChange && (
                            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/60 p-1 rounded-xl border border-border-theme/60 text-xs font-extrabold shadow-inner">
                                <button
                                    onClick={() => onSourceChange('vtv6')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${
                                        currentSource === 'vtv6'
                                            ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-md'
                                            : 'text-foreground/70 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <Tv size={13} />
                                    <span>VTV6</span>
                                </button>
                                <button
                                    onClick={() => onSourceChange('colatv')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 ${
                                        currentSource === 'colatv'
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                                            : 'text-foreground/70 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span>ColaTV</span>
                                </button>
                            </div>
                        )}

                        {/* Navigation Tabs */}
                        <div className="hidden sm:flex items-center bg-slate-200/60 dark:bg-slate-800/40 p-1 rounded-xl border border-border-theme/60 gap-1 text-xs font-bold shadow-inner">
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
                                className={`px-3.5 py-1.5 rounded-lg transition-all duration-200 ${
                                    pathname === '/bang-xep-hang' 
                                        ? 'bg-white dark:bg-slate-900 text-foreground shadow-sm' 
                                        : 'text-foreground/70 hover:text-foreground'
                                }`}
                            >
                                BXH
                            </Link>
                        </div>
                    </div>

                    {/* ── Right Action Buttons ── */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Commentator / Source Settings Button */}
                        {mounted && (
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="
                                    p-2 rounded-xl text-foreground/60 hover:text-foreground
                                    bg-[var(--header-btn-bg)] hover:bg-[var(--header-btn-hover)] border border-transparent hover:border-border-theme
                                    transition-all duration-150 shadow-sm flex items-center gap-1.5
                                "
                                title="Cài đặt nguồn phát & BLV yêu thích"
                                aria-label="Cài đặt nguồn phát & BLV yêu thích"
                            >
                                <Settings size={18} />
                            </button>
                        )}

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
