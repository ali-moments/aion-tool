import { app, BrowserWindow, ipcMain } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { startServer, stopServer, getServerUrl } from "./server.js";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;

// IPC Handlers for command execution and network interface detection

/**
 * Execute multiple PowerShell commands in a batch for better performance
 * @param {string[]} commands - Array of commands to execute
 * @returns {Promise<{success: boolean, results?: Array, error?: string}>}
 */
ipcMain.handle("execute-batch-commands", async (event, commands) => {
    // Security: Validate all commands are from allowed list
    const allowedPrefixes = ['netsh', 'ipconfig', 'ping'];
    
    for (const command of commands) {
        const cmdLower = command.trim().toLowerCase();
        if (!allowedPrefixes.some(prefix => cmdLower.startsWith(prefix))) {
            console.error(`[IPC] Blocked unauthorized command in batch: ${command}`);
            return {
                success: false,
                error: `Command not permitted for security reasons: ${command}`
            };
        }
    }

    try {
        console.log(`[IPC] Executing batch of ${commands.length} commands`);
        
        // Create a PowerShell script that executes all commands
        const script = commands.join(' && ');
        
        const { stdout, stderr } = await execAsync(script, {
            windowsHide: true,
            timeout: 15000, // Reduced timeout for batch execution
        });

        if (stderr && stderr.trim()) {
            console.warn(`[IPC] Batch stderr: ${stderr}`);
        }

        console.log(`[IPC] Batch commands completed successfully`);
        return {
            success: true,
            output: stdout,
            error: stderr || undefined
        };
    } catch (error) {
        console.error(`[IPC] Batch commands failed:`, error);
        return {
            success: false,
            error: error.message,
            output: error.stdout || undefined
        };
    }
});

/**
 * Execute a PowerShell command with admin privileges
 * @param {string} command - The command to execute
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
 */
ipcMain.handle("execute-command", async (event, command) => {
    // Security: Validate command is from allowed list
    const allowedPrefixes = ['netsh', 'ipconfig', 'ping'];
    const cmdLower = command.trim().toLowerCase();

    if (!allowedPrefixes.some(prefix => cmdLower.startsWith(prefix))) {
        console.error(`[IPC] Blocked unauthorized command: ${command}`);
        return {
            success: false,
            error: "Command not permitted for security reasons"
        };
    }

    try {
        console.log(`[IPC] Executing command: ${command}`);

        const { stdout, stderr } = await execAsync(command, {
            windowsHide: true,
            timeout: 30000, // 30 second timeout
        });

        if (stderr && stderr.trim()) {
            console.warn(`[IPC] Command stderr: ${stderr}`);
        }

        console.log(`[IPC] Command completed successfully`);
        return {
            success: true,
            output: stdout,
            error: stderr || undefined
        };
    } catch (error) {
        console.error(`[IPC] Command failed:`, error);
        return {
            success: false,
            error: error.message,
            output: error.stdout || undefined
        };
    }
});

/**
 * Write log entries to the log file
 * @param {Array} logEntries - Array of log entry strings to write
 * @returns {Promise<{success: boolean, error?: string}>}
 */
ipcMain.handle("write-logs", async (event, logEntries) => {
    try {
        const userDataPath = app.getPath('userData');
        const logFilePath = path.join(userDataPath, 'logs', 'aion-tool.log');
        
        // Check file size and rotate if needed
        try {
            const stats = await fs.stat(logFilePath);
            const maxSize = 10 * 1024 * 1024; // 10MB
            
            if (stats.size > maxSize) {
                // Read current log
                const content = await fs.readFile(logFilePath, 'utf-8');
                const lines = content.split('\n');
                
                // Keep only the last 50% of lines
                const keepLines = Math.floor(lines.length * 0.5);
                const truncatedContent = lines.slice(-keepLines).join('\n');
                
                // Write truncated log back
                await fs.writeFile(logFilePath, truncatedContent, 'utf-8');
                
                // Add rotation log entry
                const timestamp = new Date().toISOString();
                const rotationEntry = `[${timestamp}] INFO [LOGGER] Log rotated - size exceeded ${maxSize} bytes, kept ${keepLines} lines\n`;
                await fs.appendFile(logFilePath, rotationEntry);
            }
        } catch (err) {
            // If file doesn't exist, it will be created when we append
            if (err.code !== 'ENOENT') {
                console.error('Log rotation check failed:', err);
            }
        }
        
        // Write the log entries
        const logContent = logEntries.join('');
        await fs.appendFile(logFilePath, logContent, 'utf-8');
        
        return { success: true };
    } catch (error) {
        console.error('Failed to write logs:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Get network interfaces from the system
 * @returns {Promise<{success: boolean, adapters?: Array, error?: string}>}
 */
ipcMain.handle("get-network-interfaces", async (event) => {
    try {
        console.log(`[IPC] Fetching network interfaces...`);

        const command = process.platform === "win32"
            ? "netsh interface show interface"
            : "ip -o link show"; // Linux/Mac fallback

        const { stdout } = await execAsync(command, {
            windowsHide: true,
            timeout: 10000,
        });

        // Parse Windows netsh output
        if (process.platform === "win32") {
            const lines = stdout.split("\n").slice(3); // Skip header lines
            const adapters = [];

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                // Parse format: Admin State    State          Type             Interface Name
                const parts = trimmed.split(/\s{2,}/); // Split by 2+ spaces
                if (parts.length >= 4) {
                    const [adminState, state, type, ...nameParts] = parts;
                    const name = nameParts.join(" ").trim();

                    if (name) {
                        adapters.push({
                            name,
                            admin: adminState.includes("Enabled") ? "Enabled" : "Disabled",
                            state: state.includes("Connected") ? "Connected" : "Disconnected",
                        });
                    }
                }
            }

            console.log(`[IPC] Found ${adapters.length} network interfaces`);
            return { success: true, adapters };
        } else {
            // Basic parsing for Linux/Mac (simplified)
            const lines = stdout.split("\n");
            const adapters = lines
                .filter(line => line.trim())
                .map(line => {
                    const match = line.match(/\d+:\s+([^:]+):/);
                    if (match) {
                        const name = match[1];
                        const isUp = line.includes("UP");
                        return {
                            name,
                            admin: "Enabled",
                            state: isUp ? "Connected" : "Disconnected",
                        };
                    }
                    return null;
                })
                .filter(Boolean);

            console.log(`[IPC] Found ${adapters.length} network interfaces`);
            return { success: true, adapters };
        }
    } catch (error) {
        console.error(`[IPC] Failed to get network interfaces:`, error);
        return {
            success: false,
            error: error.message,
            adapters: []
        };
    }
});

async function createWindow(serverUrl) {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 500,
        minHeight: 500,
        maxWidth: 1920,
        maxHeight: 1200,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            preload: path.join(__dirname, "preload.js"),
        },
        show: false,
        autoHideMenuBar: true,
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        console.log(`Loading application from ${serverUrl}...`);
        await mainWindow.loadURL(serverUrl);
    } catch (err) {
        console.error("Failed to load URL:", err);

        // Show error dialog
        const { dialog } = await import("electron");
        dialog.showErrorBox(
            "Failed to Start",
            `Could not connect to application server at ${serverUrl}\n\nError: ${err.message}`
        );
        app.quit();
    }
}

app.whenReady().then(async () => {
    try {
        // Set up logging directory and path
        const userDataPath = app.getPath('userData');
        const logsDir = path.join(userDataPath, 'logs');
        const logFilePath = path.join(logsDir, 'aion-tool.log');
        
        // Ensure logs directory exists
        try {
            await fs.mkdir(logsDir, { recursive: true });
        } catch (err) {
            console.error('Failed to create logs directory:', err);
        }
        
        // Send log path to renderer process
        ipcMain.handle('get-log-path', () => logFilePath);
        
        // Initial log entry
        const timestamp = new Date().toISOString();
        const startupLog = `[${timestamp}] INFO [STARTUP] Aion Tool application started\n`;
        try {
            await fs.writeFile(logFilePath, startupLog, { flag: 'a' });
        } catch (err) {
            console.error('Failed to write startup log:', err);
        }
        
        const { url } = await startServer();
        await createWindow(url);
    } catch (err) {
        console.error("Failed to start application:", err);

        const { dialog } = await import("electron");
        dialog.showErrorBox(
            "Startup Error",
            `Failed to start the application server.\n\nError: ${err.message}`
        );
        app.quit();
    }

    app.on("activate", async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createWindow(getServerUrl());
        }
    });
});

app.on("window-all-closed", async () => {
    await stopServer();
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", async (event) => {
    event.preventDefault();
    await stopServer();
    app.exit(0);
});
