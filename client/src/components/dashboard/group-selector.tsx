import { Users, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface VendorGroup {
  id: string;
  name: string;
  members: string[];
}

interface GroupSelectorProps {
  groups: VendorGroup[];
  selectedGroupId: string | null;
  onChange: (id: string | null) => void;
  loading?: boolean;
}

export function GroupSelector({ groups, selectedGroupId, onChange, loading }: GroupSelectorProps) {
  const selected = groups.find(g => g.id === selectedGroupId);

  if (loading || groups.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={selectedGroupId ? "secondary" : "outline"}
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs font-medium rounded-lg max-w-[160px]",
            selectedGroupId && "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
          )}
          data-testid="group-selector"
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate hidden xs:inline">
            {selected ? selected.name : "Equipe"}
          </span>
          {!selectedGroupId && <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />}
          {selectedGroupId && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="ml-0.5 rounded hover:bg-destructive/20 p-0.5"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onChange(null)}
          className={cn("gap-2", !selectedGroupId && "font-semibold text-primary")}
        >
          <Users className="h-3.5 w-3.5 opacity-60" />
          Todas as equipes
        </DropdownMenuItem>
        {groups.length > 0 && <DropdownMenuSeparator />}
        {groups.map(group => (
          <DropdownMenuItem
            key={group.id}
            onClick={() => onChange(group.id)}
            className={cn("gap-2", selectedGroupId === group.id && "font-semibold text-primary")}
          >
            <Users className="h-3.5 w-3.5 opacity-60" />
            <span className="truncate">{group.name}</span>
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              {group.members.length}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
