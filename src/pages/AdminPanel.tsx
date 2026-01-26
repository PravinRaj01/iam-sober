import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAdminPanelRealtime } from "@/hooks/useAdminRealtime";
import { 
  Users, 
  Activity, 
  Bot, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Wrench,
  Sparkles,
  Shield,
  BarChart3,
  Radio,
  Bell,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react";

/**
 * Admin Panel - Privacy-Safe Opik Dashboard
 * 
 * FEATURES:
 * - Real-time WebSocket updates
 * - Aggregated usage statistics
 * - AI performance metrics
 * - Mobile/tablet responsive layout
 */

const AdminPanel = () => {
  const { isAdmin, isLoading: authLoading } = useAdminAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationResult, setNotificationResult] = useState<{ success: boolean; message: string } | null>(null);

  // Enable real-time updates
  useAdminPanelRealtime();

  // Aggregated usage stats (counts only - no user-specific data)
  const { data: usageStats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-usage-stats"],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: totalCheckIns },
        { count: totalGoals },
        { count: totalJournals },
        { count: totalAiCalls },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("check_ins").select("*", { count: "exact", head: true }),
        supabase.from("goals").select("*", { count: "exact", head: true }),
        supabase.from("journal_entries").select("*", { count: "exact", head: true }),
        supabase.from("ai_observability_logs").select("*", { count: "exact", head: true }),
      ]);

      return {
        totalUsers: totalUsers || 0,
        totalCheckIns: totalCheckIns || 0,
        totalGoals: totalGoals || 0,
        totalJournals: totalJournals || 0,
        totalAiCalls: totalAiCalls || 0,
      };
    },
    enabled: isAdmin,
  });

  // AI Performance metrics (aggregated)
  const { data: aiMetrics, isLoading: aiLoading } = useQuery({
    queryKey: ["admin-ai-metrics"],
    queryFn: async () => {
      const { data: logs } = await supabase
        .from("ai_observability_logs")
        .select("response_time_ms, tools_called, error_message, model_used, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (!logs || logs.length === 0) {
        return {
          avgResponseTime: 0,
          totalCalls: 0,
          errorRate: 0,
          toolUsage: {} as Record<string, number>,
          callsToday: 0,
          callsThisWeek: 0,
        };
      }

      const totalCalls = logs.length;
      const avgResponseTime = logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / totalCalls;
      const errorCount = logs.filter(l => l.error_message).length;
      const errorRate = (errorCount / totalCalls) * 100;

      // Tool usage breakdown
      const toolUsage: Record<string, number> = {};
      logs.forEach(log => {
        const tools = log.tools_called as string[] | null;
        if (tools && Array.isArray(tools)) {
          tools.forEach((tool: string) => {
            toolUsage[tool] = (toolUsage[tool] || 0) + 1;
          });
        }
      });

      // Time-based metrics
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const callsToday = logs.filter(l => new Date(l.created_at) >= todayStart).length;
      const callsThisWeek = logs.filter(l => new Date(l.created_at) >= weekStart).length;

      return {
        avgResponseTime: Math.round(avgResponseTime),
        totalCalls,
        errorRate: errorRate.toFixed(2),
        toolUsage,
        callsToday,
        callsThisWeek,
      };
    },
    enabled: isAdmin,
  });

  // Intervention stats (anonymized)
  const { data: interventionStats } = useQuery({
    queryKey: ["admin-intervention-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_observability_logs")
        .select("intervention_triggered, intervention_type")
        .eq("intervention_triggered", true);

      const typeBreakdown: Record<string, number> = {};
      data?.forEach(d => {
        const type = d.intervention_type || "unknown";
        typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
      });

      return {
        totalInterventions: data?.length || 0,
        typeBreakdown,
      };
    },
    enabled: isAdmin,
  });

  // Recent errors (technical only - no user content)
  const { data: recentErrors } = useQuery({
    queryKey: ["admin-recent-errors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_observability_logs")
        .select("error_message, function_name, created_at")
        .not("error_message", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: isAdmin,
  });

  // Fetch users for test notification dropdown
  const { data: allUsers } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, pseudonym")
        .order("pseudonym", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Check if selected user has push subscription
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["admin-user-subscription", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", selectedUserId)
        .limit(1);
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: isAdmin && !!selectedUserId,
  });

  const handleSendTestNotification = async () => {
    if (!selectedUserId) {
      toast({
        title: "Select a user",
        description: "Please select a user to send a test notification to.",
        variant: "destructive",
      });
      return;
    }

    setSendingNotification(true);
    setNotificationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: selectedUserId,
          title: "🧪 Test Notification",
          body: "This is a test push notification from the Admin Panel. If you see this, notifications are working!",
          url: "/settings",
          data: {
            type: "admin_test",
            timestamp: new Date().toISOString(),
          }
        },
      });

      if (error) throw error;

      setNotificationResult({
        success: true,
        message: data?.message || "Test notification sent successfully!",
      });

      toast({
        title: "Notification sent!",
        description: "The test notification was sent successfully.",
      });
    } catch (error: any) {
      console.error("Failed to send test notification:", error);
      setNotificationResult({
        success: false,
        message: error.message || "Failed to send notification",
      });

      toast({
        title: "Failed to send",
        description: error.message || "Could not send the test notification.",
        variant: "destructive",
      });
    } finally {
      setSendingNotification(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const isLoading = statsLoading || aiLoading;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Privacy-safe Opik analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Badge variant="outline" className="flex items-center gap-1">
            <Radio className="h-3 w-3 text-green-500 animate-pulse" />
            <span className="text-xs">Live</span>
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            <span className="text-xs sm:text-sm">Aggregated Only</span>
          </Badge>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <StatCard title="Total Users" value={usageStats?.totalUsers || 0} icon={Users} loading={isLoading} />
        <StatCard title="Check-ins" value={usageStats?.totalCheckIns || 0} icon={Activity} loading={isLoading} />
        <StatCard title="Goals" value={usageStats?.totalGoals || 0} icon={TrendingUp} loading={isLoading} />
        <StatCard title="Journals" value={usageStats?.totalJournals || 0} icon={BarChart3} loading={isLoading} />
        <StatCard title="AI Calls" value={usageStats?.totalAiCalls || 0} icon={Bot} loading={isLoading} />
      </div>

      {/* AI Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Performance
            </CardTitle>
            <CardDescription>Real-time AI Coach metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Avg Response
                </div>
                <p className="text-2xl font-bold mt-1">
                  {isLoading ? <Skeleton className="h-8 w-20" /> : `${aiMetrics?.avgResponseTime || 0}ms`}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Error Rate
                </div>
                <p className="text-2xl font-bold mt-1">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : `${aiMetrics?.errorRate || 0}%`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-xl font-semibold">{aiMetrics?.callsToday || 0} calls</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-xl font-semibold">{aiMetrics?.callsThisWeek || 0} calls</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Tool Usage Analytics
            </CardTitle>
            <CardDescription>Most used AI tools</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(aiMetrics?.toolUsage || {})
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([tool, count]) => (
                      <div key={tool} className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span className="text-sm font-mono">{tool}</span>
                        <Badge variant="secondary">{count as number}</Badge>
                      </div>
                    ))}
                  {Object.keys(aiMetrics?.toolUsage || {}).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No tool usage data yet
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Test Notifications & Interventions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Test Notifications Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Test Notifications
            </CardTitle>
            <CardDescription>Send test push notifications to users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.pseudonym || "Anonymous User"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Subscription:</span>
                {subscriptionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : userSubscription ? (
                  <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="bg-red-500/20 text-red-700 border-red-500/30">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not subscribed
                  </Badge>
                )}
              </div>
            )}

            <Button
              onClick={handleSendTestNotification}
              disabled={!selectedUserId || sendingNotification || !userSubscription}
              className="w-full"
            >
              {sendingNotification ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Send Test Notification
                </>
              )}
            </Button>

            {notificationResult && (
              <div className={`p-3 rounded-lg text-sm ${
                notificationResult.success 
                  ? 'bg-green-500/10 text-green-700 border border-green-500/20' 
                  : 'bg-red-500/10 text-red-700 border border-red-500/20'
              }`}>
                {notificationResult.success ? (
                  <CheckCircle2 className="h-4 w-4 inline mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 inline mr-2" />
                )}
                {notificationResult.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interventions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Crisis Interventions
            </CardTitle>
            <CardDescription>Anonymized intervention tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-primary">
                {interventionStats?.totalInterventions || 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Total Interventions</p>
            </div>
            <div className="space-y-2 mt-4">
              {Object.entries(interventionStats?.typeBreakdown || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                  <Badge variant="outline">{count as number}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Recent Errors
            </CardTitle>
            <CardDescription>Technical errors only (no user data)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {recentErrors && recentErrors.length > 0 ? (
                <div className="space-y-2">
                  {recentErrors.map((error, i) => (
                    <div key={i} className="p-2 rounded bg-destructive/5 border border-destructive/20 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">{error.function_name}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(error.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-destructive font-mono text-xs truncate">
                        {error.error_message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  🎉 No recent errors
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Privacy Notice */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <strong>Privacy Notice:</strong> This dashboard only displays aggregated, anonymized data. 
              No individual user information, conversations, or personal recovery details are shown.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  loading 
}: { 
  title: string; 
  value: number; 
  icon: React.ComponentType<{ className?: string }>; 
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{title}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminPanel;
