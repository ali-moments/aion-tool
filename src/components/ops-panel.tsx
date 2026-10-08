import { useState } from "react";
import { toast } from "sonner";
import { Power, RefreshCcw, RotateCcw, RotateCw, Trash2, Unplug } from "lucide-react";
import { STR } from "@/lib/i18n";
import {
  adapterResetSteps,
  currentDnsCmd,
  flushOnlySteps,
  resetDnsSteps,
  toggleAdapterSteps,
} from "@/lib/protocols";
import { runProtocol } from "@/lib/runner";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function OpsPanel() {
  const lang = useApp((s) => s.lang);
  const iface = useApp((s) => s.iface);
  const adapters = useApp((s) => s.adapters);
  const busy = useApp((s) => s.busy);
  const setBusy = useApp((s) => s.setBusy);
  const dns = useApp((s) => s.dns);
  const log = useApp((s) => s.log);
  const setDns = useApp((s) => s.setDns);
  const syncWithSystem = useApp((s) => s.syncWithSystem);
  const setAdapterAdmin = useApp((s) => s.setAdapterAdmin);
  const t = STR[lang];
  const [confirm, setConfirm] = useState(false);
  const current = adapters.find((a) => a.name === iface);
  const disabled = current?.admin === "Disabled";

  async function resetAdapter() {
    console.log("[OpsPanel] Reset adapter called, closing dialog");
    setConfirm(false);
    
    if (!iface) {
      const msg = lang === "fa" ? "آداپتور انتخاب نشده است" : "No adapter selected";
      log(msg, "err");
      toast.error(msg);
      console.error("[OpsPanel] No interface selected");
      return;
    }
    
    if (disabled) {
      const msg = t.adapterDisabled;
      log(msg, "err");
      toast.error(msg);
      console.error("[OpsPanel] Adapter is disabled:", iface);
      return;
    }
    
    console.log("[OpsPanel] Starting adapter reset for:", iface);
    const steps = adapterResetSteps(iface);
    console.log("[OpsPanel] Reset steps:", steps.length);
    
    const ok = await runProtocol(
      steps,
      lang === "fa" ? "ریست آداپتور و DNS انجام شد." : "Adapter and DNS reset executed.",
    );
    
    console.log("[OpsPanel] Reset completed, success:", ok);
    
    if (ok) {
      // Show success with restart recommendation
      toast.success(t.opsReset);
      
      // Add important warning about potential restart requirement
      setTimeout(() => {
        toast.warning(
          lang === "fa" 
            ? "⚠️ توصیه: برای اطمینان از عملکرد کامل، سیستم را ریستارت کنید"
            : "⚠️ Recommendation: Restart your system for complete functionality",
          { duration: 8000 } // Show longer for important message
        );
      }, 2000);
      
    } else {
      toast.error(lang === "fa" ? "ریست آداپتور ناموفق بود" : "Adapter reset failed");
    }
  }

  async function resetDns() {
    const ok = await runProtocol(
      resetDnsSteps(iface),
      lang === "fa" ? "DNS به DHCP برگشت." : "DNS reset complete.",
    );
    if (ok) {
      setDns({ source: "dhcp" });
      toast.success(t.opsDnsReset);
    }
  }

  async function flush() {
    // Flush DNS cache only (without changing DNS settings)
    const ok = await runProtocol(
      flushOnlySteps(),
      lang === "fa" ? "کش DNS پاک شد." : "DNS cache flushed."
    );
    if (ok) {
      toast.success(t.opsFlush);
    }
  }

  async function toggle(enable: boolean) {
    const ok = await runProtocol(toggleAdapterSteps(iface, enable));
    if (ok) {
      setAdapterAdmin(iface, enable ? "Enabled" : "Disabled");
      toast.success(enable ? t.opsEnable : t.opsDisable);
    }
  }

  async function showCurrent() {
    if (busy) return;
    
    const cmd = currentDnsCmd(iface);
    log(cmd, "cmd");
    
    // Check if we have IPC access to execute commands
    if (!window.electronAPI?.executeCommand) {
      // Fallback to cached state with warning
      log(lang === "fa" ? "⚠️ نمایش حالت کش‌شده (IPC در دسترس نیست)" : "⚠️ Showing cached state (IPC unavailable)", "warn");
      if (dns.source === "dhcp") {
        log(lang === "fa" ? "منبع: DHCP" : "Source: DHCP", "info");
      } else {
        log(`${dns.primary ?? "—"} / ${dns.secondary ?? "—"}`, "ok");
      }
      toast.message(t.current);
      return;
    }
    
    setBusy(true);
    
    try {
      const result = await window.electronAPI.executeCommand(cmd);
      
      if (result.success && result.output) {
        // Parse and display actual system DNS configuration
        const lines = result.output.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length === 0) {
          log(lang === "fa" ? "خروجی خالی دریافت شد" : "Empty output received", "warn");
        } else {
          // Enhanced parsing to show DNS servers more clearly
          let foundDnsServers = false;
          let primaryDns = null;
          let secondaryDns = null;
          
          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed) {
              // Check if this line contains a DNS server IP
              const ipMatch = trimmed.match(/(\d+\.\d+\.\d+\.\d+)/);
              if (ipMatch) {
                const ip = ipMatch[1];
                if (!primaryDns) {
                  primaryDns = ip;
                  log(`${lang === "fa" ? "DNS اصلی" : "Primary DNS"}: ${ip}`, "ok");
                } else if (!secondaryDns) {
                  secondaryDns = ip;
                  log(`${lang === "fa" ? "DNS فرعی" : "Secondary DNS"}: ${ip}`, "ok");
                }
                foundDnsServers = true;
              } else {
                // Log other configuration lines
                log(trimmed, "info");
              }
            }
          });
          
          // If no DNS servers found, might be DHCP
          if (!foundDnsServers) {
            const dhcpLines = lines.filter(line => 
              line.toLowerCase().includes('dhcp') || 
              line.toLowerCase().includes('automatic')
            );
            
            if (dhcpLines.length > 0) {
              log(lang === "fa" ? "DNS از DHCP دریافت می‌شود" : "DNS obtained from DHCP", "info");
            } else {
              log(lang === "fa" ? "هیچ DNS سرور پیدا نشد" : "No DNS servers found", "warn");
            }
          }
        }
        toast.success(t.current);
      } else {
        const errorMsg = result.error || "Failed to read DNS configuration";
        log(errorMsg, "err");
        toast.error(lang === "fa" ? "خواندن تنظیمات DNS ناموفق بود" : "Failed to read DNS configuration");
        
        // Show cached state as fallback
        log(lang === "fa" ? "نمایش حالت کش‌شده:" : "Showing cached state:", "info");
        if (dns.source === "dhcp") {
          log(lang === "fa" ? "منبع: DHCP" : "Source: DHCP", "info");
        } else {
          log(`${dns.primary ?? "—"} / ${dns.secondary ?? "—"}`, "info");
        }
      }
    } catch (error) {
      console.error("Error executing DNS query:", error);
      log(lang === "fa" ? "خطا در اجرای دستور DNS" : "Error executing DNS command", "err");
      toast.error(lang === "fa" ? "خطا در خواندن DNS" : "Error reading DNS");
      
      // Show cached state as fallback on error
      log(lang === "fa" ? "نمایش حالت کش‌شده:" : "Showing cached state:", "info");
      if (dns.source === "dhcp") {
        log(lang === "fa" ? "منبع: DHCP" : "Source: DHCP", "info");
      } else {
        log(`${dns.primary ?? "—"} / ${dns.secondary ?? "—"}`, "info");
      }
    } finally {
      setBusy(false);
    }
  }

  async function syncState() {
    if (busy) return;
    
    setBusy(true);
    log(lang === "fa" ? "همگام‌سازی با وضعیت سیستم..." : "Synchronizing with system state...", "info");
    
    try {
      const success = await syncWithSystem();
      
      if (success) {
        log(lang === "fa" ? "همگام‌سازی موفق" : "Sync successful", "ok");
        toast.success(lang === "fa" ? "وضعیت با سیستم همگام شد" : "State synchronized with system");
      } else {
        log(lang === "fa" ? "همگام‌سازی ناقص" : "Sync partially failed", "warn");
        toast.warning(lang === "fa" ? "همگام‌سازی ناقص انجام شد" : "Sync completed with some issues");
      }
    } catch (error) {
      log(lang === "fa" ? "خطا در همگام‌سازی" : "Sync error", "err");
      toast.error(lang === "fa" ? "خطا در همگام‌سازی" : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const actions = [
    {
      icon: RotateCw,
      title: lang === "fa" ? "همگام‌سازی" : "Sync State",
      hint: lang === "fa" ? "همگام‌سازی با وضعیت واقعی سیستم" : "Synchronize with actual system state",
      onClick: syncState,
      variant: "outline" as const,
    },
    {
      icon: RotateCcw,
      title: t.opsReset,
      hint: t.opsResetHint,
      onClick: () => {
        console.log("[OpsPanel] Reset button clicked, opening confirmation dialog");
        setConfirm(true);
      },
      variant: "danger" as const,
    },
    {
      icon: RefreshCcw,
      title: t.opsDnsReset,
      hint: t.opsDnsResetHint,
      onClick: resetDns,
      variant: "default" as const,
    },
    {
      icon: Trash2,
      title: t.opsFlush,
      hint: t.opsFlushHint,
      onClick: flush,
      variant: "secondary" as const,
    },
    {
      icon: Unplug,
      title: t.opsDisable,
      hint: iface,
      onClick: () => toggle(false),
      variant: "outline" as const,
    },
    {
      icon: Power,
      title: t.opsEnable,
      hint: iface,
      onClick: () => toggle(true),
      variant: "outline" as const,
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted">{t.current}</p>
        <p className="mt-1 font-display text-xl tracking-wide">
          {dns.source === "dhcp" ? t.dhcp : t.static}
        </p>
        <p className="mt-1 font-mono text-sm text-primary">
          {dns.source === "static" ? `${dns.primary} / ${dns.secondary}` : t.dhcp}
        </p>
        <p className="mt-2 text-xs text-muted">
          {iface} · {current?.admin ?? "Enabled"} · {current?.state ?? "Connected"}
        </p>
        <Button className="mt-4" variant="secondary" disabled={busy} onClick={showCurrent}>
          {t.showCurrent}
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <Card key={a.title} className="flex flex-col p-4">
            <div className="flex items-center gap-2 text-primary">
              <a.icon className="size-4" />
              <h3 className="font-display tracking-wide">{a.title}</h3>
            </div>
            <p className="mt-2 flex-1 text-sm text-muted">{a.hint}</p>
            <Button className="mt-4" variant={a.variant} disabled={busy} onClick={a.onClick}>
              {a.title}
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.confirmReset}</DialogTitle>
            <DialogDescription>{t.confirmResetBody}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={resetAdapter}>
              {t.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
