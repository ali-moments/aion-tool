import { toast } from "sonner";
import { Download, FileCode2, Terminal } from "lucide-react";
import { providerById } from "@/lib/dns-providers";
import { STR } from "@/lib/i18n";
import { applyScript, currentDnsCmd } from "@/lib/protocols";
import { useApp } from "@/lib/store";
import { copyText } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const FILES: Array<{
  href: string;
  icon: typeof Download;
  label?: string;
  labelKey?: keyof typeof STR.fa;
  primary?: boolean;
}> = [
  { href: "/AIOT00L-Windows.zip", labelKey: "kitDownload", icon: Download, primary: true },
  { href: "/windows/AIOT00L.exe", label: "AIOT00L.exe", icon: Download, primary: true },
  { href: "/windows/AIOT00L.bat", labelKey: "downloadBat", icon: Terminal },
  { href: "/windows/AIOT00L.ps1", labelKey: "downloadPs1", icon: FileCode2 },
  { href: "/windows/AIOT00L.py", labelKey: "downloadPy", icon: FileCode2 },
];

export function KitPanel() {
  const lang = useApp((s) => s.lang);
  const iface = useApp((s) => s.iface);
  const dns = useApp((s) => s.dns);
  const t = STR[lang];
  const provider = providerById(dns.providerId);
  const dns1 = dns.primary ?? "1.1.1.1";
  const dns2 = dns.secondary ?? "1.0.0.1";
  const script = applyScript(iface, dns1, dns2);

  async function copy(value: string) {
    const ok = await copyText(value);
    toast[ok ? "success" : "error"](ok ? t.kitCopied : t.failed);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-display text-lg tracking-wide">{t.kitTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.kitLead}</p>
        <p className="mt-3 text-xs text-muted">{t.kitSteps}</p>
        <div className="mt-5 grid gap-2">
          {FILES.map((f) => (
            <Button key={f.href} asChild variant={f.primary ? "default" : "secondary"}>
              <a href={f.href} download>
                <f.icon className="size-4" />
                {f.label ?? t[f.labelKey!]}
              </a>
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted">
          {iface}
          {provider ? ` · ${lang === "fa" ? provider.nameFa : provider.name}` : ""}
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-elevated p-3 font-mono text-xs text-primary">
          {script}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => copy(script)}>
            {t.kitCopyApply}
          </Button>
          <Button variant="outline" onClick={() => copy(currentDnsCmd(iface))}>
            {t.kitCopyAll}
          </Button>
        </div>
      </Card>
    </div>
  );
}
