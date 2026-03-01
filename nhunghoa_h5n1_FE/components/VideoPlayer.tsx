'use client';

import { X, Maximize, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Match } from '@/app/types';

interface VideoPlayerProps {
    match: Match;
    streamUrl: string;   // May be an iframe player URL or a raw m3u8/flv URL
    activeServer: string;
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

export default function VideoPlayer({ match, streamUrl, activeServer, onServerChange, onClose }: VideoPlayerProps) {
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
                    flvPlayer = mpegts.createPlayer({ type: 'flv', url: streamUrl, isLive: true });
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
                        // Don't use lowLatencyMode — it reduces buffer size, causing
                        // micro-freezes when proxy adds latency per segment request.
                        lowLatencyMode: false,
                        // Buffer more segments ahead to absorb proxy latency spikes
                        maxBufferLength: 60,          // seconds of buffer (default 30)
                        maxMaxBufferLength: 120,      // max buffer cap
                        maxBufferSize: 100 * 1000 * 1000,  // 100MB
                        // Retry on error — proxy can occasionally timeout
                        manifestLoadingMaxRetry: 3,
                        levelLoadingMaxRetry: 3,
                        fragLoadingMaxRetry: 3,
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 flex-wrap gap-2">

                {/* Left: match info */}
                <div className="flex items-center gap-2 flex-1 min-w-0 basis-full sm:basis-0">
                    {match.status === 'Trực tiếp' && (
                        <span className="shrink-0 flex items-center gap-1 bg-red-500/15 px-2 py-0.5 rounded text-[10px] font-bold text-red-500 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            TRỰC TIẾP
                        </span>
                    )}
                    <h2 className="text-sm sm:text-base font-bold truncate">
                        {match.home} vs {match.away}
                    </h2>
                </div>

                {/* Middle: Fullscreen */}
                <div className="flex justify-center flex-1 shrink-0">
                    <button
                        onClick={handleFullscreen}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-background/70 text-foreground/70 border border-border hover:bg-accent hover:text-black hover:border-accent transition-all"
                    >
                        <Maximize size={14} />
                        Toàn màn hình
                    </button>
                </div>

                {/* Right: action buttons */}
                <div className="flex items-center justify-end gap-2 flex-1 shrink-0">
                    {/* Server buttons */}
                    {['1', '2'].map((s) => (
                        <button
                            key={s}
                            onClick={() => onServerChange(s)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeServer === s
                                ? 'bg-accent text-black border-accent shadow-[0_0_10px_var(--color-accent)]'
                                : 'bg-background/70 text-foreground/70 border-border hover:bg-surface-hover hover:text-foreground'
                                }`}
                        >
                            Máy chủ {s}
                        </button>
                    ))}

                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-background/70 text-foreground/70 border border-border hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/50 transition-all ml-2"
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
                                <p className="text-sm font-medium text-white/70">Đang tải luồng video...</p>
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
