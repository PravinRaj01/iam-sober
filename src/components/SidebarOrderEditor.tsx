import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GripVertical, RotateCcw, Save, Home, Settings as SettingsIcon, Heart, BookOpen, Target, Activity, TrendingUp, Trophy, Watch, Sparkles, Brain, Users } from "lucide-react";
import { useSidebarOrder } from "@/hooks/useSidebarOrder";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "Check In": Heart,
  "Journal": BookOpen,
  "Goals": Target,
  "Coping Tools": Activity,
  "Progress": TrendingUp,
  "Achievements": Trophy,
  "Wearables": Watch,
  "AI Coach": Sparkles,
  "AI Insights": Brain,
  "Community": Users,
};

interface SidebarOrderEditorProps {
  onSave?: () => void;
}

const SidebarOrderEditor = ({ onSave }: SidebarOrderEditorProps) => {
  const { order, updateOrder, resetOrder, defaultOrder } = useSidebarOrder();
  const [localOrder, setLocalOrder] = useState<string[]>(order);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setLocalOrder(order);
  }, [order]);

  const handleDragStart = (e: React.DragEvent, item: string) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, item: string) => {
    e.preventDefault();
    if (item !== draggedItem) {
      setDragOverItem(item);
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetItem: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetItem) return;

    const newOrder = [...localOrder];
    const draggedIndex = newOrder.indexOf(draggedItem);
    const targetIndex = newOrder.indexOf(targetItem);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    setLocalOrder(newOrder);
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleSave = () => {
    updateOrder(localOrder);
    toast({
      title: "Sidebar order saved!",
      description: "Your sidebar arrangement has been updated.",
    });
    onSave?.();
  };

  const handleReset = () => {
    setLocalOrder(defaultOrder);
    resetOrder();
    toast({
      title: "Sidebar order reset",
      description: "Sidebar has been restored to default order.",
    });
  };

  const isDevUnlocked = localStorage.getItem('devToolsUnlocked') === 'true';

  // Filter out AI Insights if not unlocked
  const displayOrder = localOrder.filter(item => {
    if (item === "AI Insights" && !isDevUnlocked) return false;
    return true;
  });

  return (
    <Card className="bg-card/50 backdrop-blur-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GripVertical className="h-5 w-5" />
          Sidebar Order
        </CardTitle>
        <CardDescription>
          Drag and drop to reorder sidebar items. Dashboard and Settings are fixed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fixed: Dashboard */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/30">
          <div className="w-6 flex justify-center">
            <Home className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Dashboard (fixed)</span>
        </div>

        {/* Draggable items */}
        <div className="space-y-1">
          {displayOrder.map((item) => {
            const IconComponent = iconMap[item] || Activity;
            const isDragging = draggedItem === item;
            const isDragOver = dragOverItem === item;

            return (
              <div
                key={item}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragOver={(e) => handleDragOver(e, item)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item)}
                onDragEnd={handleDragEnd}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing
                  transition-all duration-200
                  ${isDragging ? "opacity-50 scale-95" : ""}
                  ${isDragOver ? "bg-primary/20 border-primary/50" : "bg-background/50 hover:bg-muted/50"}
                  border border-border/50
                `}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <IconComponent className="h-4 w-4 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            );
          })}
        </div>

        {/* Fixed: Settings */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/30">
          <div className="w-6 flex justify-center">
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Settings (fixed)</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Order
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SidebarOrderEditor;
