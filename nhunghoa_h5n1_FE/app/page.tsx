'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, WifiOff, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import MatchCard from '@/components/MatchCard';
import VideoPlayer from '@/components/VideoPlayer';
import { Match } from './types';

const BE_URL = process.env.NEXT_PUBLIC_BE_URL || 'http://localhost:8000';

export default function Home() {
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [activeServer, setActiveServer] = useState<string>('');
  const [availableServers, setAvailableServers] = useState<string[]>([]);

  const [matches, setMatches] = useState<Match[]>([]);
  const [hasMoreBackend, setHasMoreBackend] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState<'hot' | 'live' | null>(null);
  const [error, setError] = useState('');

  // ── Fetch ALL matches from BE ──────────────────────────────────────────────
  const fetchAllMatches = useCallback(async (loadMore: boolean = false) => {
    if (!loadMore) setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ filter: 'all', loadMore: loadMore ? 'true' : 'false' });
      const res = await fetch(`${BE_URL}/api/matches?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lỗi lấy dữ liệu');
      setHasMoreBackend(Boolean(data.hasMore));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: Match[] = (data.matches || []).map((m: any) => ({
        id: String(m.id),
        home: String(m.home || 'Đội nhà'),
        away: String(m.away || 'Đội khách'),
        homeLogo: String(m.homeLogo || ''),
        awayLogo: String(m.awayLogo || ''),
        leagueId: String(m.leagueId || ''),
        leagueLogo: String(m.leagueLogo || ''),
        league: String(m.league || 'Không rõ'),
        time: String(m.time || '--:--'),
        date: String(m.date || ''),
        status: (m.status as Match['status']) || 'Sắp tới',
        minute: String(m.minute || ''),
        homeScore: m.homeScore !== null && m.homeScore !== undefined ? Number(m.homeScore) : null,
        awayScore: m.awayScore !== null && m.awayScore !== undefined ? Number(m.awayScore) : null,
        isHot: Boolean(m.isHot),
        section: String(m.section || ''),
        sourceUrl: String(m.sourceUrl || ''),
      }));
      setMatches(raw);
    } catch {
      setError('Không kết nối được đến backend. Kiểm tra BE đang chạy trên cổng 8000.');
    } finally {
      if (!loadMore) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllMatches(false); // Init without loadMore
  }, [fetchAllMatches]);

  useEffect(() => {
    const id = setInterval(() => fetchAllMatches(false), 60_000);
    return () => clearInterval(id);
  }, [fetchAllMatches]);

  // Handle Load More
  const handleLoadMore = useCallback(async (section: 'hot' | 'live') => {
    setIsFetchingMore(section);
    // 1. Fetch lại toàn bộ với chế độ loadMore (sẽ lấy từ cache full hoặc quét full)
    await fetchAllMatches(true);
    // 2. Mở khóa display logic
    setIsFetchingMore(null);
  }, [fetchAllMatches]);

  // ── Fetch stream URL ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeMatch?.sourceUrl) return;
    let mounted = true;
    setStreamUrl('');
    (async () => {
      try {
        const query = new URLSearchParams();
        query.set('url', activeMatch.sourceUrl);
        if (activeServer) query.set('server', activeServer);

        const res = await fetch(`${BE_URL}/api/extract?${query.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (mounted) {
          if (data.servers && data.servers.length > 0) {
            setAvailableServers(data.servers);
            if (!activeServer && data.servers.length > 0) {
              // If it's the first load and we don't have an active server, set it to the first one behind the scenes
              // But wait, the API already returned a stream. Don't worry, UI will show it as active if empty or match.
            }
          }
          const refParam = data.iframeSrc ? `&ref=${encodeURIComponent(data.iframeSrc)}` : '';
          const cfWorker = process.env.NEXT_PUBLIC_PROXY_URL || 'https://h5n1-proxy.huynguyendoan0305.workers.dev';
          setStreamUrl(`${cfWorker}/?url=${encodeURIComponent(data.streamUrl)}${refParam}`);
        }
      } catch (e) { console.error('Stream error:', e); }
    })();
    return () => { mounted = false; };
  }, [activeMatch, activeServer]);

  const handleMatchSelect = (match: Match) => {
    setActiveMatch(match);
    setActiveServer('');
    setAvailableServers([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Derived Data ───────────────────────────────────────────────────────────
  // Spotlight Match - ưu tiên: 1) hot+live, 2) hot bắt kỳ, 3) live bất kỳ, 4) trận đầu tiên
  const spotlightMatch = useMemo(() => {
    return (
      matches.find((m: Match) => (m.isHot || m.section === 'hot') && (m.status === 'Trực tiếp' || m.section === 'live')) ||
      matches.find((m: Match) => m.isHot || m.section === 'hot') ||
      matches.find((m: Match) => m.status === 'Trực tiếp' || m.section === 'live') ||
      matches[0] || null
    );
  }, [matches]);

  // Hot Matches (excluding the spotlight)
  const hotMatches = useMemo(() => {
    return matches.filter((m: Match) => (m.isHot || m.section === 'hot') && m.id !== spotlightMatch?.id);
  }, [matches, spotlightMatch]);

  // Live Matches (excluding the spotlight)
  const liveMatches = useMemo(() => {
    return matches.filter((m: Match) => (m.status === 'Trực tiếp' || m.section === 'live') && m.id !== spotlightMatch?.id);
  }, [matches, spotlightMatch]);



  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header onLogoClick={() => { setActiveMatch(null); setStreamUrl(''); }} />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        {/* Video Player Popup/Block */}
        {activeMatch && (
          <div className="mb-10 ring-1 ring-border shadow-2xl rounded-2xl overflow-hidden bg-black/50">
            <VideoPlayer
              match={activeMatch}
              streamUrl={streamUrl}
              activeServer={activeServer}
              availableServers={availableServers}
              onServerChange={setActiveServer}
              onClose={() => { setActiveMatch(null); setStreamUrl(''); }}
            />
          </div>
        )}

        {/* Global States */}
        {!isLoading && error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm mb-6">
            <WifiOff size={16} /> {error}
          </div>
        )}

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
                  className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-surface to-background shadow-xl hover:shadow-accent/20 border-border hover:border-accent/40 transition-all cursor-pointer group"
                  onClick={() => handleMatchSelect(spotlightMatch)}
                >
                  {/* Decorative neon line on top */}
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>

                  <div className="p-6 md:p-10 flex flex-col items-center justify-center min-h-[240px]">
                    {/* Badge Spotlight */}
                    <div className="absolute top-4 left-4 lg:top-6 lg:left-6 flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold uppercase tracking-wider text-xs md:text-sm">
                      <span className="animate-pulse">🔥</span> TRẬN SIÊU HOT
                    </div>

                    {/* League */}
                    <div className="flex flex-col items-center gap-2 mb-8 mt-6">
                      {spotlightMatch.leagueLogo && <img src={spotlightMatch.leagueLogo} alt={spotlightMatch.league} className="w-10 h-10 object-contain drop-shadow-md" />}
                      <span className="text-sm font-semibold text-foreground/70 text-center uppercase tracking-widest">{spotlightMatch.league}</span>
                    </div>

                    {/* Main Scoreboard Layout */}
                    <div className="flex items-center justify-center w-full max-w-3xl gap-4 md:gap-12 relative z-10">
                      {/* Home */}
                      <div className="flex flex-col items-center flex-1 gap-3">
                        <img src={spotlightMatch.homeLogo || '/team-placeholder.png'} className="w-16 h-16 md:w-28 md:h-28 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform" />
                        <span className="text-base md:text-2xl font-black text-center line-clamp-2 leading-tight">{spotlightMatch.home}</span>
                      </div>

                      {/* Details */}
                      <div className="flex flex-col items-center justify-center px-2 md:px-8">
                        <span className="text-xs md:text-sm font-bold text-accent mb-2 drop-shadow-sm uppercase tracking-widest">
                          {spotlightMatch.minute || spotlightMatch.time} {spotlightMatch.date}
                        </span>
                        <div className="flex items-center gap-3 md:gap-6 text-4xl md:text-6xl font-black tabular-nums tracking-tighter drop-shadow-md">
                          <span>{spotlightMatch.homeScore !== null && spotlightMatch.homeScore !== undefined ? spotlightMatch.homeScore : 'VS'}</span>
                          {(spotlightMatch.homeScore !== null && spotlightMatch.homeScore !== undefined) && (
                            <span className="text-foreground/20 font-light translate-y-[-2px]">:</span>
                          )}
                          <span>{spotlightMatch.awayScore !== null && spotlightMatch.awayScore !== undefined ? spotlightMatch.awayScore : ''}</span>
                        </div>
                      </div>

                      {/* Away */}
                      <div className="flex flex-col items-center flex-1 gap-3">
                        <img src={spotlightMatch.awayLogo || '/team-placeholder.png'} className="w-16 h-16 md:w-28 md:h-28 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform" />
                        <span className="text-base md:text-2xl font-black text-center line-clamp-2 leading-tight">{spotlightMatch.away}</span>
                      </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-transparent to-black/5 pointer-events-none mix-blend-overlay"></div>
                  </div>
                </div>
              </section>
            )}

            {/* 2. Trận Đấu Hot Grid */}
            {hotMatches.length > 0 && (
              <section className="space-y-6 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-accent rounded-full mb-0.5 shadow-[0_0_10px_var(--accent-glow)]"></div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider">TRẬN ĐẤU HOT</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hotMatches.map(match => (
                    <MatchCard key={match.id} match={match} onClick={handleMatchSelect} isActive={activeMatch?.id === match.id} />
                  ))}
                </div>

                {hasMoreBackend && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => handleLoadMore('hot')}
                      disabled={isFetchingMore === 'hot'}
                      className="group flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-surface hover:bg-[var(--header-btn-hover)] border border-border transition-all text-accent hover:border-accent hover:shadow-[0_0_15px_var(--accent-glow)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingMore === 'hot' ? (
                        <>ĐANG TẢI <Loader2 size={18} className="animate-spin" /></>
                      ) : (
                        <>XEM THÊM TRẬN HOT <ChevronDown size={18} className="group-hover:translate-y-0.5 transition-transform" /></>
                      )}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* 3. Trận Đấu Đang Diễn Ra Grid */}
            {liveMatches.length > 0 && (
              <section className="space-y-6 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full mb-0.5 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-emerald-500">ĐANG DIỄN RA</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveMatches.map(match => (
                    <MatchCard key={match.id} match={match} onClick={handleMatchSelect} isActive={activeMatch?.id === match.id} />
                  ))}
                </div>

                {hasMoreBackend && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => handleLoadMore('live')}
                      disabled={isFetchingMore === 'live'}
                      className="group flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-surface hover:bg-[var(--header-btn-hover)] border border-border transition-all text-emerald-500 hover:border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingMore === 'live' ? (
                        <>ĐANG TẢI <Loader2 size={18} className="animate-spin" /></>
                      ) : (
                        <>XEM THÊM TRỰC TIẾP <ChevronDown size={18} className="group-hover:translate-y-0.5 transition-transform" /></>
                      )}
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
