'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, ChevronDown, Flame, Calendar, Clock, ListFilter, Tv } from 'lucide-react';
import Header from '@/components/Header';
import MatchCard from '@/components/MatchCard';
import VideoPlayer from '@/components/VideoPlayer';
import MatchStats from '@/components/MatchStats';
import { Match, FilterTab } from './types';
import { normalizeCommentator } from '@/components/CommentatorSettingsModal';

const BE_URL = process.env.NEXT_PUBLIC_BE_URL || 'http://localhost:8000';
const VTV6_STREAM_URL = 'https://live-a.fptplay53.net/live/media/vtv6/live247-hls-avc/index.m3u8';

const VTV6_MATCH_DATA: Match = {
  id: 'vtv6',
  home: 'Kênh VTV6',
  away: 'VTV Cần Thơ',
  homeLogo: 'https://vtvgo-assets.vtvdigital.vn/assets/images/v2/logo/VTV6_150x902_1675159127.webp',
  awayLogo: 'https://vtvgo-assets.vtvdigital.vn/assets/images/v2/logo/VTV6_150x902_1675159127.webp',
  leagueId: 'vtv',
  league: 'Đài Truyền Hình Việt Nam (VTVgo)',
  leagueLogo: 'https://vtvgo-assets.vtvdigital.vn/assets/images/v2/logo/VTV6_150x902_1675159127.webp',
  time: '24/7',
  date: 'Trực tiếp',
  status: 'Trực tiếp',
  minute: 'LIVE',
  homeScore: null,
  awayScore: null,
  isHot: true,
  isSuperHot: true,
  commentator: 'Đài Truyền Hình VTV',
  section: 'live',
  sourceUrl: VTV6_STREAM_URL,
  source: 'vtv6',
  startTime: Math.floor(Date.now() / 1000)
};

export default function Home() {
  // ── Source state: Default to VTV6 as requested ──────────────────────────────
  const [currentSource, setCurrentSource] = useState<string>('vtv6');

  // Load saved default source on client mount
  useEffect(() => {
    try {
      const savedSrc = localStorage.getItem('h5n1_default_source');
      if (savedSrc && (savedSrc === 'vtv6' || savedSrc === 'colatv')) {
        setCurrentSource(savedSrc);
      }
    } catch {}
  }, []);

  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [activeServer, setActiveServer] = useState<string>('');
  const [availableServers, setAvailableServers] = useState<string[]>([]);
  const [rawServers, setRawServers] = useState<any[]>([]);
  const [loadingStreamMsg, setLoadingStreamMsg] = useState('');

  const [matches, setMatches] = useState<Match[]>([]);
  const [hasMoreBackend, setHasMoreBackend] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState<'hot' | 'live' | null>(null);
  const [error, setError] = useState('');

  // ── Tab Filter State ────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [visibleCount, setVisibleCount] = useState(15);

  // Reset pagination when tab changes
  useEffect(() => {
    setVisibleCount(15);
  }, [activeFilter]);

  // ── Fetch ALL matches from BE ──────────────────────────────────────────────
  const fetchAllMatches = useCallback(async (loadMore: boolean = false) => {
    if (!loadMore) setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ 
        filter: 'all', 
        loadMore: loadMore ? 'true' : 'false'
      });
      const res = await fetch(`${BE_URL}/api/matches?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lỗi lấy dữ liệu');
      setHasMoreBackend(Boolean(data.hasMore));

      const raw: Match[] = (data.matches || []).map((m: any) => {
        let timeStr = String(m.time || '--:--');
        let dateStr = String(m.date || '');
        if (m.startTime && typeof m.startTime === 'number') {
          const d = new Date(m.startTime * 1000);
          timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
          dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
        }

        let statusMapped: Match['status'] = 'Sắp tới';
        if (typeof m.status === 'number') {
          statusMapped = (m.status === 1 || m.isLive) ? 'Trực tiếp'
                       : m.status === 3               ? 'Đã kết thúc'
                       : 'Sắp tới';
        } else if (typeof m.status === 'string' && ['Trực tiếp', 'Sắp tới', 'Đã kết thúc'].includes(m.status)) {
          statusMapped = m.status as Match['status'];
        } else if (m.statusText) {
          const t = m.statusText as string;
          statusMapped = t === 'Trực tiếp' ? 'Trực tiếp' : t === 'Kết thúc' ? 'Đã kết thúc' : 'Sắp tới';
        }

        return {
          id: String(m.id || m.matchId || ''),
          home: String(m.home || m.homeName || 'Đội nhà'),
          away: String(m.away || m.awayName || 'Đội khách'),
          homeLogo: String(m.homeLogo || ''),
          awayLogo: String(m.awayLogo || ''),
          leagueId: String(m.leagueId || m.league || ''),
          leagueLogo: String(m.leagueLogo || ''),
          league: String(m.league || m.leagueName || 'Không rõ'),
          time: timeStr,
          date: dateStr,
          status: statusMapped,
          minute: String(m.minute || ''),
          homeScore: m.homeScore !== null && m.homeScore !== undefined ? Number(m.homeScore) : null,
          awayScore: m.awayScore !== null && m.awayScore !== undefined ? Number(m.awayScore) : null,
          isHot: Boolean(m.isHot || (m.viewNumber && m.viewNumber >= 46000)),
          isSuperHot: Boolean(m.isSuperHot),
          commentator: String(m.commentator || ''),
          section: String(m.section || ''),
          sourceUrl: String(m.sourceUrl || m.slug || ''),
          source: m.source || data.source,
          startTime: m.startTime || 0,
        };
      });
      setMatches(raw);
    } catch {
      setError('Không kết nối được đến backend. Kiểm tra BE đang chạy trên cổng 8000.');
    } finally {
      if (!loadMore) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllMatches(false);
  }, [fetchAllMatches]);

  useEffect(() => {
    const id = setInterval(() => fetchAllMatches(false), 30_000);
    return () => clearInterval(id);
  }, [fetchAllMatches]);

  // When source switches to vtv6, reset match selection
  useEffect(() => {
    if (currentSource === 'vtv6') {
      setActiveMatch(null);
    }
  }, [currentSource]);

  // ── Fetch stream URL ───────────────────────────────────────────────────────
  const STREAM_LOADING_PHASES = [
    { delay: 0,   msg: '🔌 Đang kết nối máy chủ...' },
    { delay: 500, msg: '📡 Đang lấy luồng video...' },
    { delay: 1200, msg: '▶️ Đang khởi tạo video...' },
  ];

  useEffect(() => {
    if (!activeMatch?.sourceUrl) return;
    let mounted = true;
    setStreamUrl('');
    setLoadingStreamMsg(STREAM_LOADING_PHASES[0].msg);

    const timers = STREAM_LOADING_PHASES.slice(1).map(({ delay, msg }) =>
      setTimeout(() => { if (mounted) setLoadingStreamMsg(msg); }, delay)
    );

    // If active match is VTV6 direct
    if (activeMatch.source === 'vtv6') {
      const vtvServers = [
        { label: 'VTV6 Ultra HD (1080p 50fps)', url: 'https://live-a.fptplay53.net/live/media/vtv6/live247-hls-avc/index.m3u8' },
        { label: 'VTV6 HD (FPT Live)', url: 'https://live.fptplay53.net/live/media/vtv6/live247-hls-avc/index.m3u8' },
        { label: 'VTV6 VIP (CDN Backup)', url: 'https://vips-livecdn.fptplay.net/live/media/vtv6/live247-hls-avc/index.m3u8' }
      ];
      setAvailableServers(vtvServers.map(s => s.label));

      const chosen = vtvServers.find(s => s.label === activeServer) || vtvServers[0];
      if (!activeServer) {
        setActiveServer(chosen.label);
      }

      const proxyBase = process.env.NEXT_PUBLIC_PROXY_URL || `${BE_URL}/api/proxy`;
      const sep = proxyBase.includes('?') ? '&' : '?';
      setStreamUrl(`${proxyBase}${sep}url=${encodeURIComponent(chosen.url)}&ref=${encodeURIComponent('https://fptplay.vn/')}`);
      setLoadingStreamMsg('');
      return;
    }

    (async () => {
      try {
        const query = new URLSearchParams();
        query.set('url', activeMatch.sourceUrl);
        if (activeMatch.source) query.set('source', activeMatch.source);
        if (activeServer) query.set('server', activeServer);

        const res = await fetch(`${BE_URL}/api/extract?${query.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (mounted) {
          let serverLabels: string[] = [];
          if (data.servers && data.servers.length > 0) {
            setRawServers(data.servers);
            serverLabels = data.servers.map((s: any) =>
              typeof s === 'string' ? s : (s.label || s.slug || `Server ${s.id || ''}`)
            );
            setAvailableServers(serverLabels);
          } else {
            setRawServers([]);
          }

          if (!activeServer && data.servers && data.servers.length > 0) {
            let priorityList: string[] = ['gialang'];
            try {
              const saved = localStorage.getItem('h5n1_commentator_priority');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) priorityList = parsed;
              }
            } catch {}

            // Find first server matching priority order
            let matchedServer = null;
            for (const pNorm of priorityList) {
              matchedServer = data.servers.find((s: any) => {
                const comm = typeof s === 'string' ? s : (s.commentator || s.label || '');
                const sNorm = normalizeCommentator(comm);
                return sNorm === pNorm || sNorm.includes(pNorm) || pNorm.includes(sNorm);
              });
              if (matchedServer) break;
            }

            // Fallback to first available commentator server or first server
            const chosenServer = matchedServer || data.servers[0];
            if (chosenServer) {
              const prefLabel = typeof chosenServer === 'string' 
                ? chosenServer 
                : (chosenServer.label || chosenServer.slug || `Server ${chosenServer.id || ''}`);
              setActiveServer(prefLabel);
              return;
            }
          }

          const refParam = data.iframeSrc ? `&ref=${encodeURIComponent(data.iframeSrc)}` : '';
          const proxyBase = process.env.NEXT_PUBLIC_PROXY_URL || `${BE_URL}/api/proxy`;
          const sep = proxyBase.includes('?') ? '&' : '?';
          setStreamUrl(`${proxyBase}${sep}url=${encodeURIComponent(data.streamUrl)}${refParam}`);
          setLoadingStreamMsg('');
        }
      } catch (e: any) {
        console.error('Stream error:', e);
        if (mounted) setLoadingStreamMsg(`❌ ${e.message || 'Trận đấu chưa phát sóng hoặc luồng bị lỗi.'}`);
      }
      timers.forEach(clearTimeout);
    })();
    return () => { mounted = false; timers.forEach(clearTimeout); };
  }, [activeMatch, activeServer]);

  const handleMatchSelect = (match: Match) => {
    setActiveMatch(match);
    setActiveServer('');
    setAvailableServers([]);
    setRawServers([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Derived Data & Filter Counts ───────────────────────────────────────────
  const spotlightMatch = useMemo(() => {
    if (currentSource === 'vtv6') return VTV6_MATCH_DATA;
    const activeMatches = matches.filter(m => m.status !== 'Đã kết thúc');
    return (
      activeMatches.find(m => m.isSuperHot) ||
      activeMatches.find(m => m.status === 'Trực tiếp') ||
      activeMatches.find(m => m.isHot) ||
      activeMatches[0] || null
    );
  }, [matches, currentSource]);

  // Timestamps for Today & Tomorrow filters
  const { startToday, endToday, startTomorrow, endTomorrow } = useMemo(() => {
    const today = new Date();
    const sToday = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000);
    const eToday = sToday + 86400;
    const sTomorrow = eToday;
    const eTomorrow = sTomorrow + 86400;
    return { startToday: sToday, endToday: eToday, startTomorrow: sTomorrow, endTomorrow: eTomorrow };
  }, []);

  // Filtered lists
  const liveMatches = useMemo(() => {
    return matches.filter(m => m.status === 'Trực tiếp' || (m as any).isLive);
  }, [matches]);

  const hotMatches = useMemo(() => {
    return matches.filter(m => m.isHot || m.isSuperHot);
  }, [matches]);

  const todayMatches = useMemo(() => {
    return matches.filter(m => (m as any).startTime >= startToday && (m as any).startTime < endToday);
  }, [matches, startToday, endToday]);

  const tomorrowMatches = useMemo(() => {
    return matches.filter(m => (m as any).startTime >= startTomorrow && (m as any).startTime < endTomorrow);
  }, [matches, startTomorrow, endTomorrow]);

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: matches.length,
    live: liveMatches.length,
    hot: hotMatches.length,
    today: todayMatches.length,
    tomorrow: tomorrowMatches.length,
  }), [matches.length, liveMatches.length, hotMatches.length, todayMatches.length, tomorrowMatches.length]);

  // Active displayed matches depending on filter
  const currentTabMatches = useMemo(() => {
    let list: Match[] = [];
    if (activeFilter === 'live') {
      list = liveMatches;
    } else if (activeFilter === 'hot') {
      list = hotMatches;
    } else if (activeFilter === 'today') {
      list = todayMatches;
    } else if (activeFilter === 'tomorrow') {
      list = tomorrowMatches;
    } else {
      list = matches;
    }
    return list;
  }, [activeFilter, matches, liveMatches, hotMatches, todayMatches, tomorrowMatches]);

  const visibleMatches = useMemo(() => {
    return currentTabMatches.slice(0, visibleCount);
  }, [currentTabMatches, visibleCount]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-accent selection:text-white">
      <Header 
        onLogoClick={() => { setActiveMatch(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
        currentSource={currentSource}
        onSourceChange={(src) => {
          setCurrentSource(src);
          localStorage.setItem('h5n1_default_source', src);
          setActiveMatch(null);
        }}
        onSettingsChanged={() => {
          if (activeMatch && activeMatch.source !== 'vtv6') {
            setActiveServer('');
          }
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-10">
        {/* ── Active Video Player Section ── */}
        {activeMatch && (
          <section className="space-y-4 animate-in fade-in duration-300">
            <VideoPlayer
              streamUrl={streamUrl}
              match={activeMatch}
              loadingMsg={loadingStreamMsg}
              onClose={() => setActiveMatch(null)}
              availableServers={availableServers}
              activeServer={activeServer}
              onServerChange={(srv) => setActiveServer(srv)}
            />
            {activeMatch.source !== 'vtv6' && (
              <MatchStats 
                match={activeMatch} 
                servers={rawServers}
                BE_URL={BE_URL}
              />
            )}
          </section>
        )}

        {/* ── Error Banner ── */}
        {error && currentSource === 'colatv' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-500 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>⚠️</span>
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={() => fetchAllMatches(false)}
              className="text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg font-bold transition-all"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* ── MODE: VTV6 DIRECT BROADCAST ── */}
        {currentSource === 'vtv6' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Spotlight Card for VTV6 */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div
                className="relative overflow-hidden rounded-2xl border shadow-xl transition-all cursor-pointer group"
                style={{
                  background: `linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.08) 50%, rgba(185, 28, 28, 0.18) 100%)`,
                  borderColor: `rgba(239, 68, 68, 0.35)`,
                  boxShadow: `0 0 40px rgba(239,68,68,0.15), 0 20px 60px rgba(0,0,0,0.5)`
                }}
                onClick={() => handleMatchSelect(VTV6_MATCH_DATA)}
              >
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-600 via-rose-500 to-amber-400" />

                <div className="p-6 md:p-10 flex flex-col items-center gap-6 min-h-[260px]">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/30 font-bold uppercase tracking-wider text-xs">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <span>TRỰC TIẾP VTV6</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <img 
                        src="https://vtvgo-assets.vtvdigital.vn/assets/images/v2/logo/VTV6_150x902_1675159127.webp" 
                        alt="VTV6" 
                        className="w-8 h-8 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
                      />
                      <span className="text-sm font-semibold text-foreground/70 uppercase tracking-widest">
                        ĐÀI TRUYỀN HÌNH VIỆT NAM
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center gap-3 py-4">
                    <div className="w-20 h-20 md:w-28 md:h-28 rounded-3xl bg-red-600/10 border border-red-500/30 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <Tv size={48} className="text-red-500" />
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
                      Kênh VTV6 (VTV Cần Thơ)
                    </h2>
                    <p className="text-xs md:text-sm text-foreground/60 max-w-xl">
                      Kênh truyền hình trực tiếp thể thao & giải trí 24/7 từ Đài Truyền Hình Việt Nam. Bấm để phát trực tiếp ngay trên website!
                    </p>
                  </div>

                  <button className="px-8 py-3 rounded-full font-extrabold text-sm bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-lg shadow-red-500/30 group-hover:opacity-95 transition-all">
                    ▶️ BẤM VÀO ĐÂY ĐỂ XEM VTV6 TRỰC TIẾP
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          /* ── MODE: COLATV MATCHES ── */
          <>
            {/* Skeleton Loading */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="bg-surface border border-border rounded-xl animate-pulse h-32" />
                ))}
              </div>
            )}

            {!isLoading && !error && matches.length === 0 && (
              <div className="py-24 flex flex-col items-center justify-center text-foreground/40 gap-4">
                <span className="text-6xl drop-shadow-lg grayscale">⚽</span>
                <p className="text-lg font-medium tracking-wide">Chưa có trận đấu nào được lên lịch</p>
              </div>
            )}

            {!isLoading && !error && matches.length > 0 && (
              <>
                {/* 1. Spotlight Match Feature */}
                {spotlightMatch && (
                  <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div
                      className="relative overflow-hidden rounded-2xl border shadow-xl transition-all cursor-pointer group"
                      style={{
                        background: `linear-gradient(135deg, var(--spotlight-bg-from) 0%, var(--spotlight-bg-via) 50%, var(--spotlight-bg-to) 100%)`,
                        borderColor: `var(--spotlight-border)`,
                        boxShadow: `0 0 40px rgba(249,115,22,0.15), 0 20px 60px rgba(0,0,0,0.5)`
                      }}
                      onClick={() => handleMatchSelect(spotlightMatch)}
                    >
                      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400" />
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse 60% 40% at 50% 80%, rgba(249,115,22,0.10) 0%, transparent 70%)` }} />

                      <div className="p-6 md:p-10 flex flex-col items-center gap-4 min-h-[260px]">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold uppercase tracking-wider text-xs">
                            <span className="animate-pulse">🔥</span> {spotlightMatch.status === 'Trực tiếp' ? 'TRẬN LIVE SIÊU HOT' : 'SIÊU HOT'}
                          </div>

                          <div className="flex items-center gap-2">
                            {spotlightMatch.leagueLogo ? (
                              <img src={spotlightMatch.leagueLogo} alt={spotlightMatch.league} className="w-6 h-6 object-contain" />
                            ) : (
                              <span className="text-base">⚽</span>
                            )}
                            <span className="text-sm font-semibold text-foreground/70 uppercase tracking-widest">
                              {spotlightMatch.league}
                            </span>
                          </div>
                        </div>

                        {(spotlightMatch.minute || spotlightMatch.status === 'Đã kết thúc') && (
                          <span className="text-2xl md:text-4xl font-black text-hot tracking-widest">
                            {spotlightMatch.minute || 'FT'}
                          </span>
                        )}

                        <div className="flex items-center justify-center w-full max-w-3xl gap-6 md:gap-16">
                          <div className="flex flex-col items-center flex-1 gap-3">
                            <img src={spotlightMatch.homeLogo || '/team-placeholder.png'}
                              className="w-20 h-20 md:w-32 md:h-32 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform" />
                            <span className="text-base md:text-2xl font-black text-center line-clamp-2 leading-tight">
                              {spotlightMatch.home}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 md:gap-6 text-5xl md:text-7xl font-black tabular-nums tracking-tighter drop-shadow-md flex-shrink-0">
                            {spotlightMatch.homeScore !== null && spotlightMatch.homeScore !== undefined ? (
                              <>
                                <span className="text-red-500">{spotlightMatch.homeScore}</span>
                                <span className="text-red-500 font-bold text-4xl md:text-5xl translate-y-[-2px]">:</span>
                                <span className="text-red-500">{spotlightMatch.awayScore !== null && spotlightMatch.awayScore !== undefined ? spotlightMatch.awayScore : ''}</span>
                              </>
                            ) : (
                              <span className="text-4xl md:text-5xl">VS</span>
                            )}
                          </div>

                          <div className="flex flex-col items-center flex-1 gap-3">
                            <img src={spotlightMatch.awayLogo || '/team-placeholder.png'}
                              className="w-20 h-20 md:w-32 md:h-32 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform" />
                            <span className="text-base md:text-2xl font-black text-center line-clamp-2 leading-tight">
                              {spotlightMatch.away}
                            </span>
                          </div>
                        </div>

                        <span className="time-pill text-sm! px-4! py-1.5!">
                          {spotlightMatch.time}{spotlightMatch.date ? ` ${spotlightMatch.date}` : ''}
                        </span>

                        {spotlightMatch.commentator && (
                          <div className="flex items-center gap-2 text-hot">
                            <span>🎧</span>
                            <span className="text-sm font-semibold">{spotlightMatch.commentator}</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-transparent to-black/5 pointer-events-none mix-blend-overlay" />
                    </div>
                  </section>
                )}

                {/* 2. Compact Tab Filter Bar */}
                <section className="space-y-6 pt-2">
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-border/40">
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
                      {/* Tab: Tất cả */}
                      <button
                        onClick={() => setActiveFilter('all')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 shadow-sm shrink-0 ${
                          activeFilter === 'all'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/20'
                            : 'bg-surface hover:bg-[var(--header-btn-hover)] text-foreground/70 border border-border/60 hover:text-foreground'
                        }`}
                      >
                        <ListFilter size={15} />
                        <span>Tất cả</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-foreground/70'}`}>
                          {tabCounts.all}
                        </span>
                      </button>

                      {/* Tab: Live */}
                      <button
                        onClick={() => setActiveFilter('live')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 shadow-sm shrink-0 ${
                          activeFilter === 'live'
                            ? 'bg-red-600 text-white shadow-red-500/20 ring-2 ring-red-500/40'
                            : 'bg-surface hover:bg-[var(--header-btn-hover)] text-foreground/70 border border-border/60 hover:text-foreground'
                        }`}
                      >
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <span>Live</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === 'live' ? 'bg-white/25 text-white font-black' : 'bg-red-500/10 text-red-500'}`}>
                          {tabCounts.live}
                        </span>
                      </button>

                      {/* Tab: Trận hot */}
                      <button
                        onClick={() => setActiveFilter('hot')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 shadow-sm shrink-0 ${
                          activeFilter === 'hot'
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/20'
                            : 'bg-surface hover:bg-[var(--header-btn-hover)] text-foreground/70 border border-border/60 hover:text-foreground'
                        }`}
                      >
                        <Flame size={15} className={activeFilter === 'hot' ? 'text-white animate-bounce' : 'text-orange-500'} />
                        <span>Trận hot</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === 'hot' ? 'bg-white/20 text-white' : 'bg-orange-500/10 text-orange-500'}`}>
                          {tabCounts.hot}
                        </span>
                      </button>

                      {/* Tab: Hôm nay */}
                      <button
                        onClick={() => setActiveFilter('today')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 shadow-sm shrink-0 ${
                          activeFilter === 'today'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/20'
                            : 'bg-surface hover:bg-[var(--header-btn-hover)] text-foreground/70 border border-border/60 hover:text-foreground'
                        }`}
                      >
                        <Calendar size={15} />
                        <span>Hôm nay</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === 'today' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-foreground/70'}`}>
                          {tabCounts.today}
                        </span>
                      </button>

                      {/* Tab: Ngày mai */}
                      <button
                        onClick={() => setActiveFilter('tomorrow')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 shadow-sm shrink-0 ${
                          activeFilter === 'tomorrow'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/20'
                            : 'bg-surface hover:bg-[var(--header-btn-hover)] text-foreground/70 border border-border/60 hover:text-foreground'
                        }`}
                      >
                        <Clock size={15} />
                        <span>Ngày mai</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === 'tomorrow' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-foreground/70'}`}>
                          {tabCounts.tomorrow}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Matches Grid */}
                  {visibleMatches.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-foreground/40 gap-3">
                      <span className="text-4xl grayscale">⚽</span>
                      <p className="text-base font-medium">Không có trận đấu nào trong mục này</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                      {visibleMatches.map(match => (
                        <MatchCard key={match.id} match={match} onClick={handleMatchSelect} isActive={activeMatch?.id === match.id} />
                      ))}
                    </div>
                  )}

                  {/* Load More Button */}
                  {visibleCount < currentTabMatches.length && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setVisibleCount(prev => prev + 15)}
                        className="group flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold bg-surface hover:bg-[var(--header-btn-hover)] border border-border transition-all text-foreground hover:border-accent hover:text-accent shadow-sm"
                      >
                        XEM THÊM TRẬN ĐẤU ({currentTabMatches.length - visibleCount} TRẬN CÒN LẠI) <ChevronDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
