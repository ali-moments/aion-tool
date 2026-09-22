import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ADAPTERS } from "@/lib/dns-providers";
import type { Lang } from "@/lib/i18n";
import { nowStamp } from "@/lib/utils";

export type ViewId = "dns" | "ops" | "ping" | "race" | "kit";

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
  bootDone: boolean;
  iface: string;
  adapters: Adapter[];
  dns: DnsState;
  busy: boolean;
  lastOp: string;
  logs: LogLine[];
  logSeq: number;
  setLang: (lang: Lang) => void;
  setView: (view: ViewId) => void;
  setBootDone: () => void;
  setIface: (name: string) => void;
  setBusy: (busy: boolean) => void;
  setDns: (dns: DnsState) => void;
  setAdapterAdmin: (name: string, admin: Adapter["admin"]) => void;
  addCustomAdapter: (name: string) => void;
  refreshAdapters: () => Promise<boolean>;
  log: (text: string, kind?: LogLine["kind"]) => void;
  clearLogs: () => void;
  setLastOp: (op: string) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      lang: "fa",
      view: "dns",
      bootDone: false,
      iface: "Ethernet",
      adapters: DEFAULT_ADAPTERS,
      dns: { source: "dhcp" },
      busy: false,
      lastOp: "",
      logs: [],
      logSeq: 0,
      setLang: (lang) => set({ lang }),
      setView: (view) => set({ view }),
      setBootDone: () => set({ bootDone: true }),
      setIface: (iface) => set({ iface }),
      setBusy: (busy) => set({ busy }),
      setDns: (dns) => set({ dns }),
      setLastOp: (lastOp) => set({ lastOp }),
      setAdapterAdmin: (name, admin) =>
        set({
          adapters: get().adapters.map((a) => (a.name === name ? { ...a, admin } : a)),
        }),
      addCustomAdapter: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const exists = get().adapters.some((a) => a.name === trimmed);
        if (exists) {
          set({ iface: trimmed });
          return;
        }
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
          return false;
        }

        try {
          const result = await window.electronAPI.getNetworkInterfaces();
          
          if (result.success && result.adapters && result.adapters.length > 0) {
            const currentIface = get().iface;
            const newAdapters = result.adapters;
            
            // Check if current interface still exists
            const ifaceExists = newAdapters.some((a) => a.name === currentIface);
            
            // If current interface doesn't exist, select the first connected adapter
            const newIface = ifaceExists 
              ? currentIface 
              : (newAdapters.find((a) => a.state === "Connected")?.name || newAdapters[0]?.name || "Ethernet");
            
            set({
              adapters: newAdapters,
              iface: newIface,
            });
            
            console.log(`[Store] Refreshed ${newAdapters.length} network interfaces`);
            return true;
          } else {
            console.error("[Store] Failed to fetch network interfaces:", result.error);
            return false;
          }
        } catch (error) {
          console.error("[Store] Error refreshing adapters:", error);
          return false;
        }
      },
      log: (text, kind = "info") => {
        const id = get().logSeq + 1;
        const line: LogLine = { id, time: nowStamp(), text, kind };
        const logs = [...get().logs, line].slice(-200);
        set({ logSeq: id, logs });
      },
      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: "aiotool-v1",
      partialize: (s) => ({
        lang: s.lang,
        iface: s.iface,
        adapters: s.adapters,
        dns: s.dns,
        bootDone: s.bootDone,
      }),
    },
  ),
);
