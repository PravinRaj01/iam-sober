import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, parseISO } from "date-fns";

export const BiometricTrendsChart = () => {
  const { data: biometrics, isLoading } = useQuery({
    queryKey: ["biometric-trends"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const thirtyDaysAgo = subDays(new Date(), 30);

      const { data, error } = await supabase
        .from("biometric_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("logged_at", thirtyDaysAgo.toISOString())
        .order("logged_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: checkIns } = useQuery({
    queryKey: ["biometric-check-ins-correlation"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const thirtyDaysAgo = subDays(new Date(), 30);

      const { data, error } = await supabase
        .from("check_ins")
        .select("mood, urge_intensity, created_at")
        .eq("user_id", user.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-lg border-border/50">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!biometrics || biometrics.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-lg border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Biometric Trends
          </CardTitle>
          <CardDescription>Connect a wearable device to see health trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No biometric data available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const moodMap: Record<string, number> = {
    'great': 5,
    'good': 4,
    'okay': 3,
    'struggling': 2,
    'crisis': 1
  };

  const chartData = biometrics.map((b) => {
    const date = b.logged_at ? format(parseISO(b.logged_at), 'MMM dd') : '';
    
    // Find matching check-in for that day
    const matchingCheckIn = checkIns?.find(c => {
      const checkInDate = format(parseISO(c.created_at), 'MMM dd');
      return checkInDate === date;
    });

    return {
      date,
      sleep: b.sleep_hours,
      stress: b.stress_level,
      steps: b.steps ? Math.round(b.steps / 1000) : null, // In thousands
      heartRate: b.heart_rate,
      mood: matchingCheckIn ? moodMap[matchingCheckIn.mood] || null : null,
      urge: matchingCheckIn?.urge_intensity || null,
    };
  });

  return (
    <Card className="bg-card/50 backdrop-blur-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Biometric & Mood Correlation
        </CardTitle>
        <CardDescription>
          See how your health metrics relate to your mood and urges
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sleep" 
                stroke="hsl(240, 60%, 60%)" 
                strokeWidth={2}
                dot={false}
                name="Sleep (hrs)"
              />
              <Line 
                type="monotone" 
                dataKey="stress" 
                stroke="hsl(30, 80%, 55%)" 
                strokeWidth={2}
                dot={false}
                name="Stress (0-10)"
              />
              <Line 
                type="monotone" 
                dataKey="mood" 
                stroke="hsl(150, 60%, 50%)" 
                strokeWidth={2}
                dot={false}
                name="Mood (1-5)"
              />
              <Line 
                type="monotone" 
                dataKey="urge" 
                stroke="hsl(0, 70%, 60%)" 
                strokeWidth={2}
                dot={false}
                name="Urge (0-10)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Insights section */}
        <div className="mt-4 p-3 rounded-lg bg-muted/30">
          <p className="text-sm font-medium mb-2">💡 Insights</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Higher stress levels often correlate with higher urge intensity</li>
            <li>• Better sleep tends to improve mood and reduce cravings</li>
            <li>• Track consistently for more accurate patterns</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default BiometricTrendsChart;
