import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface VendorGroup {
    id: string;
    name: string;
    members: string[]; // salesperson IDs
}

export function VendorGroupsDialog({ salespeople }: { salespeople: { id: string, name: string }[] }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupName, setGroupName] = useState("");
    const [groupMembers, setGroupMembers] = useState<string[]>([]);

    const { data: groups = [], isLoading } = useQuery<VendorGroup[]>({
        queryKey: ["/api/admin/vendor-groups"],
    });

    const saveMutation = useMutation({
        mutationFn: async (payload: VendorGroup) => {
            const res = await fetch("/api/admin/vendor-groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to save group");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Equipe salva com sucesso!" });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/vendor-groups"] });
        },
        onError: (err) => {
            toast({ title: "Erro ao salvar equipe", description: err.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/admin/vendor-groups/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete group");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Equipe excluída!" });
            setSelectedGroupId(null);
            queryClient.invalidateQueries({ queryKey: ["/api/admin/vendor-groups"] });
        },
        onError: (err) => {
            toast({ title: "Erro ao excluir equipe", description: err.message, variant: "destructive" });
        }
    });

    useEffect(() => {
        if (selectedGroupId && selectedGroupId !== "NEW") {
            const group = groups.find(g => g.id === selectedGroupId);
            if (group) {
                setGroupName(group.name);
                setGroupMembers(group.members);
            }
        } else if (selectedGroupId === "NEW") {
            setGroupName("Nova Equipe");
            setGroupMembers([]);
        }
    }, [selectedGroupId, groups]);

    const handleSave = () => {
        if (!groupName.trim()) {
            toast({ title: "Erro", description: "O nome da equipe não pode estar vazio", variant: "destructive" });
            return;
        }
        const id = selectedGroupId === "NEW" ? Math.random().toString(36).substring(2, 15) : selectedGroupId!;
        saveMutation.mutate({ id, name: groupName, members: groupMembers });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Users className="w-4 h-4" />
                    Gerenciar Equipes
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[600px] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Gerenciar Equipes de Venda</DialogTitle>
                    <DialogDescription>
                        Crie grupos para facilitar o filtro e a configuração de metas simultâneas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 gap-4 overflow-hidden mt-2">
                    {/* Left panel: List of groups */}
                    <div className="w-1/3 border rounded-md flex flex-col">
                        <div className="p-2 border-b bg-muted/50 flex justify-between items-center">
                            <span className="font-semibold text-sm">Equipes</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedGroupId("NEW")}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <ScrollArea className="flex-1">
                            {isLoading ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
                            ) : groups.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma equipe criada.</div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {groups.map(g => (
                                        <button
                                            key={g.id}
                                            onClick={() => setSelectedGroupId(g.id)}
                                            className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${selectedGroupId === g.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                                        >
                                            {g.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Right panel: Edit selected group */}
                    <div className="w-2/3 border rounded-md flex flex-col p-4 bg-muted/10">
                        {selectedGroupId ? (
                            <>
                                <div className="flex justify-between gap-4 mb-4">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-semibold text-muted-foreground">Nome da Equipe</label>
                                        <Input value={groupName} onChange={e => setGroupName(e.target.value)} />
                                    </div>
                                    {selectedGroupId !== "NEW" && (
                                        <div className="flex items-end">
                                            <Button variant="destructive" size="icon" onClick={() => deleteMutation.mutate(selectedGroupId)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 border rounded-md flex flex-col overflow-hidden">
                                    <div className="p-2 border-b bg-muted/50">
                                        <span className="font-semibold text-sm">Vendedores da Equipe</span>
                                    </div>
                                    <ScrollArea className="flex-1 p-2">
                                        <div className="space-y-2">
                                            {salespeople.map(sp => (
                                                <div key={sp.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded-sm">
                                                    <Checkbox
                                                        id={`sp-${sp.id}`}
                                                        checked={groupMembers.includes(sp.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setGroupMembers([...groupMembers, sp.id]);
                                                            } else {
                                                                setGroupMembers(groupMembers.filter(id => id !== sp.id));
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`sp-${sp.id}`}
                                                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                                                    >
                                                        {sp.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>

                                <div className="mt-4 flex justify-end">
                                    <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                                        {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Salvar Equipe
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                Selecione uma equipe na lista ou crie uma nova.
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent >
        </Dialog >
    );
}
