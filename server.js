const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'frontend');

const mimeByExt = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
    // Normalize and prevent path traversal
    const safePath = path.normalize(decodeURIComponent(req.url)).replace(/^(\.\.[/\\])+/, ''); // sanitize [web:15]
    const requestedPath = safePath === '/' ? '/index.html' : safePath; // default file [web:15]
    const filePath = path.join(PUBLIC_DIR, requestedPath);

    if (!filePath.startsWith(PUBLIC_DIR)) { // directory traversal guard [web:15]
        res.writeHead(400, {'Content-Type': 'text/plain'});
        return res.end('Bad Request\n'); // simple guard [web:15]
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, {'Content-Type': 'text/plain'}); // 404 handling [web:15]
            return res.end('Not Found\n');
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = mimeByExt[ext] || 'application/octet-stream'; // basic MIME map [web:15]
        res.writeHead(200, {'Content-Type': mime}); // content type [web:15]
        fs.createReadStream(filePath).pipe(res); // stream file [web:15]
    });
});

server.listen(PORT, () => {
    console.log(`Static server on http://localhost:${PORT}/`);
});
