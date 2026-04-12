import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  id,
  title,
  subtitle,
  defaultOpen = true,
  children,
  className,
}: CollapsibleSectionProps) {
  const storageKey = `collapsible-section-${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored !== null ? stored === "true" : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(open ? "auto" : 0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(open));
    } catch {}
  }, [open, storageKey]);

  const toggle = () => {
    if (isAnimating) return;
    const el = contentRef.current;
    if (!el) { setOpen(o => !o); return; }

    if (open) {
      // Closing: set explicit height, then animate to 0
      setHeight(el.scrollHeight);
      setIsAnimating(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0);
        });
      });
    } else {
      // Opening: animate from 0 to scrollHeight
      setHeight(el.scrollHeight);
      setIsAnimating(true);
    }
    setOpen(o => !o);
  };

  const handleTransitionEnd = () => {
    setIsAnimating(false);
    if (open) setHeight("auto");
  };

  return (
    <div className={cn("space-y-0", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "w-full flex items-center justify-between gap-3 py-2 group",
          "text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg px-1",
        )}
        aria-expanded={open}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
            {title}
          </span>
          {subtitle && (
            <span className="text-xs text-muted-foreground/70">{subtitle}</span>
          )}
        </div>

        <span className={cn(
          "flex items-center justify-center h-6 w-6 rounded-md border border-border bg-card shrink-0",
          "text-muted-foreground group-hover:text-foreground group-hover:border-primary/30 group-hover:bg-primary/5 transition-all",
        )}>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-300",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
        </span>
      </button>

      {/* Content with slide animation */}
      <div
        ref={contentRef}
        style={{
          height: height === "auto" ? "auto" : `${height}px`,
          overflow: "hidden",
          transition: isAnimating ? "height 280ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
