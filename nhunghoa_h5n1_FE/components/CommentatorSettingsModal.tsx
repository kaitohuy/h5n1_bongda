'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowUp, ArrowDown, RotateCcw, Check, Sparkles, Search, GripVertical, Globe, Tv, Radio } from 'lucide-react';

export interface CommentatorItem {
    id: string;
    name: string;
    cleanName: string;
    norm: string;
    userImage?: string;
    fansCount?: number;
    visitHistory?: number;
    matchCount?: number;
    source?: string;
}

interface CommentatorSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    BE_URL?: string;
    currentSource?: string;
    onSourceChange?: (source: string) => void;
    onSaveSuccess?: () => void;
}

export function normalizeCommentator(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^blv\s*/i, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

// Pre-seeded master list for instant 0ms initial display
const STATIC_MASTER_CAKHIA = [
    'HIRO', 'TONI', 'JOHAN', 'ROY', 'RIO', 'BEE', 'BRADY', 'ZANE', 
    'XMEN', 'RAVEN', 'OLER', 'LOGAN', 'KEN', 'ASTRA', 'NEMO', 'POLO', 
    'SILVA', 'MAX', 'FILIP', 'TOM', 'NICK', 'JEAN', 'ALAN', 'FELIX'
].map(name => ({
    id: `cakhia_${normalizeCommentator(name)}`,
    name: `BLV ${name}`,
    cleanName: name,
    norm: normalizeCommentator(name),
    userImage: '',
    fansCount: 0,
    visitHistory: 0,
    matchCount: 0,
    source: 'cakhiatv'
}));

const STATIC_MASTER_COLA = [
    'Già Làng', 'Revive', 'Sting', 'Cà Rốt', 'Leo', 'Bắp', 'Bún', 
    'Sơn Đen', 'Hải Quay Xe', 'Mỳ Tôm', 'Thỏ Trắng', 'Chanh', 'Bơ', 'Táo', 'Khế'
].map(name => ({
    id: `cola_${normalizeCommentator(name)}`,
    name: `BLV ${name}`,
    cleanName: name,
    norm: normalizeCommentator(name),
    userImage: '',
    fansCount: 0,
    visitHistory: 0,
    matchCount: 0,
    source: 'colatv'
}));

export default function CommentatorSettingsModal({ 
    isOpen, 
    onClose, 
    BE_URL = 'http://localhost:8000', 
    currentSource = 'vtv6',
    onSourceChange,
    onSaveSuccess 
}: CommentatorSettingsModalProps) {
    const [commentators, setCommentators] = useState<CommentatorItem[]>([]);
    const [defaultList, setDefaultList] = useState<CommentatorItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [savedNotice, setSavedNotice] = useState(false);
    
    // Default source state
    const [selectedSource, setSelectedSource] = useState(currentSource);

    useEffect(() => {
        setSelectedSource(currentSource);
    }, [currentSource]);

    // Drag and drop state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Ref to hold current state for auto-save on close
    const commentatorsRef = useRef<CommentatorItem[]>([]);
    useEffect(() => {
        commentatorsRef.current = commentators;
    }, [commentators]);

    // Fetch master list from Backend when modal opens or selectedSource changes
    useEffect(() => {
        if (!isOpen) return;
        if (selectedSource === 'vtv6') {
            setCommentators([]);
            return;
        }

        let mounted = true;

        // 1. Instant Cache / Pre-seeded initial display (Zero latency)
        let initialList = selectedSource === 'cakhiatv' ? STATIC_MASTER_CAKHIA : STATIC_MASTER_COLA;
        try {
            const cachedMasterJson = localStorage.getItem(`h5n1_cached_commentators_${selectedSource}`);
            if (cachedMasterJson) {
                const parsed = JSON.parse(cachedMasterJson);
                if (Array.isArray(parsed) && parsed.length > 0) initialList = parsed;
            }
        } catch {}

        const storageKey = `h5n1_commentator_priority_${selectedSource}`;
        let savedPriorityJson = localStorage.getItem(storageKey);
        if (!savedPriorityJson && selectedSource === 'colatv') {
            savedPriorityJson = localStorage.getItem('h5n1_commentator_priority');
        }

        const applyPriority = (baseList: CommentatorItem[]) => {
            if (savedPriorityJson) {
                try {
                    const savedNorms: string[] = JSON.parse(savedPriorityJson);
                    const ordered: CommentatorItem[] = [];
                    const remaining = [...baseList];

                    savedNorms.forEach(norm => {
                        const idx = remaining.findIndex(c => c.norm === norm);
                        if (idx !== -1) {
                            ordered.push(remaining[idx]);
                            remaining.splice(idx, 1);
                        }
                    });

                    return [...ordered, ...remaining];
                } catch {}
            }
            return baseList;
        };

        const initialOrdered = applyPriority(initialList);
        setCommentators(initialOrdered);
        commentatorsRef.current = initialOrdered;
        setDefaultList(initialList);

        // 2. Background fresh fetch from backend
        (async () => {
            try {
                const res = await fetch(`${BE_URL}/api/commentators?source=${selectedSource}`);
                const data = await res.json();
                if (data.success && data.commentators && Array.isArray(data.commentators) && data.commentators.length > 0) {
                    const fetchedList: CommentatorItem[] = data.commentators;
                    if (!mounted) return;

                    localStorage.setItem(`h5n1_cached_commentators_${selectedSource}`, JSON.stringify(fetchedList));
                    setDefaultList(fetchedList);
                    const finalList = applyPriority(fetchedList);
                    setCommentators(finalList);
                    commentatorsRef.current = finalList;
                }
            } catch (err) {
                console.warn('Failed to refresh commentators:', err);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isOpen, selectedSource, BE_URL]);

    if (!isOpen) return null;

    // Auto-save logic
    const saveToLocalStorage = (list: CommentatorItem[], src: string) => {
        localStorage.setItem('h5n1_default_source', src);
        if (list.length > 0 && src !== 'vtv6') {
            const orderNorms = list.map(c => c.norm);
            localStorage.setItem(`h5n1_commentator_priority_${src}`, JSON.stringify(orderNorms));
            localStorage.setItem('h5n1_commentator_priority', JSON.stringify(orderNorms));
        }
        if (onSaveSuccess) onSaveSuccess();
    };

    // Close modal & auto-save
    const handleCloseWithAutoSave = () => {
        saveToLocalStorage(commentatorsRef.current, selectedSource);
        if (onSourceChange && selectedSource !== currentSource) {
            onSourceChange(selectedSource);
        }
        onClose();
    };

    // Move item up
    const handleMoveUp = (index: number) => {
        if (index <= 0) return;
        setCommentators(prev => {
            const next = [...prev];
            const temp = next[index - 1];
            next[index - 1] = next[index];
            next[index] = temp;
            saveToLocalStorage(next, selectedSource);
            return next;
        });
    };

    // Move item down
    const handleMoveDown = (index: number) => {
        if (index >= commentators.length - 1) return;
        setCommentators(prev => {
            const next = [...prev];
            const temp = next[index + 1];
            next[index + 1] = next[index];
            next[index] = temp;
            saveToLocalStorage(next, selectedSource);
            return next;
        });
    };

    // Drag and Drop handlers
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = (index: number) => {
        if (draggedIndex === null || draggedIndex === index) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        setCommentators(prev => {
            const next = [...prev];
            const [movedItem] = next.splice(draggedIndex, 1);
            next.splice(index, 0, movedItem);
            saveToLocalStorage(next, selectedSource);
            return next;
        });

        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // Reset to default ranking
    const handleResetDefault = () => {
        setCommentators(defaultList);
        setSelectedSource('vtv6');
        localStorage.removeItem('h5n1_commentator_priority');
        localStorage.removeItem('h5n1_commentator_priority_colatv');
        localStorage.removeItem('h5n1_commentator_priority_cakhiatv');
        localStorage.setItem('h5n1_default_source', 'vtv6');
        if (onSourceChange) onSourceChange('vtv6');
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2000);
        if (onSaveSuccess) onSaveSuccess();
    };

    // Manual Save button click
    const handleManualSave = () => {
        saveToLocalStorage(commentators, selectedSource);
        if (onSourceChange && selectedSource !== currentSource) {
            onSourceChange(selectedSource);
        }
        setSavedNotice(true);
        setTimeout(() => {
            setSavedNotice(false);
            onClose();
        }, 500);
    };

    // Filter by search
    const filteredCommentators = commentators.filter(c => {
        if (!searchTerm) return true;
        const normSearch = normalizeCommentator(searchTerm);
        return c.norm.includes(normSearch) || normalizeCommentator(c.name).includes(normSearch);
    });

    const AVAILABLE_SOURCES = [
        { 
            id: 'vtv6', 
            name: 'VTV6 (Mặc định)', 
            desc: 'Kênh truyền hình trực tiếp 24/7',
            badge: '🔴 Trực Tiếp',
            color: 'from-red-600 to-rose-500' 
        },
        { 
            id: 'colatv', 
            name: 'ColaTV', 
            desc: 'Trực tiếp bóng đá, 19+ BLV',
            badge: '🟢 Đa Dạng',
            color: 'from-emerald-500 to-teal-500' 
        },
        { 
            id: 'cakhiatv', 
            name: 'CakhiaTV', 
            desc: '495+ Trận đấu, 24+ BLV Cakhia',
            badge: '🟡 Siêu Nhiều',
            color: 'from-amber-500 to-orange-500' 
        },
    ];

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleCloseWithAutoSave}
        >
            <div 
                className="relative w-full max-w-xl bg-[var(--surface-theme,white)] dark:bg-slate-900 border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Modal Header ── */}
                <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                                Cài Đặt Nguồn Mặc Định & BLV
                            </h3>
                            <p className="text-xs text-foreground/60">
                                Chọn nguồn phát mặc định khi mở web và sắp xếp thứ tự BLV yêu thích
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCloseWithAutoSave}
                        className="p-2 rounded-xl text-foreground/50 hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Đóng"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Section 1: Default Source Selection Cards ── */}
                <div className="px-6 pt-4 pb-2 border-b border-border/30 bg-slate-50/30 dark:bg-slate-800/20">
                    <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-black uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
                            <Globe size={14} className="text-emerald-500" />
                            Nguồn phát mặc định khi mở web:
                        </span>
                        <span className="text-[10px] text-foreground/50 italic">Tự động lưu</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {AVAILABLE_SOURCES.map(src => {
                            const isSelected = selectedSource === src.id;
                            return (
                                <button
                                    key={src.id}
                                    onClick={() => {
                                        setSelectedSource(src.id);
                                        localStorage.setItem('h5n1_default_source', src.id);
                                        if (onSourceChange) onSourceChange(src.id);
                                    }}
                                    className={`relative flex flex-col items-start p-2.5 sm:p-3 rounded-xl border text-left transition-all duration-150 ${
                                        isSelected
                                            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 shadow-sm ring-2 ring-emerald-500/30'
                                            : 'bg-white dark:bg-slate-800/60 border-border/50 hover:border-border hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full mb-1">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700/60 text-foreground/70">
                                            {src.badge}
                                        </span>
                                        {isSelected ? (
                                            <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                                                <Check size={11} strokeWidth={3} />
                                            </div>
                                        ) : (
                                            <div className="w-4 h-4 rounded-full border border-border/80" />
                                        )}
                                    </div>
                                    <div className="font-black text-xs sm:text-sm text-foreground">{src.name}</div>
                                    <div className="text-[10px] text-foreground/50 line-clamp-1 mt-0.5">{src.desc}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Section 2: Commentators or Info Content ── */}
                {selectedSource === 'vtv6' ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center gap-3 my-auto">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center shadow-inner animate-pulse">
                            <Tv size={32} />
                        </div>
                        <h4 className="text-base font-black text-foreground">Kênh VTV6 (Trực Tiếp Thể Thao 24/7)</h4>
                        <p className="text-xs text-foreground/60 max-w-md leading-relaxed">
                            Kênh truyền hình trực tiếp thể thao & giải trí từ Đài Truyền Hình Việt Nam. Luồng phát trực tiếp gốc của VTV phát trực tiếp tại trang chủ không có danh sách BLV riêng.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ── Search Bar & List Header ── */}
                        <div className="px-6 pt-3 pb-2 flex items-center justify-between gap-3">
                            <div className="relative flex-1">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
                                <input
                                    type="text"
                                    placeholder={`Tìm kiếm BLV ${selectedSource === 'cakhiatv' ? 'Cakhia' : 'Cola'} (ROY, Già Làng, HIRO...)`}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-border/40 text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <span className="text-xs font-bold text-foreground/50 shrink-0">
                                {commentators.length} BLV
                            </span>
                        </div>

                        {/* ── Commentators List (Drag & Drop & Tier-List Styling) ── */}
                        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2 no-scrollbar">
                            {isLoading ? (
                                <div className="py-12 flex flex-col items-center justify-center text-foreground/50 gap-2">
                                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs">Đang tải danh sách BLV {selectedSource === 'cakhiatv' ? 'CakhiaTV' : 'ColaTV'}...</span>
                                </div>
                            ) : filteredCommentators.length === 0 ? (
                                <div className="py-8 text-center text-foreground/40 text-sm">
                                    Không tìm thấy BLV nào khớp với từ khóa tìm kiếm
                                </div>
                            ) : (
                                filteredCommentators.map((c) => {
                                    const originalIndex = commentators.findIndex(item => item.id === c.id);
                                    const rank = originalIndex + 1;

                                    const isTop1 = rank === 1; // Tier S - Coral Pink
                                    const isTop2 = rank === 2; // Tier A - Peach Orange
                                    const isTop3 = rank === 3; // Tier B - Warm Yellow

                                    const isDragging = draggedIndex === originalIndex;
                                    const isDragOver = dragOverIndex === originalIndex;

                                    return (
                                        <div
                                            key={c.id}
                                            draggable
                                            onDragStart={() => handleDragStart(originalIndex)}
                                            onDragOver={(e) => handleDragOver(e, originalIndex)}
                                            onDrop={() => handleDrop(originalIndex)}
                                            onDragEnd={() => {
                                                setDraggedIndex(null);
                                                setDragOverIndex(null);
                                            }}
                                            className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
                                                isDragging ? 'opacity-40 scale-95' : ''
                                            } ${
                                                isDragOver ? 'ring-2 ring-emerald-500 scale-[1.01]' : ''
                                            } ${
                                                isTop1
                                                    ? 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-400/40 shadow-sm'
                                                    : isTop2
                                                    ? 'bg-orange-500/10 dark:bg-orange-500/15 border-orange-400/40 shadow-sm'
                                                    : isTop3
                                                    ? 'bg-yellow-500/10 dark:bg-yellow-500/15 border-yellow-400/40 shadow-sm'
                                                    : 'bg-slate-100/40 dark:bg-slate-800/30 border-border/40 hover:border-border-theme'
                                            }`}
                                        >
                                            {/* Left: Grip Handle + Rank Badge + Avatar + Name */}
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="text-foreground/30 hover:text-foreground/70 transition-colors shrink-0">
                                                    <GripVertical size={16} />
                                                </span>

                                                {/* Rank Badge */}
                                                <div className="shrink-0 w-7 text-center">
                                                    {isTop1 ? (
                                                        <span 
                                                            className="inline-flex items-center justify-center w-7 h-6 rounded-lg text-xs font-black text-white shadow-sm"
                                                            style={{ backgroundColor: '#ff7f7f' }}
                                                        >
                                                            #1
                                                        </span>
                                                    ) : isTop2 ? (
                                                        <span 
                                                            className="inline-flex items-center justify-center w-7 h-6 rounded-lg text-xs font-black text-white shadow-sm"
                                                            style={{ backgroundColor: '#ffbf7f' }}
                                                        >
                                                            #2
                                                        </span>
                                                    ) : isTop3 ? (
                                                        <span 
                                                            className="inline-flex items-center justify-center w-7 h-6 rounded-lg text-xs font-black text-slate-900 shadow-sm"
                                                            style={{ backgroundColor: '#ffff7f' }}
                                                        >
                                                            #3
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center justify-center w-7 h-6 rounded-lg text-xs font-bold text-foreground/50 bg-slate-200/60 dark:bg-slate-700/50">
                                                            #{rank}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Avatar */}
                                                <div className="relative shrink-0">
                                                    {c.userImage ? (
                                                        <img
                                                            src={c.userImage}
                                                            alt={c.name}
                                                            className="w-9 h-9 rounded-full object-cover border border-border/50 shadow-sm"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/logo.png';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">
                                                            🎙️
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Name & Stats */}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-extrabold truncate ${
                                                            isTop1 ? 'text-rose-600 dark:text-rose-400' :
                                                            isTop2 ? 'text-orange-600 dark:text-orange-400' :
                                                            isTop3 ? 'text-amber-700 dark:text-yellow-400' :
                                                            'text-foreground'
                                                        }`}>
                                                            {c.name}
                                                        </span>
                                                        {c.norm === 'gialang' && selectedSource === 'colatv' && (
                                                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/10 text-red-500 border border-red-500/20 shrink-0">
                                                                Mặc định
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[11px] text-foreground/50">
                                                        {c.matchCount !== undefined && c.matchCount > 0 && (
                                                            <span>{c.matchCount} trận đấu</span>
                                                        )}
                                                        {c.fansCount !== undefined && c.fansCount > 0 && (
                                                            <span>{c.fansCount} fans</span>
                                                        )}
                                                        {c.visitHistory !== undefined && c.visitHistory > 0 && (
                                                            <span>{(c.visitHistory / 1000000).toFixed(1)}M lượt</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Action Up/Down Buttons */}
                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMoveUp(originalIndex);
                                                    }}
                                                    disabled={originalIndex === 0}
                                                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-border/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                                                    title="Chuyển lên trên"
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMoveDown(originalIndex);
                                                    }}
                                                    disabled={originalIndex === commentators.length - 1}
                                                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-border/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                                                    title="Chuyển xuống dưới"
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}

                {/* ── Modal Footer ── */}
                <div className="px-6 py-3.5 border-t border-border/40 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 gap-3">
                    <button
                        onClick={handleResetDefault}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-foreground/70 hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <RotateCcw size={14} />
                        <span>Mặc định</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {savedNotice && (
                            <span className="flex items-center gap-1 text-xs text-emerald-500 font-bold animate-in fade-in">
                                <Check size={14} /> Đã lưu!
                            </span>
                        )}
                        <button
                            onClick={handleManualSave}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:opacity-95 transition-opacity"
                        >
                            <span>Lưu Cài Đặt</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
