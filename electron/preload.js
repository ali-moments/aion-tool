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
     * Execute multiple commands in a batch for better performance
     * @param {string[]} commands - Array of commands to execute
     * @returns {Promise<{success: boolean, output?: string, error?: string}>}
     */
    executeBatchCommands: (commands) => ipcRenderer.invoke("execute-batch-commands", commands),
    
    /**
     * Get list of network interfaces from the system
     * @returns {Promise<{success: boolean, adapters?: Array, error?: string}>}
     */
    getNetworkInterfaces: () => ipcRenderer.invoke("get-network-interfaces"),
    
    /**
     * Write log entries to the log file
     * @param {string[]} logEntries - Array of log entry strings to write
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    writeLogs: (logEntries) => ipcRenderer.invoke("write-logs", logEntries),
    
    /**
     * Get the log file path
     * @returns {Promise<string>} The full path to the log file
     */
    getLogPath: () => ipcRenderer.invoke("get-log-path"),
});
