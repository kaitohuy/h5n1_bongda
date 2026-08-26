'use client';

import { X, Maximize, Loader2, Settings, Sparkles, ZoomIn, Check, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Match } from '@/app/types';

interface VideoPlayerProps {
    match: Match;
    streamUrl: string;   // May be an iframe player URL or a raw m3u8/flv URL
    loadingMsg: string;  // Phase-based loading message from parent
    activeServer: string;
    availableServers: string[];
    onServerChange: (server: string) => void;
    onClose: () => void;
}

export interface QualityLevel {
    index: number;
    label: string;
    height: number;
    bitrate: number;
}

/**
 * Detect if the URL is an iframe player page (not a raw stream URL).
 * Raw stream URLs (direct or proxied) always contain .m3u8 or .flv somewhere.
 */
function isIframePlayerUrl(url: string): boolean {
    if (!url) return false;
    if (url.includes('.m3u8') || url.includes('.flv')) return false;
    return true;
}

export default function VideoPlayer({ 
    match, 
    streamUrl, 
    loadingMsg, 
    activeServer, 
    availableServers, 
    onServerChange, 
    onClose 
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hlsRef = useRef<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    // ── Video Enhancement & Settings States ──────────────────────────────────
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSuperClear, setIsSuperClear] = useState(false); // Default: OFF as requested
    const [zoomLevel, setZoomLevel] = useState(100); // 100% to 130%
    const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto

    const useIframe = isIframePlayerUrl(streamUrl);

    // Reset loader state whenever streamUrl changes
    useEffect(() => {
        setIsLoading(true);
        setIsError(false);
        setQualityLevels([]);
        setCurrentQuality(-1);
    }, [streamUrl]);

    // ── Video element player (raw m3u8 / flv streams) ─────────────────────────
    useEffect(() => {
        if (!streamUrl || !videoRef.current || useIframe) return;

        setIsLoading(true);
        setIsError(false);

        let hls: import('hls.js').default | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let flvPlayer: any = null;

        const setupPlayer = async () => {
            const video = videoRef.current!;
            const isFlv = streamUrl.includes('.flv');

            if (isFlv) {
                // ── FLV stream via mpegts.js ──────────────────────────────
                const mpegts = (await import('mpegts.js')).default;
                if (mpegts.getFeatureList().mseLivePlayback) {
                    flvPlayer = mpegts.createPlayer(
                        { type: 'flv', url: streamUrl, isLive: true },
                        {
                            enableWorker: true,
                            enableStashBuffer: false,
                            liveBufferLatencyChasing: true,
                            liveBufferLatencyMaxLatency: 5.0,
                            liveBufferLatencyMinRemain: 1.0,
                        }
                    );
                    flvPlayer.attachMediaElement(video);
                    flvPlayer.load();
                    video.addEventListener('canplay', () => { 
                        setIsLoading(false); 
                        video.play().catch(() => setIsLoading(false)); 
                    }, { once: true });
                    flvPlayer.on(mpegts.Events.ERROR, () => { 
                        setIsError(true); 
                        setIsLoading(false); 
                    });
                } else {
                    setIsError(true); 
                    setIsLoading(false);
                }
            } else {
                // ── HLS stream via hls.js ─────────────────────────────────
                const Hls = (await import('hls.js')).default;
                if (Hls.isSupported()) {
                    hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: false,
                        maxBufferLength: 60,
                        maxMaxBufferLength: 120,
                        maxBufferSize: 100 * 1000 * 1000,  // 100MB
                        manifestLoadingMaxRetry: 3,
                        levelLoadingMaxRetry: 3,
                        fragLoadingMaxRetry: 3,
                        liveSyncDurationCount: 3,
                        liveMaxLatencyDurationCount: 7,
                    });
                    hlsRef.current = hls;

                    hls.loadSource(streamUrl);
                    hls.attachMedia(video);

                    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                        setIsLoading(false);
                        video?.play().catch(() => setIsLoading(false));

                        // Extract available quality levels
                        if (data && data.levels && data.levels.length > 0) {
                            const levels: QualityLevel[] = data.levels.map((lvl, idx) => ({
                                index: idx,
                                height: lvl.height,
                                label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
                                bitrate: lvl.bitrate
                            }));
                            setQualityLevels(levels);
                        }
                    });

                    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                        if (hls && hls.autoLevelEnabled) {
                            // In auto mode
                            setCurrentQuality(-1);
                        } else if (data && typeof data.level === 'number') {
                            setCurrentQuality(data.level);
                        }
                    });

                    hls.on(Hls.Events.ERROR, (_, data) => {
                        if (data.fatal) { 
                            setIsError(true); 
                            setIsLoading(false); 
                        }
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = streamUrl;
                    video.addEventListener('canplay', () => setIsLoading(false), { once: true });
                }
            }
        };

        setupPlayer();

        return () => {
            hls?.destroy();
            hlsRef.current = null;
            flvPlayer?.destroy();
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.removeAttribute('src');
                videoRef.current.load();
            }
        };
    }, [streamUrl, useIframe]);

    // Handle quality selection
    const handleQualityChange = (levelIdx: number) => {
        if (!hlsRef.current) return;
        if (levelIdx === -1) {
            hlsRef.current.currentLevel = -1; // Auto ABR
            setCurrentQuality(-1);
        } else {
            hlsRef.current.currentLevel = levelIdx;
            setCurrentQuality(levelIdx);
        }
    };

    // Toggle full screen
    const handleFullScreen = () => {
        if (!containerRef.current) return;
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            containerRef.current.requestFullscreen().catch(() => {});
        }
    };

    return (
        <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden bg-black border border-border shadow-2xl flex flex-col">
            {/* ────────── Player top bar ────────── */}
            <div className="bg-surface/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between border-b border-border text-foreground z-20 gap-2 flex-wrap sm:flex-nowrap">
                {/* Match title & status badge */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Trực tiếp
                    </span>
                    <span className="font-bold text-xs sm:text-sm truncate">
                        {match.home} vs {match.away}
                    </span>
                </div>

                {/* Right controls: Server select, Video Settings, Fullscreen, Close */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {/* Server selector */}
                    {availableServers.length > 0 && (
                        <div className="relative">
                            <select
                                value={activeServer}
                                onChange={(e) => onServerChange(e.target.value)}
                                className="bg-background/80 border border-border text-foreground text-xs font-bold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:border-accent cursor-pointer appearance-none shadow-sm"
                            >
                                {availableServers.map((s) => (
                                    <option key={s} value={s} className="bg-surface text-foreground py-1">
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40 text-[10px]">
                                ▾
                            </span>
                        </div>
                    )}

                    {/* Video Settings Button (Quality, Super Clear, Zoom) */}
                    <div className="relative">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`p-1.5 rounded-lg border transition-all ${
                                isSettingsOpen || isSuperClear || zoomLevel > 100
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                                    : 'bg-background/70 text-foreground/70 border-border hover:bg-background hover:text-foreground'
                            }`}
                            title="Cài đặt video (Độ nét, Zoom, Super Clear)"
                            aria-label="Cài đặt video"
                        >
                            <Settings size={15} className={isSettingsOpen ? 'rotate-90 transition-transform duration-200' : 'transition-transform duration-200'} />
                        </button>

                        {/* Settings Flyout Dropdown */}
                        {isSettingsOpen && (
                            <div 
                                className="absolute right-0 top-full mt-2 w-72 bg-slate-900/95 border border-border/80 rounded-2xl shadow-2xl p-4 text-xs z-50 text-white backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 space-y-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                                    <span className="font-extrabold text-sm flex items-center gap-1.5 text-amber-400">
                                        <Settings size={15} /> Cài Đặt Video
                                    </span>
                                    <button 
                                        onClick={() => setIsSettingsOpen(false)}
                                        className="text-white/40 hover:text-white"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                {/* 1. Quality Selector */}
                                {!useIframe && qualityLevels.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                                            Chất Lượng Video
                                        </label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                onClick={() => handleQualityChange(-1)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                                                    currentQuality === -1
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm'
                                                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                                }`}
                                            >
                                                <span>Tự động (Auto)</span>
                                                {currentQuality === -1 && <Check size={13} />}
                                            </button>
                                            {qualityLevels.map((lvl) => (
                                                <button
                                                    key={lvl.index}
                                                    onClick={() => handleQualityChange(lvl.index)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                                                        currentQuality === lvl.index
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm'
                                                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <span>{lvl.label}</span>
                                                    {currentQuality === lvl.index && <Check size={13} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 2. Super Clear (CSS / WebGL Sharpening) Toggle */}
                                <div className="space-y-2 pt-1 border-t border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-xs flex items-center gap-1.5 text-white">
                                                <Sparkles size={14} className="text-amber-400" />
                                                Chế độ Siêu Nét
                                            </div>
                                            <div className="text-[10px] text-white/50">Tăng độ tương phản, viền nét cỏ & cầu thủ</div>
                                        </div>
                                        <button
                                            onClick={() => setIsSuperClear(!isSuperClear)}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                isSuperClear ? 'bg-amber-500' : 'bg-white/20'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                    isSuperClear ? 'translate-x-4' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* 3. Custom Zoom Slider (100% to 130%) */}
                                <div className="space-y-2 pt-1 border-t border-white/10">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                                            <ZoomIn size={14} className="text-sky-400" />
                                            Thu Phóng Màn Hình:
                                        </span>
                                        <span className="font-mono font-black text-sky-400 text-xs">
                                            {zoomLevel}%
                                        </span>
                                    </div>

                                    {/* Slider */}
                                    <input
                                        type="range"
                                        min={100}
                                        max={130}
                                        step={1}
                                        value={zoomLevel}
                                        onChange={(e) => setZoomLevel(Number(e.target.value))}
                                        className="w-full accent-sky-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                                    />

                                    {/* Quick Zoom presets */}
                                    <div className="flex items-center justify-between gap-1 pt-1">
                                        <button
                                            onClick={() => setZoomLevel(100)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                zoomLevel === 100
                                                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                                                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                                            }`}
                                        >
                                            100% (Gốc)
                                        </button>
                                        <button
                                            onClick={() => setZoomLevel(105)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                zoomLevel === 105
                                                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                                                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                                            }`}
                                        >
                                            105% (Khử mép)
                                        </button>
                                        <button
                                            onClick={() => setZoomLevel(110)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                zoomLevel === 110
                                                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                                                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                                            }`}
                                        >
                                            110% (Cắt viền)
                                        </button>
                                        <button
                                            onClick={() => setZoomLevel(100)}
                                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"
                                            title="Khôi phục 100%"
                                        >
                                            <RotateCcw size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Fullscreen */}
                    <button
                        onClick={handleFullScreen}
                        className="p-1.5 rounded-lg bg-background/70 text-foreground/70 border border-border hover:bg-background hover:text-foreground transition-all"
                        title="Toàn màn hình"
                        aria-label="Toàn màn hình"
                    >
                        <Maximize size={15} />
                    </button>

                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-background/70 text-foreground/70 border border-border hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/50 transition-all sm:ml-1 whitespace-nowrap"
                    >
                        <X size={13} />
                        Đóng
                    </button>
                </div>
            </div>

            {/* ────────── Video area ────────── */}
            <div className="relative w-full aspect-video bg-black rounded-b-2xl overflow-hidden" style={{ isolation: 'isolate' }}>

                {/* Loading / Error overlay */}
                {(isLoading || isError) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-10 bg-black/80 pointer-events-none">
                        {isError ? (
                            <>
                                <span className="text-4xl">⚠️</span>
                                <p className="font-semibold text-red-400">Không thể tải luồng video</p>
                                <p className="text-xs text-white/50">Hãy thử máy chủ khác</p>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-10 h-10 animate-spin text-accent" />
                                <p className="text-sm font-medium text-white/80 animate-pulse">
                                    {loadingMsg || 'Đang tải luồng video...'}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {useIframe ? (
                    /* ── Iframe player ── */
                    <iframe
                        ref={iframeRef}
                        key={streamUrl}
                        src={streamUrl}
                        className="w-full h-full border-0 rounded-b-2xl transition-transform duration-150"
                        style={{
                            transform: `scale(${zoomLevel / 100})`,
                            transformOrigin: 'center center',
                            filter: isSuperClear 
                                ? 'contrast(1.08) saturate(1.15) brightness(1.02) drop-shadow(0 0 1px rgba(0,0,0,0.5))' 
                                : 'none',
                        }}
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
                        allowFullScreen
                        onLoad={() => setIsLoading(false)}
                        onError={() => { setIsError(true); setIsLoading(false); }}
                        title={`${match.home} vs ${match.away}`}
                    />
                ) : (
                    /* ── Native video element (m3u8 / flv) with Zoom and Super Clear filters ── */
                    <video 
                        ref={videoRef} 
                        className="w-full h-full rounded-b-2xl object-cover transition-transform duration-150" 
                        style={{
                            transform: `scale(${zoomLevel / 100})`,
                            transformOrigin: 'center center',
                            filter: isSuperClear 
                                ? 'contrast(1.08) saturate(1.15) brightness(1.02)' 
                                : 'none',
                            imageRendering: isSuperClear ? 'crisp-edges' : 'auto'
                        }}
                        controls 
                        playsInline 
                    />
                )}
            </div>
        </div>
    );
}
