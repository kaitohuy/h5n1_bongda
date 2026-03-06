'use client';

import { Search, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface HeaderProps {
    onLogoClick?: () => void;
}

export default function Header({ onLogoClick }: HeaderProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    // eslint-disable-next-line
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
                </div>
            </div>
        </header>
    );
}
