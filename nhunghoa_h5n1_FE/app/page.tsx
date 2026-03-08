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
  const [loadingStreamMsg, setLoadingStreamMsg] = useState('');

  const [matches, setMatches] = useState<Match[]>([]);
  const [hasMoreBackend, setHasMoreBackend] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState<'hot' | 'live' | null>(null);
  const [error, setError] = useState('');

  const [showAllHot, setShowAllHot] = useState(false);
  const [showAllLive, setShowAllLive] = useState(false);

  // ── Fetch ALL matches from BE ──────────────────────────────────────────────
  const fetchAllMatches = useCallback(async (loadMore: boolean = false) => {
    if (!loadMore) setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ filter: 'all', loadMore: loadMore ? 'true' : 'false' });
      const res = await fetch(`${BE_URL}/api/matches?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lỗi lấy dữ liệu');
      setHasMoreBackend(Boolean(data.hasMore));
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
        isSuperHot: Boolean(m.isSuperHot),
        commentator: String(m.commentator || ''),
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
    const id = setInterval(() => fetchAllMatches(false), 600_000);
    return () => clearInterval(id);
  }, [fetchAllMatches]);

  // Handle Load More
  const handleLoadMore = useCallback(async (section: 'hot' | 'live') => {
    setIsFetchingMore(section);
    // 1. Fetch lại toàn bộ với chế độ loadMore (sẽ lấy từ cache full hoặc quét full)
    await fetchAllMatches(true);
    // 2. Mở khóa display logic
    if (section === 'hot') setShowAllHot(true);
    if (section === 'live') setShowAllLive(true);
    setIsFetchingMore(null);
  }, [fetchAllMatches]);

  // ── Fetch stream URL ───────────────────────────────────────────────────────
  // Các phase loading message hiển thị trong quá trình chờ scraper (~6s)
  const STREAM_LOADING_PHASES = [
    { delay: 0, msg: '🔌 Đang kết nối máy chủ...' },
    { delay: 1500, msg: '🤖 Đang tải trình duyệt ảo...' },
    { delay: 3000, msg: '⏭️ Đang bỏ qua quảng cáo...' },
    { delay: 5000, msg: '📡 Đang lấy luồng video...' },
  ];

  useEffect(() => {
    if (!activeMatch?.sourceUrl) return;
    let mounted = true;
    setStreamUrl('');
    setLoadingStreamMsg(STREAM_LOADING_PHASES[0].msg);

    // Rotate trạng thái loading theo từng phase
    const timers = STREAM_LOADING_PHASES.slice(1).map(({ delay, msg }) =>
      setTimeout(() => { if (mounted) setLoadingStreamMsg(msg); }, delay)
    );

    (async () => {
      try {
        const query = new URLSearchParams();
        query.set('url', activeMatch.sourceUrl);
        if (activeServer) query.set('server', activeServer);

        const res = await fetch(`${BE_URL}/api/extract?${query.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (mounted) {
          if (data.servers && data.servers.length > 0) {
            setAvailableServers(data.servers);
          }
          const refParam = data.iframeSrc ? `&ref=${encodeURIComponent(data.iframeSrc)}` : '';
          const cfWorker = process.env.NEXT_PUBLIC_PROXY_URL || 'https://h5n1-proxy.huynguyendoan0305.workers.dev';
          setStreamUrl(`${cfWorker}/?url=${encodeURIComponent(data.streamUrl)}${refParam}`);
          setLoadingStreamMsg('');
        }
      } catch (e) {
        console.error('Stream error:', e);
        if (mounted) setLoadingStreamMsg('❌ Không thể tải luồng. Thử lại sau.');
      }
      timers.forEach(clearTimeout);
    })();
    return () => { mounted = false; timers.forEach(clearTimeout); };
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
      matches.find(m => m.isSuperHot) ||                                          // ưu tiên cao nhất: trận Gà Siêu Mồm
      matches.find(m => (m.isHot || m.section === 'hot') && (m.status === 'Trực tiếp' || m.section === 'live')) ||
      matches.find(m => m.isHot || m.section === 'hot') ||
      matches.find(m => m.status === 'Trực tiếp' || m.section === 'live') ||
      matches[0] || null
    );
  }, [matches]);

  // Hot Matches
  const hotMatches = useMemo(() => {
    return matches.filter(m => m.isHot || m.section === 'hot');
  }, [matches]);

  // Live Matches
  const liveMatches = useMemo(() => {
    return matches.filter(m => m.status === 'Trực tiếp' || m.section === 'live');
  }, [matches]);



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
              loadingMsg={loadingStreamMsg}
              activeServer={activeServer}
              availableServers={availableServers}
              onServerChange={setActiveServer}
              onClose={() => { setActiveMatch(null); setStreamUrl(''); setLoadingStreamMsg(''); }}
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
                  className="relative overflow-hidden rounded-2xl border shadow-xl transition-all cursor-pointer group"
                  style={{
                    background: `linear-gradient(135deg, var(--spotlight-bg-from) 0%, var(--spotlight-bg-via) 50%, var(--spotlight-bg-to) 100%)`,
                    borderColor: `var(--spotlight-border)`,
                    boxShadow: `0 0 40px rgba(249,115,22,0.15), 0 20px 60px rgba(0,0,0,0.5)`
                  }}
                  onClick={() => handleMatchSelect(spotlightMatch)}
                >
                  {/* Neon line on top */}
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400" />
                  {/* Ember glow blob */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 60% 40% at 50% 80%, rgba(249,115,22,0.10) 0%, transparent 70%)` }} />

                  <div className="p-6 md:p-10 flex flex-col items-center gap-4 min-h-[260px]">

                    {/* Badge SIÊU HOT (góc trái) + League name (giữa) — chỉ 1 hàng */}
                    <div className="flex items-center justify-between w-full">
                      {/* Badge SIÊU HOT */}
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold uppercase tracking-wider text-xs">
                        <span className="animate-pulse">🔥</span> SIÊU HOT
                      </div>

                      {/* League ở giữa — luôn có icon */}
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

                    {/* Phút thi đấu */}
                    {(spotlightMatch.minute || spotlightMatch.status === 'Đã kết thúc') && (
                      <span className="text-2xl md:text-4xl font-black text-hot tracking-widest">
                        {spotlightMatch.minute || 'FT'}
                      </span>
                    )}

                    {/* Team logos + score (hàng chính) */}
                    <div className="flex items-center justify-center w-full max-w-3xl gap-6 md:gap-16">
                      {/* Home */}
                      <div className="flex flex-col items-center flex-1 gap-3">
                        <img src={spotlightMatch.homeLogo || '/team-placeholder.png'}
                          className="w-20 h-20 md:w-32 md:h-32 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform" />
                        <span className="text-base md:text-2xl font-black text-center line-clamp-2 leading-tight">
                          {spotlightMatch.home}
                        </span>
                      </div>

                      {/* Score */}
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

                      {/* Away */}
                      <div className="flex flex-col items-center flex-1 gap-3">
                        <img src={spotlightMatch.awayLogo || '/team-placeholder.png'}
                          className="w-20 h-20 md:w-32 md:h-32 object-contain drop-shadow-2xl group-hover:scale-105 transition-transform" />
                        <span className="text-base md:text-2xl font-black text-center line-clamp-2 leading-tight">
                          {spotlightMatch.away}
                        </span>
                      </div>
                    </div>

                    {/* Time + Date pill (gradient) */}
                    <span className="time-pill text-sm! px-4! py-1.5!">
                      {spotlightMatch.time}{spotlightMatch.date ? ` ${spotlightMatch.date}` : ''}
                    </span>

                    {/* BLV */}
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


            {/* 2. Trận Đấu Hot Grid */}
            {hotMatches.length > 0 && (
              <section className="space-y-6 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-hot rounded-full mb-0.5"></div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-hot">TRẬN ĐẤU HOT</h2>
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
                  <div className="w-1.5 h-6 bg-hot rounded-full mb-0.5 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-hot">ĐANG DIỄN RA</h2>
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
