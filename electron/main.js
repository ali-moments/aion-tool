import { app, BrowserWindow, ipcMain } from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import path from "path";
import { startServer, stopServer, getServerUrl } from "./server.js";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;

// IPC Handlers for command execution and network interface detection

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
        minWidth: 900,
        minHeight: 600,
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
