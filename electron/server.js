import { createServer } from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { app } from "electron";
import { existsSync, readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_PORT = 8081;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

let httpServer = null;
let nitroHandler = null;

// Find the Nitro server entry point
function findNitroServer(appRoot) {
    const possiblePaths = [
        join(appRoot, '.vercel', 'output', 'functions', '__server.func', 'index.mjs'),
        join(appRoot, '.output', 'server', 'index.mjs'),
    ];
    
    // In packaged apps, also check in unpacked resources
    if (app.isPackaged) {
        const resourcesPath = process.resourcesPath;
        possiblePaths.unshift(
            join(resourcesPath, 'app.asar.unpacked', '.vercel', 'output', 'functions', '__server.func', 'index.mjs'),
            join(resourcesPath, '.vercel', 'output', 'functions', '__server.func', 'index.mjs')
        );
    }
    
    for (const path of possiblePaths) {
        if (existsSync(path)) {
            console.log(`Found Nitro server: ${path}`);
            return { path, dir: dirname(path) };
        }
    }
    
    throw new Error('Could not find Nitro server. Checked: ' + possiblePaths.join(', '));
}

// Find static assets directory
function findStaticDir(appRoot) {
    const possiblePaths = [
        join(appRoot, '.vercel', 'output', 'static'),
    ];
    
    if (app.isPackaged) {
        const resourcesPath = process.resourcesPath;
        possiblePaths.unshift(
            join(resourcesPath, 'app.asar.unpacked', '.vercel', 'output', 'static'),
        );
    }
    
    for (const path of possiblePaths) {
        if (existsSync(path)) {
            console.log(`Found static directory: ${path}`);
            return path;
        }
    }
    
    return null;
}

export async function startServer() {
    try {
        console.log("Starting Nitro SSR server...");
        
        // Determine app root
        const appRoot = app.isPackaged 
            ? process.resourcesPath
            : join(__dirname, "..");
        
        console.log("App root:", appRoot);
        console.log("Is packaged:", app.isPackaged);
        console.log("Resources path:", process.resourcesPath);
        
        // Find and import the Nitro server
        const { path: nitroServerPath, dir: nitroDir } = findNitroServer(appRoot);
        const staticDir = findStaticDir(appRoot);
        
        // Set environment variables for Nitro
        process.env.NITRO_PORT = SERVER_PORT.toString();
        process.env.NITRO_HOST = 'localhost';
        process.env.NODE_ENV = 'production';
        
        // Set the Nitro app root so it can find its chunks
        process.env.NITRO_APP_ROOT_DIR = nitroDir;
        
        // Import the Nitro handler
        // Convert path to file:// URL for ESM import (handles Windows paths correctly)
        const { pathToFileURL } = await import('url');
        const nitroServerUrl = pathToFileURL(nitroServerPath).href;
        
        console.log(`Importing from: ${nitroServerUrl}`);
        
        const nitroModule = await import(nitroServerUrl);
        nitroHandler = nitroModule.default || nitroModule;
        
        console.log(`Nitro handler loaded, creating HTTP server...`);
        
        // Create HTTP server that wraps the Nitro handler
        httpServer = createServer(async (req, res) => {
            try {
                // Check if this is a static asset request
                if (staticDir && req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp|json)$/)) {
                    const filePath = join(staticDir, req.url);
                    if (existsSync(filePath)) {
                        const content = readFileSync(filePath);
                        const ext = req.url.split('.').pop();
                        const contentTypes = {
                            'js': 'application/javascript',
                            'css': 'text/css',
                            'png': 'image/png',
                            'jpg': 'image/jpeg',
                            'jpeg': 'image/jpeg',
                            'gif': 'image/gif',
                            'svg': 'image/svg+xml',
                            'ico': 'image/x-icon',
                            'woff': 'font/woff',
                            'woff2': 'font/woff2',
                            'ttf': 'font/ttf',
                            'webp': 'image/webp',
                            'json': 'application/json'
                        };
                        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
                        res.end(content);
                        return;
                    }
                }
                
                // Convert Node.js request to Fetch API Request for Nitro handler
                const protocol = req.socket.encrypted ? 'https' : 'http';
                const host = req.headers.host || 'localhost';
                const url = `${protocol}://${host}${req.url}`;
                
                // Build headers for Fetch Request
                const headers = new Headers();
                Object.entries(req.headers).forEach(([key, value]) => {
                    if (value) {
                        const headerValue = Array.isArray(value) ? value[0] : value;
                        headers.set(key, headerValue);
                    }
                });
                
                // Collect request body for POST/PUT/PATCH
                let body = undefined;
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    body = await new Promise((resolve, reject) => {
                        const chunks = [];
                        req.on('data', chunk => chunks.push(chunk));
                        req.on('end', () => resolve(Buffer.concat(chunks)));
                        req.on('error', reject);
                    });
                }
                
                // Create Fetch API Request
                const fetchRequest = new Request(url, {
                    method: req.method,
                    headers: headers,
                    body: body,
                    duplex: 'half'
                });
                
                // Call Nitro handler with Fetch Request
                let fetchResponse;
                if (typeof nitroHandler?.fetch === 'function') {
                    fetchResponse = await nitroHandler.fetch(fetchRequest, {});
                } else if (typeof nitroHandler === 'function') {
                    // Fallback if handler is the fetch function itself
                    fetchResponse = await nitroHandler(fetchRequest, {});
                } else {
                    res.writeHead(500);
                    res.end('Server handler not available');
                    return;
                }
                
                // Convert Fetch Response back to Node.js response
                res.statusCode = fetchResponse.status;
                fetchResponse.headers.forEach((value, key) => {
                    res.setHeader(key, value);
                });
                
                // Stream response body
                if (fetchResponse.body) {
                    const reader = fetchResponse.body.getReader();
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            res.write(value);
                        }
                    } finally {
                        reader.releaseLock();
                    }
                }
                res.end();
                
            } catch (error) {
                console.error('Request error:', error);
                if (!res.headersSent) {
                    res.writeHead(500);
                }
                res.end('Internal Server Error');
            }
        });
        
        // Start listening
        return new Promise((resolve, reject) => {
            httpServer.listen(SERVER_PORT, 'localhost', () => {
                console.log(`Server running at ${SERVER_URL}`);
                resolve({ url: SERVER_URL, server: httpServer });
            });
            
            httpServer.on('error', (err) => {
                console.error('Server error:', err);
                reject(err);
            });
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        throw error;
    }
}

export async function stopServer() {
    if (httpServer) {
        console.log("Stopping server...");
        
        return new Promise((resolve) => {
            httpServer.close(() => {
                console.log("Server stopped");
                httpServer = null;
                nitroHandler = null;
                resolve();
            });
        });
    }
    return Promise.resolve();
}

export function getServerUrl() {
    return SERVER_URL;
}
