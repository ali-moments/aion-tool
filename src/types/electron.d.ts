/**
 * Type definitions for Electron API exposed via preload script
 */

export interface Adapter {
  name: string;
  admin: "Enabled" | "Disabled";
  state: "Connected" | "Disconnected";
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface NetworkInterfacesResult {
  success: boolean;
  adapters?: Adapter[];
  error?: string;
}

export interface LogResult {
  success: boolean;
  error?: string;
}

export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  executeCommand: (command: string) => Promise<CommandResult>;
  executeBatchCommands: (commands: string[]) => Promise<CommandResult>;
  getNetworkInterfaces: () => Promise<NetworkInterfacesResult>;
  writeLogs: (logEntries: string[]) => Promise<LogResult>;
  getLogPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
