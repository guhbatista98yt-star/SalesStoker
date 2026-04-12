import { cn } from "@/lib/utils";
import { BookOpen, type LucideIcon } from "lucide-react";

export interface RuleGroup {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  items: string[];
}

interface CampaignRulesProps {
  groups: RuleGroup[];
  className?: string;
}

export function CampaignRules({ groups, className }: CampaignRulesProps) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-sm overflow-hidden", className)}>
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">Como funciona esta campanha</p>
          <p className="text-xs text-muted-foreground leading-tight">Regras em linguagem clara</p>
        </div>
      </div>

      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {groups.map((group, gi) => {
          const Icon = group.icon;
          return (
            <div key={gi} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4 shrink-0", group.iconColor)} />
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.title}</p>
              </div>
              <ul className="space-y-1.5">
                {group.items.map((item, ii) => (
                  <li key={ii} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
