import { useState } from "react";
import { toast } from "sonner";
import { Power, RefreshCcw, RotateCcw, Trash2, Unplug } from "lucide-react";
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
  const dns = useApp((s) => s.dns);
  const log = useApp((s) => s.log);
  const setDns = useApp((s) => s.setDns);
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
      toast.success(t.opsReset);
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
    const ok = await runProtocol(flushOnlySteps(), "ipconfig /flushdns");
    if (ok) toast.success(t.opsFlush);
  }

  async function toggle(enable: boolean) {
    const ok = await runProtocol(toggleAdapterSteps(iface, enable));
    if (ok) {
      setAdapterAdmin(iface, enable ? "Enabled" : "Disabled");
      toast.success(enable ? t.opsEnable : t.opsDisable);
    }
  }

  function showCurrent() {
    log(currentDnsCmd(iface), "cmd");
    if (dns.source === "dhcp") {
      log(lang === "fa" ? "منبع: DHCP" : "Source: DHCP", "info");
    } else {
      log(`${dns.primary ?? "—"} / ${dns.secondary ?? "—"}`, "ok");
    }
    toast.message(t.current);
  }

  const actions = [
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
