import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Moon, Footprints, Heart, RefreshCw, Watch } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

export const HealthStatusCard = () => {
  const navigate = useNavigate();

  const { data: biometrics, isLoading, refetch } = useQuery({
    queryKey: ["health-status-biometrics"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("biometric_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("logged_at", weekAgo.toISOString())
        .order("logged_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-lg border-border/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!biometrics || biometrics.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-lg border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Watch className="h-4 w-4 text-muted-foreground" />
            Health Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            No wearable data yet. Connect a device to track health metrics.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/wearables')}
          >
            <Watch className="h-4 w-4 mr-2" />
            Connect Wearable
          </Button>
        </CardContent>
      </Card>
    );
  }

  const latest = biometrics[0];
  const avgSleep = biometrics.reduce((sum, b) => sum + (b.sleep_hours || 0), 0) / biometrics.length;
  const avgSteps = Math.round(biometrics.reduce((sum, b) => sum + (b.steps || 0), 0) / biometrics.length);
  const avgStress = biometrics.reduce((sum, b) => sum + (b.stress_level || 0), 0) / biometrics.length;

  const lastSyncTime = latest.logged_at ? formatDistanceToNow(new Date(latest.logged_at), { addSuffix: true }) : 'Unknown';

  return (
    <Card className="bg-card/50 backdrop-blur-lg border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Health Status
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Last sync: {lastSyncTime}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Sleep */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Moon className="h-4 w-4 text-indigo-400" />
            <div>
              <p className="text-xs text-muted-foreground">Avg Sleep</p>
              <p className="text-sm font-medium">{avgSleep.toFixed(1)}h</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Footprints className="h-4 w-4 text-green-400" />
            <div>
              <p className="text-xs text-muted-foreground">Avg Steps</p>
              <p className="text-sm font-medium">{avgSteps.toLocaleString()}</p>
            </div>
          </div>

          {/* Heart Rate */}
          {latest.heart_rate && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Heart className="h-4 w-4 text-red-400" />
              <div>
                <p className="text-xs text-muted-foreground">Heart Rate</p>
                <p className="text-sm font-medium">{latest.heart_rate} bpm</p>
              </div>
            </div>
          )}

          {/* Stress */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Activity className="h-4 w-4 text-amber-400" />
            <div>
              <p className="text-xs text-muted-foreground">Avg Stress</p>
              <p className="text-sm font-medium">{avgStress.toFixed(1)}/10</p>
            </div>
          </div>
        </div>

        {/* Health insight */}
        <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs">
            {avgSleep < 6 
              ? "💤 Sleep is low. Rest helps recovery!" 
              : avgStress > 7 
                ? "😤 Stress is elevated. Try some coping exercises."
                : "✨ Your health metrics look stable!"}
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => navigate('/wearables')}
        >
          View All Health Data
        </Button>
      </CardContent>
    </Card>
  );
};

export default HealthStatusCard;
