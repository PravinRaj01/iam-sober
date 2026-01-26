import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Heart, Moon, Footprints, Brain, Activity, Watch, TrendingUp, AlertTriangle, Link2, Loader2, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";

export default function WearableData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    heart_rate: "",
    sleep_hours: "",
    steps: "",
    stress_level: [5],
    hrv: "",
    blood_oxygen: "",
    notes: "",
  });

  const [analysis, setAnalysis] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);

  // Check if Fitbit is connected
  const { data: profile } = useQuery({
    queryKey: ["profile-wearable"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("privacy_settings")
        .eq("id", user.id)
        .single();
      return data;
    },
  });

  const isFitbitConnected = (profile?.privacy_settings as any)?.fitbit_connected === true;

  const { data: recentLogs } = useQuery({
    queryKey: ["biometric-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("biometric_logs")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(7);
      return data || [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (biometricData: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/analyze-biometrics`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ biometricData }),
        }
      );

      if (!response.ok) throw new Error("Failed to analyze biometrics");
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      queryClient.invalidateQueries({ queryKey: ["biometric-logs"] });
      toast({
        title: "Data analyzed!",
        description: "Your health metrics have been recorded and analyzed.",
      });
      setFormData({
        heart_rate: "",
        sleep_hours: "",
        steps: "",
        stress_level: [5],
        hrv: "",
        blood_oxygen: "",
        notes: "",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save biometric data.",
        variant: "destructive",
      });
    },
  });

  const syncFitbitMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/fitbit-auth?action=sync`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to sync Fitbit data");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["biometric-logs"] });
      toast({
        title: "Fitbit Synced!",
        description: `Latest data: ${data.data.steps} steps, ${data.data.sleep_hours.toFixed(1)}h sleep, ${data.data.heart_rate} bpm`,
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Could not sync Fitbit data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate({
      heart_rate: formData.heart_rate ? parseInt(formData.heart_rate) : null,
      sleep_hours: formData.sleep_hours ? parseFloat(formData.sleep_hours) : null,
      steps: formData.steps ? parseInt(formData.steps) : null,
      stress_level: formData.stress_level[0],
      hrv: formData.hrv ? parseInt(formData.hrv) : null,
      blood_oxygen: formData.blood_oxygen ? parseFloat(formData.blood_oxygen) : null,
      notes: formData.notes || null,
      source: "manual",
    });
  };

  // Handle Fitbit OAuth callback
  const fitbitCallbackMutation = useMutation({
    mutationFn: async (code: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const callbackUrl = `${window.location.origin}/wearables`;

      const response = await fetch(
        `https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/fitbit-auth?action=callback`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, callbackUrl }),
        }
      );

      if (!response.ok) throw new Error("Failed to complete Fitbit authorization");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-wearable"] });
      toast({
        title: "Fitbit Connected!",
        description: "Your Fitbit account has been successfully linked. Click 'Sync Now' to get your latest data.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check for OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Clean URL immediately
      window.history.replaceState({}, '', '/wearables');
      // Exchange code for token
      fitbitCallbackMutation.mutate(code);
    }
  }, []);

  const handleConnectFitbit = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const callbackUrl = `${window.location.origin}/wearables`;

      const response = await fetch(
        `https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/fitbit-auth?action=authorize`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ callbackUrl }),
        }
      );

      if (!response.ok) throw new Error("Failed to initiate Fitbit connection");
      
      const { authUrl } = await response.json();
      
      // Redirect to Fitbit authorization page
      window.location.href = authUrl;

    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground";
      default: return "bg-success text-success-foreground";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <PageHeader title="Wearable" />

      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Wearable Connection Section */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Connect Your Wearable
              </CardTitle>
              <CardDescription>
                Sync data automatically from your fitness tracker
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Fitbit */}
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  isFitbitConnected 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-border hover:border-primary/50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-[#00B0B9] flex items-center justify-center">
                        <span className="text-white font-bold text-sm">Fit</span>
                      </div>
                      <span className="font-medium">Fitbit</span>
                    </div>
                    {isFitbitConnected && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  {isFitbitConnected ? (
                    <div className="space-y-2">
                      <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                        Connected
                      </Badge>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => syncFitbitMutation.mutate()}
                        disabled={syncFitbitMutation.isPending}
                      >
                        {syncFitbitMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                        ) : (
                          "Sync Now"
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={handleConnectFitbit}
                      disabled={connecting}
                    >
                      {connecting ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  )}
                </div>

                {/* Apple Health - Coming Soon */}
                <div className="p-4 rounded-xl border-2 border-border/50 opacity-60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center">
                        <Heart className="h-5 w-5 text-white" />
                      </div>
                      <span className="font-medium">Apple Health</span>
                    </div>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>

                {/* Google Fit - Coming Soon */}
                <div className="p-4 rounded-xl border-2 border-border/50 opacity-60">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                        <Activity className="h-5 w-5 text-white" />
                      </div>
                      <span className="font-medium">Google Fit</span>
                    </div>
                  </div>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-6">
              <div className="grid grid-cols-1 gap-6">
                {/* Input Form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Log Health Metrics
                    </CardTitle>
                    <CardDescription>
                      Enter your wearable data or manual measurements
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="heart_rate" className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-red-500" /> Heart Rate (bpm)
                          </Label>
                          <Input
                            id="heart_rate"
                            type="number"
                            placeholder="72"
                            value={formData.heart_rate}
                            onChange={(e) => setFormData({ ...formData, heart_rate: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sleep_hours" className="flex items-center gap-2">
                            <Moon className="h-4 w-4 text-indigo-500" /> Sleep (hours)
                          </Label>
                          <Input
                            id="sleep_hours"
                            type="number"
                            step="0.5"
                            placeholder="7.5"
                            value={formData.sleep_hours}
                            onChange={(e) => setFormData({ ...formData, sleep_hours: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="steps" className="flex items-center gap-2">
                            <Footprints className="h-4 w-4 text-green-500" /> Steps
                          </Label>
                          <Input
                            id="steps"
                            type="number"
                            placeholder="8000"
                            value={formData.steps}
                            onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hrv" className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" /> HRV (ms)
                          </Label>
                          <Input
                            id="hrv"
                            type="number"
                            placeholder="45"
                            value={formData.hrv}
                            onChange={(e) => setFormData({ ...formData, hrv: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-500" /> 
                          Stress Level: {formData.stress_level[0]}/10
                        </Label>
                        <Slider
                          value={formData.stress_level}
                          onValueChange={(value) => setFormData({ ...formData, stress_level: value })}
                          max={10}
                          min={1}
                          step={1}
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
                        {submitMutation.isPending ? "Analyzing..." : "Log & Analyze"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* AI Analysis */}
                {analysis && (
                  <Card className="border-primary/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        AI Health Insights
                      </CardTitle>
                      <Badge className={getSeverityColor(analysis.risk_level || "low")}>
                        Risk Level: {analysis.risk_level || "low"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {analysis.insights?.map((insight: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-start gap-2">
                            {insight.severity === "high" ? (
                              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                            ) : (
                              <Activity className="h-4 w-4 text-primary mt-0.5" />
                            )}
                            <div>
                              <p className="font-medium">{insight.title}</p>
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {analysis.recommendations?.length > 0 && (
                        <div className="pt-2">
                          <p className="font-medium mb-2">Recommendations:</p>
                          <ul className="text-sm space-y-1">
                            {analysis.recommendations.map((rec: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              {/* Recent Logs */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Health Logs</CardTitle>
                  <CardDescription>Your biometric data from the past week</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentLogs?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No health data logged yet. Start tracking above!
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {recentLogs?.map((log: any) => (
                        <div key={log.id} className="p-3 rounded-lg bg-muted/30 text-center space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            {new Date(log.logged_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {log.source === 'fitbit' ? '⌚ Fitbit' : '✍️ Manual'}
                          </Badge>
                          {log.sleep_hours && (
                            <p className="text-sm">😴 {log.sleep_hours}h</p>
                          )}
                          {log.steps && (
                            <p className="text-sm">👟 {log.steps.toLocaleString()}</p>
                          )}
                          {log.heart_rate && (
                            <p className="text-sm">❤️ {log.heart_rate} bpm</p>
                          )}
                          {log.stress_level && (
                            <p className="text-sm">😰 {log.stress_level}/10</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}