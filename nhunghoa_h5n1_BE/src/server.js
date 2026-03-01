/**
 * server.js
 * Express application entry point for the H5N1 scraper microservice.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 8000;

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (curl, Postman, server-to-server)
            if (!origin) return callback(null, true);
            if (
                allowedOrigins.includes(origin) ||
                origin.endsWith('.vercel.app')  // allow all Vercel preview/production URLs
            ) {
                return callback(null, true);
            }
            return callback(new Error(`CORS: origin "${origin}" not allowed`));
        },
        methods: ['GET'],
        optionsSuccessStatus: 200,
    })
);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// Simple request logger
app.use((req, _res, next) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.originalUrl}`);
    next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', routes);

// 404 catch-all
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
    console.error('[server error]', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 nhunghoa-h5n1-be scraper service running on http://localhost:${PORT}`);
    console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`);
    console.log(`   Endpoints:`);
    console.log(`     GET /health`);
    console.log(`     GET /api/extract?url=<target-page>\n`);
});
