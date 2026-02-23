/**
 * server.js – Servidor local con proxy CORS para el Generador QR
 * Sirve los archivos estáticos en puerto 3030 y expone
 * GET /proxy?url=<encoded_url> para descargar imágenes externas
 * sin restricciones CORS en el navegador.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3030;
const ROOT = __dirname;

// MIME types
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.json': 'application/json',
};

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // ── CORS proxy endpoint ──────────────────────────────────────
    if (pathname === '/proxy') {
        const targetUrl = parsed.query.url;
        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing ?url= parameter');
            return;
        }

        let parsedTarget;
        try {
            parsedTarget = new URL(targetUrl);
        } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid URL');
            return;
        }

        // Only allow http/https
        if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Only http/https URLs are allowed');
            return;
        }

        const lib = parsedTarget.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsedTarget.hostname,
            port: parsedTarget.port || (parsedTarget.protocol === 'https:' ? 443 : 80),
            path: parsedTarget.pathname + parsedTarget.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; QRGenerator/1.0)',
                'Accept': 'image/*,*/*',
            },
        };

        const proxyReq = lib.request(options, (proxyRes) => {
            // Follow redirects (up to 5)
            if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode)) {
                const location = proxyRes.headers['location'];
                if (location) {
                    const redirectUrl = new URL(location, targetUrl).toString();
                    res.writeHead(302, {
                        'Location': `/proxy?url=${encodeURIComponent(redirectUrl)}`,
                        'Access-Control-Allow-Origin': '*',
                    });
                    res.end();
                    return;
                }
            }

            res.writeHead(proxyRes.statusCode, {
                'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600',
            });
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('[proxy] Error:', err.message);
            if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
                res.end('Proxy error: ' + err.message);
            }
        });

        proxyReq.end();
        return;
    }

    // ── Static file server ───────────────────────────────────────
    let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);

    // Security: prevent path traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            // Try index.html for directories
            const indexPath = path.join(filePath, 'index.html');
            fs.stat(indexPath, (err2, stat2) => {
                if (!err2 && stat2.isFile()) {
                    serveFile(indexPath, res);
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                }
            });
            return;
        }
        serveFile(filePath, res);
    });
});

function serveFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

server.listen(PORT, () => {
    console.log('');
    console.log('  ┌─────────────────────────────────────────────┐');
    console.log('  │                                             │');
    console.log('  │   🚀 Generador QR – Gaceta UNACH           │');
    console.log(`  │   Local:  http://localhost:${PORT}           │`);
    console.log('  │   Proxy:  /proxy?url=<encoded_url>          │');
    console.log('  │                                             │');
    console.log('  └─────────────────────────────────────────────┘');
    console.log('');
});
