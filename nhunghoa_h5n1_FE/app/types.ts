export interface Match {
    id: string;
    home: string;
    away: string;
    homeLogo: string;
    awayLogo: string;
    leagueId: string;
    leagueLogo: string;
    league: string;
    time: string;
    date: string;
    status: 'Trực tiếp' | 'Sắp tới' | 'Đã kết thúc';
    minute: string;          // e.g. 'Hiệp 1', 'Hiệp 2', 'HT', 'FT'
    homeScore: number | null;
    awayScore: number | null;
    isHot: boolean;
    section?: string;
    sourceUrl: string;
}

export interface LeagueInfo {
    leagueId: string;
    league: string;
    leagueLogo: string;
    count: number;
}

export type FilterTab = 'live' | 'hot' | 'today' | 'tomorrow' | 'all';
