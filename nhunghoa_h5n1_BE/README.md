# nhunghoa-h5n1-be

Standalone scraper microservice for the H5N1 soccer streaming aggregator.

## What it does
Accepts a target streaming page URL, launches a headless Chromium browser via Playwright, intercepts network requests, and returns the first `.m3u8` HLS stream URL it finds.

## Stack
- **Node.js** + **Express** (HTTP server)
- **Playwright** (headless Chromium, network interception)
- **dotenv** (environment config)
- **cors** (cross-origin access for `localhost:3000` and Vercel)

## Setup
```bash
npm install
npx playwright install chromium
```

## Running
```bash
# Development (auto-restarts on change, Node 18+)
npm run dev

# Production
npm start
```

Listens on `http://localhost:8000` by default.

## API

### `GET /health`
```json
{ "status": "ok", "service": "nhunghoa-h5n1-be", "timestamp": "..." }
```

### `GET /api/extract?url=<target>`
| Param | Type   | Required | Description |
|-------|--------|----------|-------------|
| `url` | string | ✅        | Full `http/https` URL of the streaming page |

**Success `200`:**
```json
{
  "success": true,
  "streamUrl": "https://cdn.example.com/stream/match.m3u8",
  "source": "https://target-site.com/match-1",
  "elapsedMs": 3240
}
```

**Timeout `504`:**
```json
{
  "success": false,
  "error": "Timed out: no .m3u8 stream URL found on this page within 15 seconds.",
  "elapsedMs": 15001
}
```

## Environment Variables (`.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Server port |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `PLAYWRIGHT_TIMEOUT_MS` | `15000` | Max scrape wait time |
