'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import Header from '@/components/Header';
import SubTabBar from '@/components/SubTabBar';
import LeagueFilter from '@/components/LeagueFilter';
import MatchCard from '@/components/MatchCard';
import VideoPlayer from '@/components/VideoPlayer';
import { Match, LeagueInfo, FilterTab } from './types';

const BE_URL = process.env.NEXT_PUBLIC_BE_URL || 'http://localhost:8000';

export default function Home() {
  const [activeTab, setActiveTab] = useState<FilterTab>('live');
  const [activeLeagueId, setActiveLeagueId] = useState<string>('');
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [activeServer, setActiveServer] = useState<string>('1');
  const [streamUrl, setStreamUrl] = useState<string>('');

  const [matches, setMatches] = useState<Match[]>([]);
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Fetch matches from BE ──────────────────────────────────────────────────
  const fetchMatches = useCallback(async (tab: FilterTab, leagueId: string) => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ filter: tab });
      if (leagueId) params.set('league', leagueId);
      const res = await fetch(`${BE_URL}/api/matches?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lỗi lấy dữ liệu');
      const raw: Match[] = (data.matches || []).map((m: Record<string, unknown>) => ({
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
        sourceUrl: String(m.sourceUrl || ''),
      }));
      setMatches(raw);
      setLeagues(data.leagues || []);
    } catch {
      setError('Không kết nối được đến BE. Hãy chắc chắn BE đang chạy (port 8000).');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches(activeTab, activeLeagueId);
  }, [activeTab, activeLeagueId, fetchMatches]);

  // Auto-refresh live/hot tabs every 60s
  useEffect(() => {
    if (activeTab !== 'live' && activeTab !== 'hot') return;
    const id = setInterval(() => fetchMatches(activeTab, activeLeagueId), 60_000);
    return () => clearInterval(id);
  }, [activeTab, activeLeagueId, fetchMatches]);

  // ── Tab counts ─────────────────────────────────────────────────────────────
  const tabCounts = useMemo<Record<FilterTab, number>>(() => ({
    live: matches.filter(m => m.status === 'Trực tiếp').length,
    hot: matches.filter(m => m.isHot).length,
    today: matches.length,
    tomorrow: 0,
    all: matches.length,
  }), [matches]);

  // ── Fetch stream URL ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeMatch?.sourceUrl) return;
    let mounted = true;
    setStreamUrl('');
    (async () => {
      try {
        const res = await fetch(`${BE_URL}/api/extract?url=${encodeURIComponent(activeMatch.sourceUrl)}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const refParam = data.iframeSrc ? `&ref=${encodeURIComponent(data.iframeSrc)}` : '';
        if (mounted) setStreamUrl(`${BE_URL}/api/proxy?url=${encodeURIComponent(data.streamUrl)}${refParam}`);
      } catch (e) { console.error('Stream error:', e); }
    })();
    return () => { mounted = false; };
  }, [activeMatch, activeServer]);

  const handleMatchSelect = (match: Match) => {
    setActiveMatch(match);
    setActiveServer('1');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setActiveLeagueId('');
    setActiveMatch(null);
    setStreamUrl('');
  };

  const handleLeagueChange = (leagueId: string) => {
    setActiveLeagueId(leagueId);
    setActiveMatch(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header onLogoClick={() => { setActiveMatch(null); setStreamUrl(''); }} />

      {/* ── Sticky toolbar ── */}
      <div className="sticky top-16 z-40 bg-[var(--subnav-bg)] border-b border-border-theme shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <SubTabBar
            active={activeTab}
            counts={tabCounts}
            onChange={handleTabChange}
          />
          <LeagueFilter
            leagues={leagues}
            activeLeagueId={activeLeagueId}
            onChange={handleLeagueChange}
          />
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* Video player */}
        {activeMatch && (
          <div className="mb-8">
            <VideoPlayer
              match={activeMatch}
              streamUrl={streamUrl}
              activeServer={activeServer}
              onServerChange={setActiveServer}
              onClose={() => { setActiveMatch(null); setStreamUrl(''); }}
            />
          </div>
        )}

        {/* Section title */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black uppercase tracking-wide text-foreground/80">
            {activeMatch ? 'Các trận khác' : (() => {
              const labels: Record<FilterTab, string> = {
                live: '⚡ Đang trực tiếp', hot: '🔥 Trận hot',
                today: '📅 Hôm nay', tomorrow: '🗓️ Ngày mai', all: '⚽ Tất cả trận'
              };
              return labels[activeTab];
            })()}
          </h2>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
            {!isLoading && (
              <span className="text-sm font-semibold text-foreground/50 bg-surface border border-border px-3 py-1 rounded-full">
                {matches.length} trận
              </span>
            )}
          </div>
        </div>

        {/* Error */}
        {!isLoading && error && (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 px-4 py-3 rounded-xl text-sm mb-6">
            <WifiOff size={16} /> {error}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl animate-pulse h-32" />
            ))}
          </div>
        )}

        {/* Match grid — 2-col on desktop like xoilacz, 1-col mobile */}
        {!isLoading && !error && (
          matches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {matches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onClick={handleMatchSelect}
                  isActive={activeMatch?.id === match.id}
                />
              ))}
            </div>
          ) : (
            <div className="py-24 flex flex-col items-center text-foreground/40 gap-4">
              <span className="text-6xl">⚽</span>
              <p className="text-lg font-medium">
                Không có trận đấu nào{activeLeagueId && ' trong giải này'}
              </p>
              {activeLeagueId && (
                <button
                  onClick={() => handleLeagueChange('')}
                  className="text-sm text-accent underline"
                >
                  Xem tất cả giải đấu
                </button>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}
