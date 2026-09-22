import { useEffect, useRef } from "react";
import { STR } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ConsolePanel() {
  const lang = useApp((s) => s.lang);
  const logs = useApp((s) => s.logs);
  const clearLogs = useApp((s) => s.clearLogs);
  const t = STR[lang];
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [logs.length]);

  return (
    <Card className="flex h-full min-h-64 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="font-display text-sm tracking-wider text-muted">{t.console}</p>
        <Button variant="ghost" size="sm" onClick={clearLogs}>
          {t.clearLog}
        </Button>
      </div>
      <ScrollArea className="h-72">
        <div className="space-y-1 p-3 font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-muted">{t.emptyLog}</p>
          ) : (
            logs.map((line) => (
              <div key={line.id} className="flex gap-2">
                <span className="shrink-0 text-muted tabular-nums">{line.time}</span>
                <span
                  className={cn(
                    line.kind === "ok" && "text-primary",
                    line.kind === "err" && "text-danger",
                    line.kind === "cmd" && "text-muted",
                    line.kind === "info" && "text-fg",
                  )}
                >
                  {line.kind === "cmd" ? `> ${line.text}` : line.text}
                </span>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>
    </Card>
  );
}
