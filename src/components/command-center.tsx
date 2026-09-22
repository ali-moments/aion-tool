import { useEffect, useState } from "react";
import {
  Gauge,
  Globe,
  Monitor,
  Radar,
  RefreshCw,
  TerminalSquare,
  Wifi,
} from "lucide-react";
import { Toaster } from "sonner";
import { BootScreen } from "@/components/boot-screen";
import { ConsolePanel } from "@/components/console-panel";
import { DnsPanel } from "@/components/dns-panel";
import { KitPanel } from "@/components/kit-panel";
import { OpsPanel } from "@/components/ops-panel";
import { PingPanel } from "@/components/ping-panel";
import { RacePanel } from "@/components/race-panel";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { STR } from "@/lib/i18n";
import { providerById } from "@/lib/dns-providers";
import { useApp, type ViewId } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV: Array<{ id: ViewId; icon: typeof Globe; key: keyof typeof STR.fa }> = [
  { id: "dns", icon: Globe, key: "navDns" },
  { id: "ops", icon: Radar, key: "navOps" },
  { id: "ping", icon: Gauge, key: "navPing" },
  { id: "race", icon: Wifi, key: "navRace" },
  { id: "kit", icon: Monitor, key: "navKit" },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs tabular-nums text-muted">
      {now.toLocaleTimeString("en-GB", { hour12: false })}
    </span>
  );
}

export function CommandCenter() {
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lang = useApp((s) => s.lang);
  const view = useApp((s) => s.view);
  const bootDone = useApp((s) => s.bootDone);
  const iface = useApp((s) => s.iface);
  const busy = useApp((s) => s.busy);
  const dns = useApp((s) => s.dns);
  const adapters = useApp((s) => s.adapters);
  const lastOp = useApp((s) => s.lastOp);
  const setLang = useApp((s) => s.setLang);
  const setView = useApp((s) => s.setView);
  const setIface = useApp((s) => s.setIface);
  const refreshAdapters = useApp((s) => s.refreshAdapters);
  const t = STR[lang];
  const provider = providerById(dns.providerId);

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = useApp.persist.onFinishHydration(finish);
    if (useApp.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  // Refresh network interfaces on mount (after boot screen)
  useEffect(() => {
    if (bootDone && hydrated) {
      refreshAdapters().catch((error) => {
        console.error("[CommandCenter] Failed to refresh adapters on mount:", error);
      });
    }
  }, [bootDone, hydrated, refreshAdapters]);

  const handleRefreshAdapters = async () => {
    setRefreshing(true);
    try {
      const success = await refreshAdapters();
      if (success) {
        console.log("[CommandCenter] Network interfaces refreshed successfully");
      } else {
        console.warn("[CommandCenter] Failed to refresh network interfaces");
      }
    } catch (error) {
      console.error("[CommandCenter] Error refreshing adapters:", error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!hydrated) {
    return <div className="min-h-dvh bg-bg" />;
  }

  if (!bootDone) {
    return (
      <>
        <BootScreen />
        <Toaster theme="dark" position="top-center" />
      </>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative min-h-dvh text-fg" dir={lang === "fa" ? "rtl" : "ltr"}>
        <div className="hud-grid absolute inset-0" />
        <div className="hud-scan absolute inset-0 opacity-40" />

        <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col px-3 pb-24 pt-3 sm:px-5 sm:pb-6 lg:px-8">
          <header className="hud-frame flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/90 px-4 py-3">
            <div className="min-w-0">
              <p className="font-display text-xl tracking-[0.28em] text-primary sm:text-2xl">{t.brand}</p>
              <p className="text-xs text-muted">{t.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-2 rounded-sm border border-border bg-elevated px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-muted">
                <span
                  className={cn(
                    "size-1.5 rounded-full bg-primary",
                    busy && "animate-[pulse-led_1s_ease-in-out_infinite]",
                  )}
                />
                {busy ? t.statusBusy : t.statusReady}
              </span>
              <span className="hidden rounded-sm border border-border bg-elevated px-2.5 py-1 font-mono text-xs uppercase tracking-wider text-muted sm:inline">
                {t.statusAdmin}
              </span>
              <Clock />
              <Button size="sm" variant="outline" onClick={() => setLang(lang === "fa" ? "en" : "fa")}>
                {t.lang}
              </Button>
            </div>
          </header>

          <div className="mt-3 flex flex-col gap-3 lg:flex-row">
            <aside className="hidden w-52 shrink-0 flex-col gap-1 lg:flex">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm transition-[border-color,background-color,color] duration-150",
                    view === item.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted hover:border-border hover:bg-elevated hover:text-fg",
                  )}
                >
                  <item.icon className="size-4" />
                  {t[item.key]}
                </button>
              ))}
              <div className="mt-3 rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-muted">{t.iface}</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleRefreshAdapters}
                        disabled={refreshing || busy}
                        className="flex size-6 items-center justify-center rounded text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Refresh network interfaces"
                      >
                        <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {lang === "fa" ? "بروزرسانی رابط‌ها" : "Refresh Interfaces"}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <select
                  className="mt-2 h-11 w-full rounded-md border border-border bg-elevated px-2 text-sm text-fg"
                  value={iface}
                  onChange={(e) => setIface(e.target.value)}
                >
                  {adapters.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 font-mono text-xs text-muted">
                  {dns.source === "static"
                    ? `${dns.primary}`
                    : t.dhcp}
                </p>
              </div>
            </aside>

            <main className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2 lg:hidden">
                <select
                  className="h-11 min-w-40 flex-1 rounded-md border border-border bg-elevated px-2 text-sm"
                  value={iface}
                  onChange={(e) => setIface(e.target.value)}
                >
                  {adapters.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleRefreshAdapters}
                      disabled={refreshing || busy}
                      className="flex size-11 items-center justify-center rounded-md border border-border bg-elevated text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Refresh network interfaces"
                    >
                      <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {lang === "fa" ? "بروزرسانی رابط‌ها" : "Refresh Interfaces"}
                  </TooltipContent>
                </Tooltip>
              </div>
              {view === "dns" ? <DnsPanel /> : null}
              {view === "ops" ? <OpsPanel /> : null}
              {view === "ping" ? <PingPanel /> : null}
              {view === "race" ? <RacePanel /> : null}
              {view === "kit" ? <KitPanel /> : null}
            </main>

            <aside className="hidden w-[22rem] shrink-0 lg:block">
              <ConsolePanel />
              <p className="mt-3 px-1 text-xs text-muted">{t.createdBy}</p>
            </aside>
          </div>

          <div className="mt-3 lg:hidden">
            <ConsolePanel />
          </div>

          <footer className="mt-4 hidden items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted sm:flex">
            <span className="inline-flex items-center gap-2">
              <TerminalSquare className="size-3.5" />
              {t.previewMode} · {t.liveLink} {t.online}
            </span>
            <span className="truncate">
              {t.lastOp}: {lastOp || t.none}
              {provider ? ` · ${lang === "fa" ? provider.nameFa : provider.name}` : ""}
            </span>
          </footer>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-2 py-2 lg:hidden">
          <div className="mx-auto flex max-w-lg justify-between">
            {NAV.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setView(item.id)}
                    className={cn(
                      "flex size-11 flex-col items-center justify-center rounded-md",
                      view === item.id ? "text-primary" : "text-muted",
                    )}
                    aria-label={t[item.key]}
                  >
                    <item.icon className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t[item.key]}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </nav>
        <Toaster theme="dark" position="top-center" />
      </div>
    </TooltipProvider>
  );
}
