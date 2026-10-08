import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ADAPTERS } from "@/lib/dns-providers";
import { verifyDnsConfiguration } from "@/lib/protocols";
import type { Lang } from "@/lib/i18n";
import { nowStamp } from "@/lib/utils";
import { logger } from "@/lib/logger";

export type ViewId = "dns" | "ops" | "ping" | "race" | "kit";

export type DnsMode = "fast" | "optimize";

export interface Adapter {
  name: string;
  admin: "Enabled" | "Disabled";
  state: "Connected" | "Disconnected";
}

export interface LogLine {
  id: number;
  time: string;
  text: string;
  kind: "info" | "ok" | "err" | "cmd";
}

export interface DnsState {
  source: "dhcp" | "static";
  primary?: string;
  secondary?: string;
  providerId?: string;
}

interface AppState {
  lang: Lang;
  view: ViewId;
  dnsMode: DnsMode;
  bootDone: boolean;
  iface: string;
  adapters: Adapter[];
  dns: DnsState;
  busy: boolean;
  lastOp: string;
  logs: LogLine[];
  logSeq: number;
  consoleVisible: boolean;
  setLang: (lang: Lang) => void;
  setView: (view: ViewId) => void;
  setDnsMode: (mode: DnsMode) => void;
  setBootDone: () => void;
  setIface: (name: string) => void;
  setBusy: (busy: boolean) => void;
  setDns: (dns: DnsState) => void;
  setAdapterAdmin: (name: string, admin: Adapter["admin"]) => void;
  addCustomAdapter: (name: string) => void;
  refreshAdapters: () => Promise<boolean>;
  refreshDnsState: () => Promise<boolean>;
  syncWithSystem: () => Promise<boolean>;
  log: (text: string, kind?: LogLine["kind"]) => void;
  clearLogs: () => void;
  setLastOp: (op: string) => void;
  toggleConsole: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      lang: "fa",
      view: "dns",
      dnsMode: "fast",
      bootDone: false,
      iface: "Ethernet",
      adapters: DEFAULT_ADAPTERS,
      dns: { source: "dhcp" },
      busy: false,
      lastOp: "",
      logs: [],
      logSeq: 0,
      consoleVisible: true,
      setLang: (lang) => set({ lang }),
      setView: (view) => {
        logger.info('STORE', `View changed to: ${view}`);
        set({ view });
      },
      setDnsMode: (dnsMode) => {
        logger.info('STORE', `DNS mode changed to: ${dnsMode}`);
        set({ dnsMode });
      },
      setBootDone: () => {
        logger.info('STORE', 'Application boot completed');
        set({ bootDone: true });
      },
      setIface: (iface) => {
        logger.info('STORE', `Interface changed to: ${iface}`);
        set({ iface });
      },
      setBusy: (busy) => {
        logger.debug('STORE', `Busy state changed to: ${busy}`);
        set({ busy });
      },
      setDns: (dns) => {
        logger.info('STORE', `DNS configuration updated`, dns);
        set({ dns });
      },
      setLastOp: (lastOp) => set({ lastOp }),
      setAdapterAdmin: (name, admin) =>
        set({
          adapters: get().adapters.map((a) => (a.name === name ? { ...a, admin } : a)),
        }),
      addCustomAdapter: (name) => {
        const trimmed = name.trim();
        
        // Basic validation
        if (!trimmed) return;
        
        // Length validation
        if (trimmed.length > 100) {
          logger.warn('STORE', 'Adapter name too long', { name: trimmed, length: trimmed.length });
          return;
        }
        
        // Character validation - allow alphanumeric, spaces, hyphens, underscores, parentheses
        if (!/^[a-zA-Z0-9 \-_()]+$/.test(trimmed)) {
          logger.warn('STORE', 'Invalid characters in adapter name', { name: trimmed });
          return;
        }
        
        const exists = get().adapters.some((a) => a.name === trimmed);
        if (exists) {
          set({ iface: trimmed });
          return;
        }
        
        logger.info('STORE', 'Adding custom adapter', { name: trimmed });
        set({
          iface: trimmed,
          adapters: [
            ...get().adapters,
            { name: trimmed, admin: "Enabled", state: "Connected" },
          ],
        });
      },
      refreshAdapters: async () => {
        // Check if Electron API is available
        if (typeof window === "undefined" || !window.electronAPI?.getNetworkInterfaces) {
          console.warn("[Store] Electron API not available, using default adapters");
          logger.warn('STORE', 'Electron API not available, using default adapters');
          return false;
        }

        try {
          logger.debug('STORE', 'Refreshing network adapters');
          const result = await window.electronAPI.getNetworkInterfaces();
          
          if (result.success && result.adapters && result.adapters.length > 0) {
            const currentIface = get().iface;
            const newAdapters = result.adapters;
            
            // Check if current interface still exists
            const currentAdapter = newAdapters.find((a) => a.name === currentIface);
            const ifaceExists = !!currentAdapter;
            
            let newIface = currentIface;
            
            // Only change interface if current one is completely missing (not just disconnected)
            // This prevents automatic switching when adapters temporarily disconnect
            if (!ifaceExists) {
              logger.warn('STORE', `Current interface '${currentIface}' no longer exists, selecting alternative`);
              
              // Try to find a connected adapter, fallback to first available, then default
              const connectedAdapter = newAdapters.find((a) => a.state === "Connected");
              const enabledAdapter = newAdapters.find((a) => a.admin === "Enabled");
              
              newIface = connectedAdapter?.name || enabledAdapter?.name || newAdapters[0]?.name || "Ethernet";
              
              logger.info('STORE', `Interface switched from '${currentIface}' to '${newIface}'`);
            } else {
              // Log status changes for existing interface without switching
              if (currentAdapter.admin === "Disabled") {
                logger.info('STORE', `Current interface '${currentIface}' is disabled`);
              }
              if (currentAdapter.state === "Disconnected") {
                logger.info('STORE', `Current interface '${currentIface}' is disconnected`);
              }
            }
            
            set({
              adapters: newAdapters,
              iface: newIface,
            });
            
            logger.info('STORE', `Refreshed ${newAdapters.length} network interfaces`, { 
              count: newAdapters.length, 
              selectedInterface: newIface,
              interfaceChanged: newIface !== currentIface
            });
            console.log(`[Store] Refreshed ${newAdapters.length} network interfaces`);
            return true;
          } else {
            logger.error('STORE', 'Failed to fetch network interfaces', { error: result.error });
            console.error("[Store] Failed to fetch network interfaces:", result.error);
            return false;
          }
        } catch (error) {
          logger.error('STORE', 'Error refreshing adapters', { error });
          console.error("[Store] Error refreshing adapters:", error);
          return false;
        }
      },
      refreshDnsState: async () => {
        const { iface, dns, setDns } = get();
        
        // Check if we can get system DNS state
        if (typeof window === "undefined" || !window.electronAPI?.executeCommand) {
          logger.warn('STORE', 'Cannot refresh DNS state - IPC not available');
          return false;
        }

        try {
          logger.debug('STORE', 'Refreshing DNS state from system');
          
          // Use the verification function to get actual DNS state
          const verification = await verifyDnsConfiguration(iface);
          
          if (verification.success && verification.actualDns) {
            const { primary, secondary } = verification.actualDns;
            
            // Check if we found any DNS servers
            if (primary || secondary) {
              // Update state with actual system DNS
              const newDnsState: DnsState = {
                source: "static",
                primary: primary || undefined,
                secondary: secondary || undefined,
                // Try to preserve provider ID if it matches
                providerId: dns.providerId
              };
              
              setDns(newDnsState);
              logger.info('STORE', 'DNS state synchronized with system', { 
                oldState: dns,
                newState: newDnsState 
              });
              return true;
            } else {
              // No static DNS found, assume DHCP
              const newDnsState: DnsState = { source: "dhcp" };
              setDns(newDnsState);
              logger.info('STORE', 'DNS state synchronized to DHCP mode');
              return true;
            }
          } else {
            logger.warn('STORE', 'Failed to verify DNS configuration for sync', {
              error: verification.error
            });
            return false;
          }
        } catch (error) {
          logger.error('STORE', 'Error refreshing DNS state', { error });
          return false;
        }
      },
      syncWithSystem: async () => {
        logger.info('STORE', 'Starting full system synchronization');
        
        const adapterResult = await get().refreshAdapters();
        const dnsResult = await get().refreshDnsState();
        
        const success = adapterResult && dnsResult;
        
        if (success) {
          logger.info('STORE', 'System synchronization completed successfully');
        } else {
          logger.warn('STORE', 'System synchronization partially failed', {
            adapters: adapterResult,
            dns: dnsResult
          });
        }
        
        return success;
      },
      log: (text, kind = "info") => {
        const id = get().logSeq + 1;
        const line: LogLine = { id, time: nowStamp(), text, kind };
        const logs = [...get().logs, line].slice(-200);
        set({ logSeq: id, logs });
      },
      clearLogs: () => set({ logs: [] }),
      toggleConsole: () => set((state) => ({ consoleVisible: !state.consoleVisible })),
    }),
    {
      name: "aion-tool-v1",
      partialize: (s) => ({
        lang: s.lang,
        iface: s.iface,
        dnsMode: s.dnsMode,
        adapters: s.adapters,
        dns: s.dns,
        bootDone: s.bootDone,
        consoleVisible: s.consoleVisible,
      }),
    },
  ),
);
