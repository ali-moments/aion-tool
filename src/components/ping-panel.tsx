import { useState } from "react";
import { toast } from "sonner";
import { STR } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { formatMs } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = { n: number; ms: number | null };

async function probe(host: string, timeoutMs = 2500): Promise<number | null> {
  const target = host.includes("://") ? host : `https://${host}`;
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    await fetch(target, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
    return Math.round(performance.now() - start);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function PingPanel() {
  const lang = useApp((s) => s.lang);
  const busy = useApp((s) => s.busy);
  const log = useApp((s) => s.log);
  const setBusy = useApp((s) => s.setBusy);
  const t = STR[lang];
  const [host, setHost] = useState("1.1.1.1");
  const [count, setCount] = useState(4);
  const [customCount, setCustomCount] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const sent = rows.length;
  const recv = rows.filter((r) => r.ms != null).length;
  const loss = sent ? Math.round(((sent - recv) / sent) * 100) : 0;
  const avg =
    recv > 0
      ? Math.round(rows.reduce((s, r) => s + (r.ms ?? 0), 0) / recv)
      : null;

  async function run() {
    if (busy) return;
    const finalCount = count;
    if (finalCount < 1 || finalCount > 100) {
      toast.error(lang === "fa" ? "تعداد باید بین ۱ تا ۱۰۰ باشد" : "Count must be between 1 and 100");
      return;
    }
    setBusy(true);
    setRows([]);
    log(
      lang === "fa"
        ? `شروع پینگ ${host} × ${finalCount}`
        : `Initiating ping test to ${host} × ${finalCount}...`,
      "info",
    );
    log(`ping ${host} -n ${finalCount}`, "cmd");
    const next: Row[] = [];
    for (let i = 1; i <= finalCount; i++) {
      const ms = await probe(host);
      const row = { n: i, ms };
      next.push(row);
      setRows([...next]);
      log(
        ms == null
          ? `#${i} ${t.probeFail}`
          : `#${i} time=${ms}ms TTL=preview`,
        ms == null ? "err" : "ok",
      );
    }
    setBusy(false);
    toast.success(t.done);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-display text-lg tracking-wide">{t.pingTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.pingNote}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="ping-host">{t.pingHost}</Label>
            <Input
              id="ping-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="4.2.2.4"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t.pingCount}</Label>
            <div className="flex gap-2">
              {[4, 10, 20].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={count === n && !customCount ? "default" : "secondary"}
                  onClick={() => {
                    setCount(n);
                    setCustomCount("");
                  }}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-count">{lang === "fa" ? "سفارشی" : "Custom"}</Label>
            <Input
              id="custom-count"
              type="number"
              min="1"
              max="100"
              value={customCount}
              onChange={(e) => {
                setCustomCount(e.target.value);
                const num = parseInt(e.target.value, 10);
                if (num >= 1 && num <= 100) {
                  setCount(num);
                }
              }}
              placeholder="1-100"
              className="w-20"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["1.1.1.1", "8.8.8.8", "4.2.2.4", "google.com", "cloudflare.com"].map((h) => (
            <Button key={h} size="sm" variant="outline" onClick={() => setHost(h)}>
              {h}
            </Button>
          ))}
        </div>
        <Button className="mt-4" disabled={busy} onClick={run}>
          {t.pingStart}
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t.pingSent, String(sent)],
          [t.pingRecv, String(recv)],
          [t.pingLoss, `${loss}%`],
          [t.pingAvg, formatMs(avg)],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{k}</p>
            <p className="mt-1 font-mono text-xl tabular-nums text-primary">{v}</p>
          </Card>
        ))}
      </div>

      {rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="max-h-[400px] divide-y divide-border overflow-y-auto font-mono text-sm">
            {rows.map((r) => (
              <div key={r.n} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted">#{r.n}</span>
                <span className={r.ms == null ? "text-danger" : "text-primary"}>
                  {r.ms == null ? t.probeFail : formatMs(r.ms)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
