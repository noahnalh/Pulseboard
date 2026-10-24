import type { ReactNode } from "react";
import { cn } from "@/lib/format";

interface PanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}

export function Panel({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClassName,
  flush = false,
}: PanelProps) {
  return (
    <section className={cn("panel flex min-h-0 flex-col overflow-hidden", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? <span className="mt-0.5 text-slate-500">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="panel-title truncate">{title}</h2>
            {subtitle ? (
              <p className="mt-1 truncate text-[11px] leading-4 text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div
        className={cn(
          "min-h-0 flex-1",
          !flush && "px-4 pb-4 sm:px-5",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
