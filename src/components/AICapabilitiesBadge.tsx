import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface AICapabilitiesBadgeProps {
  className?: string;
  onClick?: () => void;
}

const AICapabilitiesBadge = ({ className, onClick }: AICapabilitiesBadgeProps) => {
  return (
    <button
      onClick={onClick}
      className={className}
      type="button"
    >
      <Badge 
        variant="outline" 
        className="gap-1.5 px-2.5 py-1 text-xs font-medium bg-card/50 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-colors cursor-pointer"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>AI Capabilities</span>
      </Badge>
    </button>
  );
};

export default AICapabilitiesBadge;
