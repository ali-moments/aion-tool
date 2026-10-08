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
let isQuitting = false; // Track quit state for proper cleanup

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
        
        // Create a PowerShell script that executes all commands sequentially
        // Use ; instead of && so all commands run regardless of individual failures
        const script = commands.join('; ');
        
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
 * Execute a command with streaming output for real-time feedback
 * @param {object} params - Object containing command and channelId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
ipcMain.handle("execute-stream-command", async (event, { command, channelId }) => {
    const { spawn } = await import("child_process");
    
    // Security: Validate command is from allowed list
    const allowedPrefixes = ['ping'];
    const cmdLower = command.trim().toLowerCase();

    if (!allowedPrefixes.some(prefix => cmdLower.startsWith(prefix))) {
        console.error(`[IPC] Blocked unauthorized streaming command: ${command}`);
        return {
            success: false,
            error: "Streaming command not permitted for security reasons"
        };
    }

    try {
        console.log(`[IPC] Executing streaming command: ${command}`);
        
        // Parse command into program and arguments
        const parts = command.trim().split(/\s+/);
        const program = parts[0];
        const args = parts.slice(1);
        
        return new Promise((resolve) => {
            const child = spawn(program, args, {
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            let hasStarted = false;
            
            // Handle stdout data
            child.stdout.on('data', (data) => {
                hasStarted = true;
                const text = data.toString();
                event.sender.send('stream-data', {
                    channelId,
                    data: text,
                    isComplete: false
                });
            });
            
            // Handle stderr data 
            child.stderr.on('data', (data) => {
                hasStarted = true;
                const text = data.toString();
                event.sender.send('stream-data', {
                    channelId,
                    data: text,
                    isComplete: false
                });
            });
            
            // Handle process completion
            child.on('close', (code) => {
                console.log(`[IPC] Streaming command completed with code: ${code}`);
                
                // Send completion signal
                event.sender.send('stream-data', {
                    channelId,
                    data: '',
                    isComplete: true
                });
                
                resolve({
                    success: true
                });
            });
            
            // Handle process errors
            child.on('error', (error) => {
                console.error(`[IPC] Streaming command failed:`, error);
                
                // Send error completion
                event.sender.send('stream-data', {
                    channelId,
                    data: `Error: ${error.message}`,
                    isComplete: true
                });
                
                resolve({
                    success: false,
                    error: error.message
                });
            });
            
            // Set timeout for long-running commands
            setTimeout(() => {
                if (child.killed === false) {
                    child.kill('SIGTERM');
                    event.sender.send('stream-data', {
                        channelId,
                        data: '\nCommand timed out after 60 seconds',
                        isComplete: true
                    });
                }
            }, 60000);
        });
        
    } catch (error) {
        console.error(`[IPC] Streaming command setup failed:`, error);
        return {
            success: false,
            error: error.message
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

        // Parse Windows netsh output with PowerShell JSON for reliability
        if (process.platform === "win32") {
            try {
                // Use PowerShell to get structured JSON output instead of parsing text
                const psCommand = `powershell -Command "Get-NetAdapter | Select-Object Name, InterfaceOperationalStatus, AdminStatus | ConvertTo-Json"`;
                
                const { stdout: psOutput } = await execAsync(psCommand, {
                    windowsHide: true,
                    timeout: 10000,
                });

                // Parse JSON output from PowerShell
                const rawData = JSON.parse(psOutput);
                // Handle both single adapter (object) and multiple adapters (array)
                const adapters = Array.isArray(rawData) ? rawData : [rawData];
                
                const processedAdapters = adapters
                    .filter(adapter => adapter && adapter.Name) // Filter out invalid entries
                    .map(adapter => ({
                        name: adapter.Name,
                        admin: adapter.AdminStatus === "Up" ? "Enabled" : "Disabled", 
                        state: adapter.InterfaceOperationalStatus === "Up" ? "Connected" : "Disconnected",
                    }));

                console.log(`[IPC] Found ${processedAdapters.length} network interfaces via PowerShell`);
                return { success: true, adapters: processedAdapters };
                
            } catch (psError) {
                console.warn("[IPC] PowerShell method failed, falling back to netsh:", psError.message);
                
                // Fallback to original netsh parsing if PowerShell fails
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

                console.log(`[IPC] Found ${adapters.length} network interfaces via fallback netsh`);
                return { success: true, adapters };
            }
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

    // Check if server is ready with retry logic
    const maxRetries = 10;
    const retryDelay = 200; // 200ms between attempts
    let serverReady = false;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(serverUrl);
            if (response.ok || response.status === 200) {
                serverReady = true;
                console.log(`Server ready after ${i + 1} attempts`);
                break;
            }
        } catch (error) {
            // Server not ready yet, continue retrying
        }
        
        if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    if (!serverReady) {
        console.warn("Server not ready after maximum retries, attempting to load anyway...");
    }

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
    // Prevent quit while we cleanup, but only once
    if (!isQuitting) {
        event.preventDefault();
        isQuitting = true;
        
        console.log("Application shutting down, stopping server...");
        await stopServer();
        
        // Now allow the app to quit naturally
        app.quit();
    }
});
