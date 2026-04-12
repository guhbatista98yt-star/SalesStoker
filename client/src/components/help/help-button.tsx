import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpButtonProps {
  onClick: () => void;
  className?: string;
  size?: "sm" | "md";
  label?: string;
}

/**
 * Discrete help button — small "?" icon, subtle appearance.
 * Placed next to page titles or section headers.
 */
export function HelpButton({ onClick, className, size = "sm", label }: HelpButtonProps) {
  const sizeClasses = size === "sm"
    ? "h-6 w-6"
    : "h-7 w-7";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      onClick={onClick}
      aria-label={label ?? "Abrir ajuda"}
      title={label ?? "Ajuda"}
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        "text-muted-foreground/60 hover:text-muted-foreground",
        "hover:bg-muted transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        sizeClasses,
        className,
      )}
    >
      <HelpCircle className={iconSize} />
    </button>
  );
}
