import { useEffect, useState, useRef } from "react";
import { STR } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const LINES_FA = [
  "شکستن پروتکل‌های امنیتی…",
  "اسکن پورت‌های شبکه…",
  "استخراج ماتریس IP…",
  "رمزگشایی لایه‌های DNS…",
  "نفوذ کامل شد.",
];

const LINES_EN = [
  "Breaching security protocols...",
  "Scanning network ports...",
  "Extracting IP matrix...",
  "Decrypting DNS layers...",
  "Breach completed.",
];

export function BootScreen() {
  const lang = useApp((s) => s.lang);
  const adapters = useApp((s) => s.adapters);
  const iface = useApp((s) => s.iface);
  const setIface = useApp((s) => s.setIface);
  const addCustomAdapter = useApp((s) => s.addCustomAdapter);
  const refreshAdapters = useApp((s) => s.refreshAdapters);
  const setBootDone = useApp((s) => s.setBootDone);
  const setLang = useApp((s) => s.setLang);
  const t = STR[lang];

  const [pct, setPct] = useState(0);
  const [line, setLine] = useState(0);
  const [phase, setPhase] = useState<"scan" | "iface">("scan");
  const [custom, setCustom] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (phase !== "scan") return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(100, ((now - start) / 1100) * 100);
      setPct(p);
      setLine(Math.min(4, Math.floor(p / 20)));
      if (p < 100) raf = requestAnimationFrame(tick);
      else setPhase("iface");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Refresh network interfaces when reaching the interface selection phase
  // Only run once using hasRefreshed ref to prevent infinite loop
  useEffect(() => {
    if (phase === "iface" && !hasRefreshed.current) {
      hasRefreshed.current = true;
      setIsRefreshing(true);
      refreshAdapters()
        .then((success) => {
          if (success) {
            console.log("[BootScreen] Network interfaces refreshed successfully");
          } else {
            console.warn("[BootScreen] Failed to refresh network interfaces, using defaults");
          }
        })
        .catch((error) => {
          console.error("[BootScreen] Error refreshing adapters:", error);
        })
        .finally(() => {
          setIsRefreshing(false);
        });
    }
  }, [phase, refreshAdapters]);

  const lines = lang === "fa" ? LINES_FA : LINES_EN;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10" dir={lang === "fa" ? "rtl" : "ltr"}>
      <div className="hud-scan absolute inset-0" />
      <div className="relative z-10 w-full max-w-lg stagger-in">
        <p className="font-display text-xs tracking-[0.35em] text-primary">{t.bootTitle}</p>
        <h1 className="mt-3 font-display text-4xl tracking-[0.28em] text-fg sm:text-5xl">{t.brand}</h1>
        <p className="mt-2 text-sm text-muted">{t.subtitle}</p>

        {phase === "scan" ? (
          <div className="mt-8 space-y-4">
            <Progress value={pct} />
            <p className="font-mono text-sm text-primary tabular-nums">
              {Math.round(pct)}% — {lines[line]}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setPhase("iface")}>
              {t.bootSkip}
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="font-mono text-sm text-primary">
              {isRefreshing ? (lang === "fa" ? "در حال شناسایی رابط‌های شبکه..." : "Detecting network interfaces...") : t.scanningIfaces}
            </p>
            <p className="text-sm text-muted">{t.selectIface}</p>
            <div className="grid gap-2">
              {adapters.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => setIface(a.name)}
                  className={`flex min-h-11 items-center justify-between rounded-md border px-3 text-start transition-[border-color,background-color] duration-150 ${
                    iface === a.name
                      ? "border-primary bg-primary/10 text-fg"
                      : "border-border bg-elevated text-fg hover:border-primary/40"
                  }`}
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {a.admin} · {a.state}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={t.customIface}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomAdapter(custom);
                }}
              />
              <Button variant="secondary" onClick={() => addCustomAdapter(custom)}>
                +
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setLang(lang === "fa" ? "en" : "fa")}>
                {t.lang}
              </Button>
              <Button onClick={setBootDone}>{t.continue}</Button>
            </div>
            <p className="text-xs text-muted">{t.createdBy}</p>
          </div>
        )}
      </div>
    </div>
  );
}
