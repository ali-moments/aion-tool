import { useState } from "react";
import { toast } from "sonner";
import { DNS_PROVIDERS } from "@/lib/dns-providers";
import { STR } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { cn, formatMs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Result = { id: string; ms: number | null };

async function probeIp(ip: string): Promise<number | null> {
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 2200);
  try {
    await fetch(`https://${ip}/`, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
    return Math.round(performance.now() - start);
  } catch {
    try {
      await fetch(`http://${ip}/`, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
      return Math.round(performance.now() - start);
    } catch {
      return null;
    }
  } finally {
    window.clearTimeout(timer);
  }
}

export function RacePanel() {
  const lang = useApp((s) => s.lang);
  const busy = useApp((s) => s.busy);
  const setBusy = useApp((s) => s.setBusy);
  const log = useApp((s) => s.log);
  const t = STR[lang];
  const [results, setResults] = useState<Result[]>([]);

  const ranked = [...results].sort((a, b) => {
    if (a.ms == null) return 1;
    if (b.ms == null) return -1;
    return a.ms - b.ms;
  });
  const best = ranked.find((r) => r.ms != null)?.ms ?? 0;

  async function run() {
    if (busy) return;
    setBusy(true);
    setResults([]);
    log(lang === "fa" ? "شروع رقابت DNS…" : "DNS race started…", "info");
    const settled = await Promise.all(
      DNS_PROVIDERS.map(async (p) => {
        const ms = await probeIp(p.primary);
        log(`${p.name} ${p.primary} → ${ms ?? "n/a"}`, ms == null ? "err" : "ok");
        return { id: p.id, ms };
      }),
    );
    setResults(settled);
    setBusy(false);
    const winner = settled
      .filter((r) => r.ms != null)
      .sort((a, b) => (a.ms ?? 9e9) - (b.ms ?? 9e9))[0];
    if (winner) {
      const p = DNS_PROVIDERS.find((x) => x.id === winner.id);
      toast.success(`${t.raceBest}: ${p ? (lang === "fa" ? p.nameFa : p.name) : winner.id}`);
    } else {
      toast.message(t.probeFail);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-display text-lg tracking-wide">{t.raceTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.raceNote}</p>
        <Button className="mt-4" disabled={busy} onClick={run}>
          {t.raceStart}
        </Button>
      </Card>

      {ranked.length > 0 ? (
        <div className="space-y-2">
          {ranked.map((r, i) => {
            const p = DNS_PROVIDERS.find((x) => x.id === r.id);
            if (!p) return null;
            const pct = r.ms && best ? Math.max(8, Math.min(100, (best / r.ms) * 100)) : 0;
            return (
              <Card key={r.id} className={cn("p-3", i === 0 && r.ms != null && "border-primary")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display tracking-wide">
                      {lang === "fa" ? p.nameFa : p.name}
                    </p>
                    <p className="font-mono text-xs text-muted">{p.primary}</p>
                  </div>
                  <p
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      r.ms == null ? "text-danger" : "text-primary",
                    )}
                  >
                    {r.ms == null ? t.probeFail : formatMs(r.ms)}
                  </p>
                </div>
                <Progress className="mt-2" value={pct} />
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
