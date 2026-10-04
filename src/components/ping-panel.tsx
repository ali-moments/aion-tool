import { useState } from "react";
import { toast } from "sonner";
import { STR } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { formatMs } from "@/lib/utils";
import { sanitizeHost } from "@/lib/protocols";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger";

type Row = { n: number; ms: number | null };

interface PingResult {
  success: boolean;
  times: number[];
  packetsLost: number;
  avgTime: number;
  error?: string;
}

async function executePing(host: string, count: number): Promise<PingResult> {
  logger.info('PING', `Starting ping test to ${host} with ${count} packets`);
  
  // Sanitize host input to prevent command injection
  const safeHost = sanitizeHost(host);
  if (!safeHost) {
    logger.error('PING', 'Invalid host provided', { originalHost: host });
    return {
      success: false,
      times: [],
      packetsLost: count,
      avgTime: 0,
      error: "Invalid host format"
    };
  }
  
  // Use actual system ping command through Electron IPC
  if (typeof window !== "undefined" && window.electronAPI?.executeCommand) {
    try {
      const command = `ping ${safeHost} -n ${count}`;
      logger.debug('PING', `Executing ping command: ${command}`);
      const result = await window.electronAPI.executeCommand(command);
      
      if (!result.success || !result.output) {
        logger.error('PING', 'Ping command failed', { 
          host, 
          count, 
          error: result.error 
        });
        return {
          success: false,
          times: [],
          packetsLost: count,
          avgTime: 0,
          error: result.error || "Ping command failed"
        };
      }

      // Parse Windows ping output
      const output = result.output;
      const times: number[] = [];
      let packetsLost = 0;

      logger.debug('PING', 'Parsing ping output', { outputLength: output.length });

      // Extract ping times using regex
      const timeRegex = /time[<=](\d+)ms/gi;
      let match;
      while ((match = timeRegex.exec(output)) !== null) {
        times.push(parseInt(match[1], 10));
      }

      // Extract packet loss from statistics
      const lossMatch = output.match(/\((\d+)% loss\)/i);
      if (lossMatch) {
        const lossPercent = parseInt(lossMatch[1], 10);
        packetsLost = Math.round((count * lossPercent) / 100);
      } else {
        // If no explicit loss info, calculate from successful responses
        packetsLost = count - times.length;
      }

      const avgTime = times.length > 0 
        ? Math.round(times.reduce((sum, time) => sum + time, 0) / times.length)
        : 0;

      logger.info('PING', 'Ping test completed successfully', {
        host,
        totalPackets: count,
        successfulPackets: times.length,
        packetsLost,
        avgTime,
        minTime: Math.min(...times),
        maxTime: Math.max(...times)
      });

      return {
        success: true,
        times,
        packetsLost,
        avgTime
      };
    } catch (error) {
      logger.error('PING', 'Ping execution failed', { host, count, error });
      return {
        success: false,
        times: [],
        packetsLost: count,
        avgTime: 0,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  // Fallback to HTTP probe for web/development mode
  logger.warn('PING', 'Electron API not available, using fallback HTTP probe');
  return await fallbackHttpProbe(host, count);
}

async function fallbackHttpProbe(host: string, count: number): Promise<PingResult> {
  logger.info('PING', `Starting HTTP probe fallback to ${host} with ${count} requests`);
  const times: number[] = [];
  const target = host.includes("://") ? host : `https://${host}`;

  for (let i = 0; i < count; i++) {
    const start = performance.now();
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2500);
    
    try {
      await fetch(target, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
      times.push(Math.round(performance.now() - start));
    } catch {
      // Failed ping
      logger.debug('PING', `HTTP probe ${i + 1} failed to ${target}`);
    } finally {
      window.clearTimeout(timer);
    }
  }

  const packetsLost = count - times.length;
  const avgTime = times.length > 0 
    ? Math.round(times.reduce((sum, time) => sum + time, 0) / times.length)
    : 0;

  logger.info('PING', 'HTTP probe fallback completed', {
    host,
    totalRequests: count,
    successfulRequests: times.length,
    requestsLost: packetsLost,
    avgTime
  });

  return {
    success: true,
    times,
    packetsLost,
    avgTime
  };
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
    
    // Sanitize host input
    const safeHost = sanitizeHost(host);
    if (!safeHost) {
      toast.error(lang === "fa" ? "آدرس نامعتبر است" : "Invalid host address");
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
    log(`ping ${safeHost} -n ${finalCount}`, "cmd");
    
    try {
      const result = await executePing(safeHost, finalCount);
      
      if (!result.success && result.error) {
        log(result.error, "err");
        toast.error(lang === "fa" ? "خطا در پینگ" : "Ping failed");
        setBusy(false);
        return;
      }

      // Display results in real-time style for better UX
      const newRows: Row[] = [];
      
      // Add successful pings
      for (let i = 0; i < result.times.length; i++) {
        newRows.push({ n: i + 1, ms: result.times[i] });
        setRows([...newRows]);
        log(
          `#${i + 1} time=${result.times[i]}ms TTL=64`,
          "ok",
        );
      }
      
      // Add failed pings
      for (let i = result.times.length; i < finalCount; i++) {
        newRows.push({ n: i + 1, ms: null });
        setRows([...newRows]);
        log(`#${i + 1} ${t.probeFail}`, "err");
      }

      // Log summary
      const recv = result.times.length;
      const loss = Math.round(((finalCount - recv) / finalCount) * 100);
      log(
        lang === "fa" 
          ? `خلاصه: ${recv}/${finalCount} دریافت شد، ${loss}% از دست رفت، میانگین: ${result.avgTime}ms`
          : `Summary: ${recv}/${finalCount} received, ${loss}% loss, avg: ${result.avgTime}ms`,
        "info"
      );

    } catch (error) {
      log(lang === "fa" ? "خطا در اجرای پینگ" : "Ping execution error", "err");
      console.error("Ping error:", error);
    }
    
    setBusy(false);
    toast.success(t.done);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-display text-lg tracking-wide">{t.pingTitle}</h2>
        <p className="mt-1 text-sm text-muted">
          {t.pingNote}
          {typeof window !== "undefined" && !window.electronAPI?.executeCommand && (
            <span className="ml-2 text-warning">
              {lang === "fa" ? "(حالت HTTP برای مرورگر)" : "(HTTP mode for browser)"}
            </span>
          )}
        </p>
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
