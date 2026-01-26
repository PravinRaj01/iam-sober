import { Badge } from "@/components/ui/badge";
import { Wrench, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatToolIndicatorProps {
  isThinking?: boolean;
  toolsUsed?: string[];
  compact?: boolean;
}

const ChatToolIndicator = ({ isThinking, toolsUsed, compact = false }: ChatToolIndicatorProps) => {
  if (!isThinking && (!toolsUsed || toolsUsed.length === 0)) return null;

  const formatToolName = (tool: string) => {
    return tool
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-1.5 animate-fade-in",
      compact ? "text-xs" : "text-sm"
    )}>
      {isThinking && (
        <Badge 
          variant="outline" 
          className={cn(
            "bg-primary/5 border-primary/20 text-primary",
            compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1"
          )}
        >
          <Brain className={cn("mr-1 animate-pulse", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          Thinking...
        </Badge>
      )}
      
      {toolsUsed && toolsUsed.length > 0 && (
        <>
          <Badge 
            variant="outline" 
            className={cn(
              "bg-accent/10 border-accent/20 text-accent-foreground",
              compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-1"
            )}
          >
            <Wrench className={cn("mr-1", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
            Tools Used
          </Badge>
          {toolsUsed.map((tool, index) => (
            <Badge 
              key={index}
              variant="secondary"
              className={cn(
                "bg-muted/50",
                compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5"
              )}
            >
              {formatToolName(tool)}
            </Badge>
          ))}
        </>
      )}
    </div>
  );
};

export default ChatToolIndicator;
