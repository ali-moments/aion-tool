// Preload script for enhanced security
// This runs in the renderer process before web content loads

const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,
    },
    /**
     * Execute a system command (requires admin privileges for network commands)
     * @param {string} command - The command to execute
     * @returns {Promise<{success: boolean, output?: string, error?: string}>}
     */
    executeCommand: (command) => ipcRenderer.invoke("execute-command", command),
    /**
     * Get list of network interfaces from the system
     * @returns {Promise<{success: boolean, adapters?: Array, error?: string}>}
     */
    getNetworkInterfaces: () => ipcRenderer.invoke("get-network-interfaces"),
});
