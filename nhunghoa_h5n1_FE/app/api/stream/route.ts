import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('matchId');
  const server = searchParams.get('server') || '1';

  if (!matchId) {
    return NextResponse.json(
      { error: 'matchId is required' },
      { status: 400 }
    );
  }

  // Use reliable HLS test stream to avoid react-player AbortError
  const mockStreams = {
    '1': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    '2': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
  };

  const streamUrl = mockStreams[server as keyof typeof mockStreams] || mockStreams['1'];

  return NextResponse.json({
    matchId,
    server,
    streamUrl,
  });
}
