import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AIStatusIndicator = () => {
  const { data: status, isLoading } = useQuery({
    queryKey: ["ai-status"],
    queryFn: async () => {
      try {
        // Test AI connectivity with a simple request
        const { error } = await supabase.functions.invoke("generate-motivation", {
          body: { test: true }
        });

        if (error) {
          if (error.message?.includes("429")) {
            return { status: "limited", message: "Rate limit reached" };
          }
          if (error.message?.includes("402")) {
            return { status: "no-credits", message: "No AI credits remaining" };
          }
          return { status: "error", message: "AI service unavailable" };
        }

        return { status: "connected", message: "AI features active" };
      } catch (error: any) {
        return { status: "error", message: error.message };
      }
    },
    refetchInterval: 60000, // Check every minute
  });

  const getStatusColor = () => {
    switch (status?.status) {
      case "connected":
        return "bg-success";
      case "limited":
        return "bg-warning";
      case "no-credits":
      case "error":
        return "bg-destructive";
      default:
        return "bg-muted";
    }
  };

  const getStatusIcon = () => {
    switch (status?.status) {
      case "connected":
        return <CheckCircle className="h-4 w-4" />;
      case "limited":
      case "no-credits":
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">AI Status</CardTitle>
          <Badge variant="outline" className={`${getStatusColor()} text-white border-0`}>
            {getStatusIcon()}
            <span className="ml-1">
              {isLoading ? "Checking..." : status?.status || "Unknown"}
            </span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-xs">
          {isLoading ? "Testing AI connectivity..." : status?.message}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default AIStatusIndicator;
