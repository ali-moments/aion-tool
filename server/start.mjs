#!/usr/bin/env node
/**
 * Standalone server starter for Electron packaged app
 * This script starts the Vite preview server without requiring npm
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Port configuration
const PORT = process.env.PORT || 8081;

// Content type mapping
const CONTENT_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webp': 'image/webp',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4'
};

// Find the build output directory
function findBuildDir() {
    const possiblePaths = [
        join(__dirname, '..', '.vercel', 'output', 'static'),
        join(__dirname, '..', 'dist', 'client'),
        join(__dirname, '..', 'dist'),
        join(__dirname, '..', 'build')
    ];
    
    for (const path of possiblePaths) {
        try {
            const indexPath = join(path, 'index.html');
            readFileSync(indexPath);
            console.log(`Found build directory: ${path}`);
            return path;
        } catch {
            continue;
        }
    }
    
    throw new Error('Could not find build output directory. Please run build first.');
}

const BUILD_DIR = findBuildDir();

// Simple static file server
const server = createServer((req, res) => {
    try {
        // Parse URL and remove query string
        let pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
        
        // Default to index.html for root and routes
        if (pathname === '/' || !pathname.includes('.')) {
            pathname = '/index.html';
        }
        
        const filePath = join(BUILD_DIR, pathname);
        const ext = extname(filePath);
        const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
        
        // Read and serve file
        const content = readFileSync(filePath);
        res.writeHead(200, { 
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });
        res.end(content);
        
    } catch (error) {
        // File not found - serve index.html for SPA routing
        if (error.code === 'ENOENT') {
            try {
                const indexPath = join(BUILD_DIR, 'index.html');
                const content = readFileSync(indexPath);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            } catch {
                res.writeHead(404);
                res.end('Not Found');
            }
        } else {
            console.error('Server error:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
});

server.listen(PORT, 'localhost', () => {
    console.log(`Preview server running at http://localhost:${PORT}`);
    console.log(`Serving files from: ${BUILD_DIR}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
