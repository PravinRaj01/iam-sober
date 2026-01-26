import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const WeeklyPatternsCard = () => {
  const { toast } = useToast();

  const { data: insights, refetch, isLoading } = useQuery({
    queryKey: ["mood-patterns"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("detect-mood-patterns");
      
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "positive": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "challenging": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "positive": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "challenging": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 backdrop-blur-xl">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Weekly Patterns</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {insights ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={getTrendColor(insights.trend)}>
              {getTrendIcon(insights.trend)}
              <span className="ml-1 capitalize">{insights.trend}</span>
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{insights.pattern}</p>
            <p className="text-sm text-muted-foreground">{insights.insight}</p>
          </div>

          {insights.avgUrge && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Avg. Urge Intensity</span>
              <span className="text-sm font-semibold">{insights.avgUrge}/10</span>
            </div>
          )}

          {insights.totalCheckIns && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Check-ins (7 days)</span>
              <span className="text-sm font-semibold">{insights.totalCheckIns}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Analyzing your patterns..." : "Start logging check-ins to see your weekly patterns!"}
        </p>
      )}
    </Card>
  );
};
