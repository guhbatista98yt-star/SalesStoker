import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableCardProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function DraggableCard({ id, children, className }: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "z-50 opacity-90",
        className
      )}
      data-testid={`draggable-card-${id}`}
    >
      {children}
    </div>
  );
}

interface DragHandleProps {
  id: string;
  attributes: Record<string, any>;
  listeners: Record<string, any> | undefined;
}

export function DragHandle({ id, attributes, listeners }: DragHandleProps) {
  return (
    <button
      {...attributes}
      {...listeners}
      className="p-1.5 rounded-md bg-muted/50 hover:bg-muted cursor-grab active:cursor-grabbing transition-colors touch-manipulation"
      data-testid={`drag-handle-${id}`}
      aria-label="Arrastar para reorganizar"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function useDragHandle(id: string) {
  const sortable = useSortable({ id });
  return {
    ...sortable,
    dragHandleProps: {
      id,
      attributes: sortable.attributes,
      listeners: sortable.listeners,
    },
  };
}
