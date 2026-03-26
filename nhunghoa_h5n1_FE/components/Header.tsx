'use client';

import { Search, Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface HeaderProps {
    onLogoClick?: () => void;
}

export default function Header({ onLogoClick }: HeaderProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    useEffect(() => { setMounted(true); }, []);

    return (
        <header className="sticky top-0 z-50 w-full bg-[var(--header-bg)] transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

                {/* ── Logo / Brand ── */}
                <button
                    onClick={onLogoClick}
                    className="flex items-center gap-3 shrink-0 hover:opacity-85 transition-opacity"
                    aria-label="Về trang chủ"
                >
                    {/* Placeholder logo — bạn thêm file /logo.png sau */}
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="h-12 w-auto object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {/* Fallback nếu chưa có logo: hiện tên site */}
                    <span
                        className="font-extrabold tracking-normal flex gap-1.5"
                        style={{ fontFamily: 'var(--font-meow-script), cursive', fontSize: '38px', lineHeight: '1' }}
                    >
                        <span className="text-[var(--logo-text-primary)]">
                            H5N1
                        </span>
                        <span className="text-[var(--logo-text-accent)] hidden sm:inline">
                            Bóng Đá
                        </span>
                    </span>
                </button>

                {/* ── Center Navigation (Desktop) ── */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
                    <Link href="/" className="hover:text-[var(--logo-text-accent)] transition-colors">Trực Tiếp</Link>
                    <Link href="/bang-xep-hang" className="text-foreground/80 hover:text-[var(--logo-text-accent)] transition-colors">Bảng Xếp Hạng</Link>
                </nav>

                {/* ── Right actions ── */}
                <div className="flex items-center gap-1">

                    {/* Search button (placeholder — có thể gắn modal sau) */}
                    <button
                        className="
                            flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                            text-foreground/60 hover:text-foreground bg-[var(--header-btn-bg)] hover:bg-[var(--header-btn-hover)]
                            border border-transparent hover:border-border-theme
                            transition-all duration-150
                        "
                        aria-label="Tìm kiếm"
                    >
                        <Search size={18} />
                    </button>

                    {/* Theme toggle */}
                    {mounted && (
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="
                            p-2 rounded-xl text-foreground/60 hover:text-foreground
                                bg-[var(--header-btn-bg)] hover:bg-[var(--header-btn-hover)] border border-transparent hover:border-border-theme
                                transition-all duration-150
                            "
                            aria-label="Chuyển giao diện"
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                    )}

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="
                            md:hidden p-2 rounded-xl text-foreground/60 hover:text-foreground
                            bg-[var(--header-btn-bg)] hover:bg-[var(--header-btn-hover)] border border-transparent hover:border-border-theme
                            transition-all duration-150
                        "
                        aria-label="Menu"
                    >
                        {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </div>

            {/* ── Mobile Navigation Menu ── */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-16 left-0 w-full bg-[var(--header-bg)] border-b border-border-theme shadow-lg py-4 px-4 flex flex-col gap-4 z-40 animate-in slide-in-from-top-2 fade-in duration-200">
                    <Link 
                        href="/" 
                        className="text-base font-bold text-foreground/80 hover:text-[var(--logo-text-accent)] transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        Trực Tiếp
                    </Link>
                    <Link 
                        href="/bang-xep-hang" 
                        className="text-base font-bold text-foreground/80 hover:text-[var(--logo-text-accent)] transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        Bảng Xếp Hạng
                    </Link>
                </div>
            )}
        </header>
    );
}
