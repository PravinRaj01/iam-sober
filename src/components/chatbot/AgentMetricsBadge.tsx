import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Brain, Zap, Eye, Wrench } from "lucide-react";

interface AgentMetrics {
  autonomy_score: number;
  tool_iterations: number;
  read_tools: number;
  write_tools: number;
  crisis_detected: boolean;
}

interface AgentMetricsBadgeProps {
  metrics: AgentMetrics;
  compact?: boolean;
}

const AgentMetricsBadge = ({ metrics, compact = false }: AgentMetricsBadgeProps) => {
  if (!metrics) return null;

  const totalTools = metrics.read_tools + metrics.write_tools;
  
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
            <Brain className="h-3 w-3" />
            {totalTools > 0 ? `${totalTools} tools` : "Direct"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <p>Autonomy Score: {metrics.autonomy_score}</p>
            <p>Tool Iterations: {metrics.tool_iterations}</p>
            <p>Read Tools: {metrics.read_tools}</p>
            <p>Write Tools: {metrics.write_tools}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {metrics.tool_iterations > 0 && (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Zap className="h-3 w-3 text-amber-500" />
          {metrics.tool_iterations} iteration{metrics.tool_iterations > 1 ? 's' : ''}
        </Badge>
      )}
      {metrics.read_tools > 0 && (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Eye className="h-3 w-3 text-blue-500" />
          {metrics.read_tools} read
        </Badge>
      )}
      {metrics.write_tools > 0 && (
        <Badge variant="outline" className="text-[10px] gap-1">
          <Wrench className="h-3 w-3 text-green-500" />
          {metrics.write_tools} write
        </Badge>
      )}
      {metrics.crisis_detected && (
        <Badge variant="destructive" className="text-[10px]">
          Crisis Mode
        </Badge>
      )}
    </div>
  );
};

export default AgentMetricsBadge;
