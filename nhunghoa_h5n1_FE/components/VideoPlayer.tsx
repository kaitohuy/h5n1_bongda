'use client';

import { X, Maximize, Loader2 } from 'lucide-react';
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

/**
 * Detect if the URL is an iframe player page (not a raw stream URL).
 * Raw stream URLs (direct or proxied) always contain .m3u8 or .flv somewhere.
 */
function isIframePlayerUrl(url: string): boolean {
    if (!url) return false;
    // Both direct stream URLs and proxied stream URLs contain .m3u8 or .flv
    if (url.includes('.m3u8') || url.includes('.flv')) return false;
    return true;
}

export default function VideoPlayer({ match, streamUrl, loadingMsg, activeServer, availableServers, onServerChange, onClose }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    const useIframe = isIframePlayerUrl(streamUrl);

    // Reset loader state whenever streamUrl changes
    useEffect(() => {
        setIsLoading(true);
        setIsError(false);
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
                            liveBufferLatencyChasing: true,  // Auto skip to live edge when lagging
                            liveBufferLatencyMaxLatency: 5.0, // Max tolerated latency (seconds)
                            liveBufferLatencyMinRemain: 1.0,
                        }
                    );
                    flvPlayer.attachMediaElement(video);
                    flvPlayer.load();
                    video.addEventListener('canplay', () => { setIsLoading(false); video.play().catch(() => setIsLoading(false)); }, { once: true });
                    flvPlayer.on(mpegts.Events.ERROR, () => { setIsError(true); setIsLoading(false); });
                } else {
                    setIsError(true); setIsLoading(false);
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
                        // ── Live Edge Sync Config ──
                        liveSyncDurationCount: 3,        // Try to stay 3 chunks behind the live edge
                        liveMaxLatencyDurationCount: 7,  // If we fall 7 chunks behind, jump forward to liveSync
                    });
                    hls.loadSource(streamUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        setIsLoading(false);
                        video?.play().catch(() => setIsLoading(false));
                    });
                    hls.on(Hls.Events.ERROR, (_, data) => {
                        if (data.fatal) { setIsError(true); setIsLoading(false); }
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
            flvPlayer?.destroy();
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.removeAttribute('src');
                videoRef.current.load();
            }
        };
    }, [streamUrl, useIframe]);

    const handleFullscreen = () => {
        const target = useIframe ? iframeRef.current : videoRef.current;
        if (!target) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            if (target.requestFullscreen) {
                target.requestFullscreen().catch(console.error);
            } else if ((target as any).webkitRequestFullscreen) {
                (target as any).webkitRequestFullscreen();
            } else if ((target as any).msRequestFullscreen) {
                (target as any).msRequestFullscreen();
            }
        }
    };

    return (
        <div ref={containerRef} className="w-full flex flex-col bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300">

            {/* ────────── Top title bar with ALL controls ────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-border/50 bg-background/80 gap-3">

                {/* Left: match info */}
                <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
                    {match.status === 'Trực tiếp' && (
                        <span className="shrink-0 flex items-center gap-1 bg-red-500/15 px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-bold text-red-500 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="hidden sm:inline">TRỰC TIẾP</span>
                            <span className="sm:hidden">LIVE</span>
                        </span>
                    )}
                    <h2 className="text-sm sm:text-base font-bold truncate">
                        {match.home} vs {match.away}
                    </h2>
                </div>

                {/* Right / Bottom: action buttons (Scrollable on mobile) */}
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                    <button
                        onClick={handleFullscreen}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-background/70 text-foreground/70 border border-border hover:bg-accent hover:text-black hover:border-accent transition-all whitespace-nowrap"
                    >
                        <Maximize size={14} />
                        Toàn màn hình
                    </button>

                    {/* Server buttons (Dropdown) */}
                    {availableServers && availableServers.length > 0 && (
                        <div className="relative shrink-0">
                            <select
                                value={activeServer || availableServers[0]}
                                onChange={(e) => onServerChange(e.target.value)}
                                className="appearance-none outline-none border border-border bg-background/70 text-foreground text-xs font-bold rounded-lg pl-3 pr-8 py-1.5 hover:bg-surface-hover focus:bg-accent focus:text-black hover:border-accent focus:border-accent transition-all cursor-pointer shadow-sm"
                            >
                                {availableServers.map((s, idx) => (
                                    <option key={s + idx} value={s} className="bg-background text-foreground font-semibold py-1">
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-foreground/70">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>
                    )}

                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-background/70 text-foreground/70 border border-border hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/50 transition-all sm:ml-2 whitespace-nowrap"
                    >
                        <X size={13} />
                        Đóng
                    </button>
                </div>
            </div>

            {/* ────────── Video area ────────── */}
            <div className="relative w-full aspect-video bg-black">

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
                    /* ── Iframe player (91p.livecdnem.com or similar) ── */
                    <iframe
                        ref={iframeRef}
                        key={streamUrl}
                        src={streamUrl}
                        className="w-full h-full border-0"
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        allowFullScreen
                        onLoad={() => setIsLoading(false)}
                        onError={() => { setIsError(true); setIsLoading(false); }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        title={`${match.home} vs ${match.away}`}
                    />
                ) : (
                    /* ── Native video element (m3u8 / flv) ── */
                    <video ref={videoRef} className="w-full h-full" controls playsInline />
                )}
            </div>
        </div>
    );
}
