import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EyeOff, Eye, Loader2, Search, EyeOffIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface VendorVisibility {
  id: string;
  name: string;
  companyId: string;
  isHidden: boolean;
}

export function VendorVisibilityDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: vendors = [], isLoading } = useQuery<VendorVisibility[]>({
    queryKey: ["/api/admin/vendor-visibility"],
    queryFn: async () => {
      const res = await fetch("/api/admin/vendor-visibility");
      if (!res.ok) throw new Error("Erro ao carregar vendedores");
      return res.json();
    },
    enabled: isOpen,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ vendorId, isHidden }: { vendorId: string; isHidden: boolean }) => {
      const res = await fetch(`/api/admin/vendor-visibility/${encodeURIComponent(vendorId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar visibilidade");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendor-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["/api/salespersons"] });
    },
    onError: (err) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  const hiddenCount = vendors.filter(v => v.isHidden).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <EyeOffIcon className="h-3.5 w-3.5" />
          Ocultar Inativos
          {hiddenCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {hiddenCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Visibilidade dos Vendedores</DialogTitle>
          <DialogDescription>
            Vendedores ocultos não aparecem nas listagens. Use para esconder inativos ou afastados.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : (
          <ScrollArea className="h-[380px] pr-1">
            <div className="space-y-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum vendedor encontrado.</p>
              ) : (
                filtered.map(vendor => (
                  <div
                    key={vendor.id}
                    className={`flex items-center justify-between rounded-md px-3 py-2 transition-colors
                      ${vendor.isHidden ? "bg-muted/60 text-muted-foreground" : "hover:bg-muted/30"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {vendor.isHidden
                        ? <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <Eye className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      }
                      <span className="text-sm font-medium truncate">{vendor.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">Emp. {vendor.companyId}</span>
                    </div>
                    <Switch
                      checked={!vendor.isHidden}
                      disabled={toggleMutation.isPending}
                      onCheckedChange={checked => {
                        toggleMutation.mutate({ vendorId: vendor.id, isHidden: !checked });
                      }}
                      aria-label={vendor.isHidden ? "Mostrar vendedor" : "Ocultar vendedor"}
                    />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        <p className="text-xs text-muted-foreground text-right pt-1">
          {vendors.filter(v => !v.isHidden).length} visíveis · {hiddenCount} ocultos
        </p>
      </DialogContent>
    </Dialog>
  );
}
