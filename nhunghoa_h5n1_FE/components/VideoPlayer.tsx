'use client';

import { 
    X, Maximize, Minimize, Loader2, Settings, Sparkles, ZoomIn, 
    Check, RotateCcw, Play, Pause, Volume2, VolumeX, Volume1, 
    PictureInPicture2, Radio, FastForward
} from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
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
    const videoWrapperRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    const settingsBtnRef = useRef<HTMLButtonElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hlsRef = useRef<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    // ── Custom Player States ─────────────────────────────────────────────────
    const [isPlaying, setIsPlaying] = useState(true);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPiPAvailable, setIsPiPAvailable] = useState(false);
    const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);

    // ── Video Enhancement & Settings States ──────────────────────────────────
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSuperClear, setIsSuperClear] = useState(false); // Default: OFF
    const [zoomLevel, setZoomLevel] = useState(100); // 100% to 150%
    const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
    
    // Auto catch-up latency settings (Default: OFF as requested)
    const [isAutoCatchup, setIsAutoCatchup] = useState(false);
    const [catchupThreshold, setCatchupThreshold] = useState(3); // Default 3s

    const useIframe = isIframePlayerUrl(streamUrl);

    // Check PiP capability on mount
    useEffect(() => {
        if (typeof document !== 'undefined' && 'pictureInPictureEnabled' in document) {
            setIsPiPAvailable(true);
        }
    }, []);

    // Reset player state whenever streamUrl changes
    useEffect(() => {
        setIsLoading(true);
        setIsError(false);
        setQualityLevels([]);
        setCurrentQuality(-1);
    }, [streamUrl]);

    // ── Auto-hide Controls on Idle (3 seconds) ───────────────────────────────
    const triggerControlsActivity = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (!isSettingsOpen) {
                setShowControls(false);
            }
        }, 3000);
    }, [isSettingsOpen]);

    // Handle Fullscreen Change Detection
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    // ── Click Outside to Close Settings ──────────────────────────────────────
    useEffect(() => {
        if (!isSettingsOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                settingsRef.current && 
                !settingsRef.current.contains(e.target as Node) &&
                settingsBtnRef.current &&
                !settingsBtnRef.current.contains(e.target as Node)
            ) {
                setIsSettingsOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleClickOutside);
        return () => {
            document.removeEventListener('pointerdown', handleClickOutside);
        };
    }, [isSettingsOpen]);

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
                        video.play().then(() => setIsPlaying(true)).catch(() => setIsLoading(false)); 
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
                // ── Adaptive HLS Configuration (Buffer Safe + Smart Catchup) ─────
                const Hls = (await import('hls.js')).default;
                if (Hls.isSupported()) {
                    hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: false,
                        backBufferLength: 30,
                        maxBufferLength: 20,
                        maxMaxBufferLength: 60,
                        maxBufferSize: 60 * 1000 * 1000,
                        manifestLoadingMaxRetry: 5,
                        levelLoadingMaxRetry: 5,
                        fragLoadingMaxRetry: 5,
                        liveSyncDurationCount: 2,
                        liveMaxLatencyDurationCount: 15,
                        liveDurationInfinity: true,
                    });
                    hlsRef.current = hls;

                    hls.loadSource(streamUrl);
                    hls.attachMedia(video);

                    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                        setIsLoading(false);
                        video?.play().then(() => {
                            setIsPlaying(true);
                            if (hls && hls.liveSyncPosition) {
                                video.currentTime = hls.liveSyncPosition;
                            }
                        }).catch(() => setIsLoading(false));

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
                    video.addEventListener('canplay', () => {
                        setIsLoading(false);
                        video.play().then(() => setIsPlaying(true)).catch(() => {});
                    }, { once: true });
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

    // ── Video Events Listener with Smart Adaptive Speedup ────────────────────
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (video.seekable && video.seekable.length > 0) {
                const liveEdge = video.seekable.end(video.seekable.length - 1);
                const latency = Math.max(0, liveEdge - video.currentTime);
                setIsAtLiveEdge(latency < (catchupThreshold + 1));

                // Nếu người dùng BẬT chế độ "Tự động bắt kịp trực tiếp":
                if (isAutoCatchup && latency > catchupThreshold && !video.paused) {
                    video.playbackRate = 1.05; // Tăng nhẹ 1.05x để đuổi kịp
                } else {
                    video.playbackRate = 1.0;
                }
            }
        };
        const onDurationChange = () => setDuration(video.duration || 0);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onVolumeChange = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('volumechange', onVolumeChange);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('volumechange', onVolumeChange);
        };
    }, [isAutoCatchup, catchupThreshold]);

    // ── Keyboard Shortcuts (Space, F, M, P) ──────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['input', 'textarea', 'select'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

            if (e.code === 'Space' || e.key === 'k') {
                e.preventDefault();
                togglePlayPause();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                handleFullScreen();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                toggleMute();
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                togglePiP();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ── Control Actions ──────────────────────────────────────────────────────
    const togglePlayPause = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    };

    const handleVolumeChange = (newVol: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.volume = newVol;
        setVolume(newVol);
        if (newVol > 0 && video.muted) {
            video.muted = false;
            setIsMuted(false);
        }
    };

    const togglePiP = async () => {
        const video = videoRef.current;
        if (!video) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch (e) {
            console.error('PiP failed:', e);
        }
    };

    const jumpToLive = () => {
        const video = videoRef.current;
        if (!video) return;
        if (hlsRef.current && hlsRef.current.liveSyncPosition) {
            video.currentTime = hlsRef.current.liveSyncPosition;
        } else if (video.seekable && video.seekable.length > 0) {
            video.currentTime = video.seekable.end(video.seekable.length - 1) - 0.5;
        }
        setIsAtLiveEdge(true);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const video = videoRef.current;
        if (!video || !progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

        if (video.seekable && video.seekable.length > 0) {
            const start = video.seekable.start(0);
            const end = video.seekable.end(video.seekable.length - 1);
            const targetTime = start + (end - start) * pos;
            video.currentTime = targetTime;
        } else if (video.duration) {
            video.currentTime = pos * video.duration;
        }
    };

    const handleQualityChange = (levelIdx: number) => {
        if (!hlsRef.current) return;
        if (levelIdx === -1) {
            hlsRef.current.currentLevel = -1;
            setCurrentQuality(-1);
        } else {
            hlsRef.current.currentLevel = levelIdx;
            setCurrentQuality(levelIdx);
        }
    };

    const handleFullScreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
            return;
        }

        const targetElement = videoWrapperRef.current || containerRef.current || videoRef.current;
        if (targetElement) {
            if (targetElement.requestFullscreen) {
                targetElement.requestFullscreen().catch(() => {});
            } else if ((targetElement as any).webkitRequestFullscreen) {
                (targetElement as any).webkitRequestFullscreen();
            } else if ((targetElement as any).msRequestFullscreen) {
                (targetElement as any).msRequestFullscreen();
            }
        }
    };

    // Calculate progress percentage
    let progressPct = 100;
    if (videoRef.current?.seekable && videoRef.current.seekable.length > 0) {
        const start = videoRef.current.seekable.start(0);
        const end = videoRef.current.seekable.end(videoRef.current.seekable.length - 1);
        if (end > start) {
            progressPct = Math.max(0, Math.min(100, ((currentTime - start) / (end - start)) * 100));
        }
    } else if (duration > 0) {
        progressPct = (currentTime / duration) * 100;
    }

    return (
        <div 
            ref={containerRef} 
            className="relative w-full rounded-2xl overflow-hidden bg-black border border-border shadow-2xl flex flex-col group select-none"
            onMouseMove={triggerControlsActivity}
            onMouseLeave={() => {
                if (!isSettingsOpen) setShowControls(false);
            }}
        >
            {/* ────────── Player top bar ────────── */}
            <div className={`bg-surface/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between border-b border-border text-foreground z-20 gap-2 flex-wrap sm:flex-nowrap transition-opacity duration-300 ${
                isFullscreen && !showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
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

                {/* Right controls: Server & Commentator selector, Settings, Fullscreen, Close */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {/* Server / BLV selector */}
                    {availableServers.length > 0 && (
                        <div className="relative">
                            <select
                                value={activeServer}
                                onChange={(e) => onServerChange(e.target.value)}
                                className="bg-background/80 border border-border text-foreground text-xs font-bold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:border-accent cursor-pointer appearance-none shadow-sm max-w-[140px] sm:max-w-[180px] truncate"
                                title="Đổi Server / Đổi BLV"
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

                    {/* Video Settings Button */}
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`p-1.5 rounded-lg border transition-all ${
                            isSettingsOpen || isSuperClear || zoomLevel > 100 || isAutoCatchup
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                                : 'bg-background/70 text-foreground/70 border-border hover:bg-background hover:text-foreground'
                        }`}
                        title="Cài đặt video (Độ nét, Zoom, Super Clear, Bắt kịp Live)"
                        aria-label="Cài đặt video"
                    >
                        <Settings size={15} className={isSettingsOpen ? 'rotate-90 transition-transform duration-200' : 'transition-transform duration-200'} />
                    </button>

                    {/* Fullscreen Button */}
                    <button
                        onClick={handleFullScreen}
                        className="p-1.5 rounded-lg bg-background/70 text-foreground/70 border border-border hover:bg-background hover:text-foreground transition-all"
                        title={isFullscreen ? 'Thu nhỏ (F)' : 'Toàn màn hình (F)'}
                        aria-label="Toàn màn hình"
                    >
                        {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
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

            {/* ────────── Video area with Custom Floating Overlay Controls ────────── */}
            <div 
                ref={videoWrapperRef}
                className="relative w-full aspect-video bg-black rounded-b-2xl overflow-hidden flex items-center justify-center [&:fullscreen]:w-screen [&:fullscreen]:h-screen [&:fullscreen]:rounded-none [&:fullscreen]:aspect-auto" 
                style={{ isolation: 'isolate' }}
                onClick={() => {
                    if (!useIframe) togglePlayPause();
                }}
                onDoubleClick={handleFullScreen}
            >
                {/* Loading / Error overlay */}
                {(isLoading || isError) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-20 bg-black/85 pointer-events-none">
                        {isError ? (
                            <>
                                <span className="text-4xl">⚠️</span>
                                <p className="font-semibold text-red-400">Không thể tải luồng video</p>
                                <p className="text-xs text-white/50">Hãy thử lại hoặc đổi kênh</p>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-10 h-10 animate-spin text-accent" />
                                <p className="text-sm font-medium text-white/80 animate-pulse">
                                    {loadingMsg || 'Đang tải luồng video trực tiếp...'}
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
                    /* ── Native video element without native controls ── */
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
                        playsInline 
                    />
                )}

                {/* ────────── CUSTOM FLOATING BOTTOM CONTROLS BAR ────────── */}
                {!useIframe && (
                    <div 
                        className={`absolute bottom-0 left-0 right-0 z-30 px-4 pb-3 pt-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2 transition-all duration-300 ${
                            showControls || isSettingsOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 1. Interactive Progress Bar / Timeline */}
                        <div 
                            ref={progressBarRef}
                            onClick={handleSeek}
                            className="relative w-full group/progress py-1.5 cursor-pointer flex items-center"
                            title="Tua mốc thời gian"
                        >
                            <div className="w-full h-1.5 group-hover/progress:h-2.5 bg-white/20 rounded-full overflow-hidden transition-all relative">
                                <div 
                                    className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 rounded-full transition-all duration-75"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>

                        {/* 2. Controls Row */}
                        <div className="flex items-center justify-between text-white">
                            {/* Left Controls: Play/Pause, Volume, Live Sync Button */}
                            <div className="flex items-center gap-2.5">
                                {/* Play / Pause */}
                                <button
                                    onClick={togglePlayPause}
                                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                                    title={isPlaying ? 'Tạm dừng (Space)' : 'Phát (Space)'}
                                >
                                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
                                </button>

                                {/* Volume & Slider */}
                                <div className="flex items-center gap-1.5 group/vol">
                                    <button
                                        onClick={toggleMute}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                                        title={isMuted ? 'Bật âm (M)' : 'Tắt âm (M)'}
                                    >
                                        {isMuted || volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={isMuted ? 0 : volume}
                                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                        className="w-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 transition-all duration-200 h-1.5 accent-red-500 cursor-pointer rounded-lg bg-white/20"
                                    />
                                </div>

                                {/* LIVE Sync Button (Click to Jump to Real-Time Edge) */}
                                <button
                                    onClick={jumpToLive}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase transition-all cursor-pointer ${
                                        isAtLiveEdge 
                                            ? 'bg-red-600/30 border border-red-500/40 text-red-400' 
                                            : 'bg-white/10 hover:bg-red-600/40 text-white/70 hover:text-white border border-white/20'
                                    }`}
                                    title="Nhấp để đồng bộ ngay tới thời gian thực (Live Edge)"
                                >
                                    <span className={`w-2 h-2 rounded-full ${isAtLiveEdge ? 'bg-red-500 animate-pulse' : 'bg-white/40'}`} />
                                    <span>LIVE</span>
                                    {!isAtLiveEdge && <FastForward size={12} className="text-amber-400" />}
                                </button>
                            </div>

                            {/* Right Controls: PiP, Settings (⚙️), Fullscreen */}
                            <div className="flex items-center gap-2">
                                {/* Picture in Picture */}
                                {isPiPAvailable && (
                                    <button
                                        onClick={togglePiP}
                                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
                                        title="Hình trong hình (P)"
                                    >
                                        <PictureInPicture2 size={17} />
                                    </button>
                                )}

                                {/* Settings Button (Origin of bottom flyout) */}
                                <div className="relative">
                                    <button
                                        ref={settingsBtnRef}
                                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                        className={`p-2 rounded-xl border transition-all ${
                                            isSettingsOpen || isSuperClear || zoomLevel > 100 || isAutoCatchup
                                                ? 'bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-md ring-2 ring-amber-500/20'
                                                : 'bg-white/10 text-white/80 border-white/10 hover:bg-white/20 hover:text-white'
                                        }`}
                                        title="Cài đặt video (Độ nét, Zoom, Super Clear, Bắt kịp Live)"
                                    >
                                        <Settings size={17} className={isSettingsOpen ? 'rotate-90 transition-transform duration-200 text-amber-400' : 'transition-transform duration-200'} />
                                    </button>

                                    {/* Flyup Settings Popover (Xổ Lên từ Nút Bánh Răng) */}
                                    {isSettingsOpen && (
                                        <div 
                                            ref={settingsRef}
                                            className="absolute right-0 bottom-full mb-3 w-80 bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl p-4 text-xs z-50 text-white backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-4"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                                                <span className="font-extrabold text-sm flex items-center gap-1.5 text-amber-400">
                                                    <Settings size={15} /> Cài Đặt Video
                                                </span>
                                                <button 
                                                    onClick={() => setIsSettingsOpen(false)}
                                                    className="text-white/40 hover:text-white p-0.5 rounded-lg hover:bg-white/10"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>

                                            {/* 1. Quality Selector */}
                                            {qualityLevels.length > 0 && (
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                                                        Chất Lượng Video
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        <button
                                                            onClick={() => handleQualityChange(-1)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                                                                currentQuality === -1
                                                                    ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/50 shadow-sm'
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
                                                                        ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/50 shadow-sm'
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

                                            {/* 2. Super Clear Mode */}
                                            <div className="space-y-2 pt-1 border-t border-white/10">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-bold text-xs flex items-center gap-1.5 text-white">
                                                            <Sparkles size={14} className="text-amber-400" />
                                                            Chế độ Siêu Nét
                                                        </div>
                                                        <div className="text-[10px] text-white/50">Tăng độ nét & tương phản màu cỏ</div>
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

                                            {/* 3. Auto Catch-up (Tự động bắt kịp trực tiếp) */}
                                            <div className="space-y-2 pt-1 border-t border-white/10">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-bold text-xs flex items-center gap-1.5 text-white">
                                                            <FastForward size={14} className="text-rose-400" />
                                                            Tự Động Bắt Kịp Trực Tiếp
                                                        </div>
                                                        <div className="text-[10px] text-white/50">Tăng tốc 1.05x để đuổi kịp khi bị chậm</div>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsAutoCatchup(!isAutoCatchup)}
                                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                            isAutoCatchup ? 'bg-rose-500' : 'bg-white/20'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                                                isAutoCatchup ? 'translate-x-4' : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>

                                                {/* Threshold Config (Khi Bật) */}
                                                {isAutoCatchup && (
                                                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/10 animate-in fade-in zoom-in-95 duration-150">
                                                        <span className="text-[11px] text-white/70">Ngưỡng trễ tối đa:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            {[2, 3, 5, 8].map((sec) => (
                                                                <button
                                                                    key={sec}
                                                                    onClick={() => setCatchupThreshold(sec)}
                                                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                                                                        catchupThreshold === sec
                                                                            ? 'bg-rose-500/30 text-rose-300 border-rose-500/50 shadow-sm'
                                                                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                                                                    }`}
                                                                >
                                                                    {sec}s
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 4. Custom Zoom Slider (100% - 150%) */}
                                            <div className="space-y-2 pt-1 border-t border-white/10">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                                                        <ZoomIn size={14} className="text-sky-400" />
                                                        Thu Phóng Màn Hình:
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono font-black text-sky-400 text-xs">
                                                            {zoomLevel}%
                                                        </span>
                                                        {zoomLevel > 100 && (
                                                            <button
                                                                onClick={() => setZoomLevel(100)}
                                                                className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                                                                title="Khôi phục về 100%"
                                                            >
                                                                <RotateCcw size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <input
                                                    type="range"
                                                    min={100}
                                                    max={150}
                                                    step={1}
                                                    value={zoomLevel}
                                                    onChange={(e) => setZoomLevel(Number(e.target.value))}
                                                    className="w-full accent-sky-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Fullscreen Button */}
                                <button
                                    onClick={handleFullScreen}
                                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                                    title={isFullscreen ? 'Thu nhỏ (F)' : 'Toàn màn hình (F)'}
                                >
                                    {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
