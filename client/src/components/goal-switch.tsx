import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface GoalSwitchProps {
    mode: "unified" | "split";
    onToggle: (checked: boolean) => void;
    disabled?: boolean;
}

export function GoalSwitch({ mode, onToggle, disabled }: GoalSwitchProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <Switch
                    id="goal-mode"
                    checked={mode === "unified"}
                    onCheckedChange={onToggle}
                    disabled={disabled}
                />
                <Label htmlFor="goal-mode" className="font-medium cursor-pointer">
                    {mode === "unified" ? "Meta Individual" : "Metas Separadas"}
                </Label>
            </div>
            <span className="text-xs text-muted-foreground">
                Ative para usar uma meta única. Desative para definir metas separadas por empresa.
            </span>
        </div>
    );
}
