import { Building2, ChevronDown, Check, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Company } from "@shared/schema";

interface CompanySelectorProps {
  companies: Company[];
  selectedId: string;
  onChange: (companyId: string) => void;
  loading?: boolean;
  compact?: boolean;
}

export function CompanySelector({
  companies,
  selectedId,
  onChange,
  loading,
  compact = false,
}: CompanySelectorProps) {
  const selectedCompany = selectedId === "all" 
    ? null 
    : companies.find((c) => c.id === selectedId);

  const displayName = selectedId === "all" 
    ? "Todas empresas" 
    : selectedCompany?.name || "Selecionar empresa";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "default"}
          className={compact ? "" : "w-[140px] xs:w-[180px] sm:w-[200px] justify-start gap-2 h-8 sm:h-9"}
          disabled={loading}
          data-testid="button-company-selector"
        >
          {selectedId === "all" ? (
            <Layers className="h-4 w-4" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          {!compact && (
            <>
              <span className="truncate">
                {loading ? "Carregando..." : displayName}
              </span>
              <ChevronDown className="h-4 w-4 ml-auto opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[250px]">
        <DropdownMenuItem
          onClick={() => onChange("all")}
          className="flex items-center justify-between"
          data-testid="menu-item-company-all"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="font-medium">Todas empresas</span>
          </div>
          {selectedId === "all" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => onChange(company.id)}
            className="flex items-center justify-between"
            data-testid={`menu-item-company-${company.id}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">{company.name}</span>
              <span className="text-xs text-muted-foreground">{company.cnpj}</span>
            </div>
            {selectedId === company.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
