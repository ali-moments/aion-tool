import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { DNS_PROVIDERS, type DnsTag } from "@/lib/dns-providers";
import { STR } from "@/lib/i18n";
import { isIpv4, setDnsSteps } from "@/lib/protocols";
import { runProtocol } from "@/lib/runner";
import { useApp } from "@/lib/store";
import { copyText, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ITEMS_PER_PAGE = 6;

const FILTERS: Array<{ id: "all" | DnsTag; key: keyof typeof STR.fa }> = [
  { id: "all", key: "all" },
  { id: "iran", key: "iran" },
  { id: "global", key: "global" },
  { id: "gaming", key: "gaming" },
  { id: "privacy", key: "privacy" },
  { id: "ads", key: "ads" },
  { id: "family", key: "family" },
];

export function DnsPanel() {
  const lang = useApp((s) => s.lang);
  const iface = useApp((s) => s.iface);
  const dns = useApp((s) => s.dns);
  const busy = useApp((s) => s.busy);
  const setDns = useApp((s) => s.setDns);
  const t = STR[lang];
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const list = useMemo(
    () => DNS_PROVIDERS.filter((p) => filter === "all" || p.tags.includes(filter)),
    [filter],
  );

  // Reset to page 1 when filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [filter]);

  // Pagination calculations
  const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedList = list.slice(startIndex, endIndex);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  async function inject(name: string, a: string, b: string, providerId?: string) {
    const ok = await runProtocol(
      setDnsSteps(iface, a, b),
      lang === "fa" ? `DNS اعمال شد: ${a}, ${b}` : `DNS injection complete: ${a}, ${b}`,
    );
    if (ok) {
      setDns({ source: "static", primary: a, secondary: b, providerId });
      toast.success(lang === "fa" ? `${name} روی ${iface}` : `${name} on ${iface}`);
    }
  }

  async function applyCustom() {
    if (!isIpv4(primary) || !isIpv4(secondary)) {
      toast.error(t.invalidIp);
      return;
    }
    await inject(t.customDns, primary.trim(), secondary.trim());
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-9 rounded-sm border px-3 text-xs font-medium uppercase tracking-wider transition-[border-color,background-color,color] duration-150",
              filter === f.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-elevated text-muted hover:text-fg",
            )}
          >
            {t[f.key]}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted">{t.noProviders}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedList.map((p) => {
              const active = dns.providerId === p.id && dns.source === "static";
              const label = lang === "fa" ? p.nameFa : p.name;
              return (
                <Card
                  key={p.id}
                  className={cn("flex flex-col p-4", active && "border-primary bg-primary/5")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg tracking-wide">{label}</h3>
                      <p className="mt-1 text-xs text-muted">{lang === "fa" ? p.blurbFa : p.blurb}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {p.original ? <Badge>{t.original}</Badge> : null}
                      {active ? <Badge variant="default">{t.applied}</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 font-mono text-sm text-primary">
                    <span>
                      {p.primary}
                      <span className="text-muted"> / </span>
                      {p.secondary}
                    </span>
                    <button
                      type="button"
                      className="text-muted hover:text-fg"
                      onClick={async () => {
                        const ok = await copyText(`${p.primary} ${p.secondary}`);
                        if (ok) toast.success(t.kitCopied);
                      }}
                      aria-label="copy"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                  <Button
                    className="mt-4 w-full"
                    disabled={busy}
                    variant={active ? "secondary" : "default"}
                    onClick={() => inject(label, p.primary, p.secondary, p.id)}
                  >
                    {active ? <Check className="size-4" /> : null}
                    {busy ? t.injecting : t.inject}
                  </Button>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!canGoPrevious}
                className="gap-2"
              >
                <ChevronLeft className="size-4" />
                {lang === "fa" ? "قبلی" : "Previous"}
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">
                  {lang === "fa" ? (
                    <>
                      صفحه {currentPage} از {totalPages}
                    </>
                  ) : (
                    <>
                      Page {currentPage} of {totalPages}
                    </>
                  )}
                </span>
                <span className="text-xs text-muted/70">
                  ({list.length} {lang === "fa" ? "مورد" : "items"})
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!canGoNext}
                className="gap-2"
              >
                {lang === "fa" ? "بعدی" : "Next"}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Card className="p-4">
        <h3 className="font-display tracking-wide">{t.customDns}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dns-a">{t.primary}</Label>
            <Input
              id="dns-a"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder="1.1.1.1"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dns-b">{t.secondary}</Label>
            <Input
              id="dns-b"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              placeholder="1.0.0.1"
              inputMode="decimal"
            />
          </div>
        </div>
        <Button className="mt-4" disabled={busy} onClick={applyCustom}>
          {t.applyCustom}
        </Button>
      </Card>
    </div>
  );
}
