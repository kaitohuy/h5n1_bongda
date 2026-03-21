import Header from "@/components/Header";
import StandingsLayout from "@/components/StandingsLayout";

// Server component to fetch the standings from the internal API
async function getStandings() {
    try {
        console.log('[FE] Fetching standings from backend...');
        const BE_URL = process.env.NEXT_PUBLIC_BE_URL || process.env.BE_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${BE_URL}/api/standings`, { 
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`Failed to fetch API: ${res.status}`);
        const data = await res.json();
        
        const lCount = data.leagues ? data.leagues.length : 0;
        const nCount = data.navigation ? data.navigation.length : 0;
        console.log(`[FE] Received ${lCount} leagues and ${nCount} navigation items`);
        
        return { 
            leagues: data.leagues || [], 
            navigation: data.navigation || [] 
        };
    } catch (error) {
        console.error("[FE] Error fetching standings:", error);
        return { leagues: [], navigation: [] };
    }
}

export default async function StandingsPage() {
    const { leagues, navigation } = await getStandings();
    
    console.log(`[FE] Page Render: leagues=${leagues.length}, navigation=${navigation.length}`);

    return (
        <div 
            className="min-h-screen bg-[var(--app-bg)] text-foreground flex flex-col transition-colors duration-200"
            suppressHydrationWarning
        >
            <Header />
            
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-8 lg:px-8">
                <div className="mb-6 md:mb-8">
                    <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3 tracking-tight">
                        Bảng xếp hạng bóng đá mới nhất
                    </h1>
                </div>
                
                <div className="w-full">
                    {leagues.length > 0 || navigation.length > 0 ? (
                        <StandingsLayout leagues={leagues} navigation={navigation} />
                    ) : (
                        <div className="p-10 text-center flex flex-col items-center gap-4 bg-[var(--card-bg)] rounded-xl border border-border-theme">
                            <div className="w-12 h-12 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-foreground/70 font-medium tracking-tight">Đang tải bảng xếp hạng... Nếu đợi quá lâu, xin thử làm mới trang.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
