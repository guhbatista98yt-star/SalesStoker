import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  text: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Inline field-level help tooltip.
 * Tiny "?" icon that shows a short explanation on hover.
 * Use next to form labels, filter options or any complex field.
 */
export function HelpTooltip({ text, className, side = "top" }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center justify-center",
              "w-3.5 h-3.5 rounded-full",
              "text-muted-foreground/50 hover:text-muted-foreground",
              "cursor-help transition-colors",
              className,
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-[240px] text-xs leading-relaxed"
          sideOffset={4}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
