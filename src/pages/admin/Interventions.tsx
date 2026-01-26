import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useInterventionsRealtime } from "@/hooks/useAdminRealtime";
import { 
  Activity, 
  Heart,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  Sparkles,
  Radio
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

/**
 * Interventions Page - Opik-style Crisis Intervention Analytics
 * 
 * FEATURES:
 * - Real-time WebSocket updates with toast notifications
 * - Intervention effectiveness tracking
 * - Mobile/tablet responsive layout
 */

const INTERVENTION_TYPES = {
  crisis: { color: 'hsl(var(--destructive))', label: 'Crisis', icon: AlertTriangle },
  high_urge: { color: 'hsl(var(--chart-2))', label: 'High Urge', icon: Activity },
  mood_drop: { color: 'hsl(var(--chart-3))', label: 'Mood Drop', icon: Heart },
  pattern_alert: { color: 'hsl(var(--chart-4))', label: 'Pattern Alert', icon: TrendingUp },
  support: { color: 'hsl(var(--primary))', label: 'Support', icon: MessageSquare },
};

const COLORS = ['hsl(var(--destructive))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--primary))'];

export default function Interventions() {
  // Enable real-time updates
  useInterventionsRealtime();

  // Fetch intervention data from ai_observability_logs
  const { data: interventionLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-intervention-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_observability_logs")
        .select("*")
        .eq("intervention_triggered", true)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  // Fetch actual interventions table
  const { data: interventions, isLoading: interventionsLoading } = useQuery({
    queryKey: ["admin-interventions-table"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_interventions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const isLoading = logsLoading || interventionsLoading;
  const metrics = interventions ? calculateInterventionMetrics(interventions, interventionLogs || []) : null;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-chart-2/10">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-chart-2" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Intervention Analytics</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Crisis support & effectiveness tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Radio className="h-3 w-3 text-green-500 animate-pulse" />
            <span className="text-xs">Live</span>
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span className="text-xs">Anonymized</span>
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <MetricCard
          title="Total Interventions"
          value={metrics?.totalInterventions || 0}
          icon={Activity}
          loading={isLoading}
        />
        <MetricCard
          title="Acknowledged"
          value={`${metrics?.acknowledgementRate || 0}%`}
          icon={CheckCircle2}
          loading={isLoading}
          color="text-green-500"
        />
        <MetricCard
          title="Helpful Rate"
          value={`${metrics?.helpfulRate || 0}%`}
          icon={ThumbsUp}
          loading={isLoading}
          color="text-primary"
        />
        <MetricCard
          title="Avg Response"
          value={`${metrics?.avgTimeToAck || 0}m`}
          icon={Clock}
          loading={isLoading}
        />
        <MetricCard
          title="Avg Risk Score"
          value={metrics?.avgRiskScore?.toFixed(1) || '0'}
          icon={AlertTriangle}
          loading={isLoading}
          color="text-orange-500"
        />
      </div>

      {/* Effectiveness Dashboard - UNIQUE OPIK FEATURE */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Intervention Effectiveness
          </CardTitle>
          <CardDescription>User feedback on intervention helpfulness - critical for AI improvement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Helpful vs Not Helpful */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Feedback Distribution</h4>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-green-500 flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> Helpful
                    </span>
                    <span className="text-sm font-medium">{metrics?.helpfulCount || 0}</span>
                  </div>
                  <Progress value={metrics?.helpfulRate || 0} className="h-2 bg-muted" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-red-500 flex items-center gap-1">
                      <ThumbsDown className="h-3 w-3" /> Not Helpful
                    </span>
                    <span className="text-sm font-medium">{metrics?.notHelpfulCount || 0}</span>
                  </div>
                  <Progress value={metrics?.notHelpfulRate || 0} className="h-2 bg-muted" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">No Feedback</span>
                    <span className="text-sm font-medium">{metrics?.noFeedbackCount || 0}</span>
                  </div>
                  <Progress value={metrics?.noFeedbackRate || 0} className="h-2 bg-muted" />
                </div>
              </div>
            </div>

            {/* Acknowledgement Funnel */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Acknowledgement Funnel</h4>
              <div className="space-y-2">
                <FunnelStep label="Triggered" count={metrics?.totalInterventions || 0} percentage={100} />
                <FunnelStep label="Acknowledged" count={metrics?.acknowledgedCount || 0} percentage={metrics?.acknowledgementRate || 0} />
                <FunnelStep label="Gave Feedback" count={(metrics?.helpfulCount || 0) + (metrics?.notHelpfulCount || 0)} percentage={metrics?.feedbackRate || 0} />
              </div>
            </div>

            {/* Risk Score Distribution */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Risk Score Distribution</h4>
              {isLoading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : (
                <div className="space-y-2">
                  {(metrics?.riskDistribution || []).map((bucket, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs w-16">{bucket.label}</span>
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                          style={{ width: `${bucket.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs w-8 text-right">{bucket.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Interventions Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Interventions Over Time
            </CardTitle>
            <CardDescription>Daily intervention count</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={metrics?.interventionsOverTime || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--chart-2))" 
                    fill="hsl(var(--chart-2)/0.2)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Intervention Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Intervention Types
            </CardTitle>
            <CardDescription>Breakdown by trigger type</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={metrics?.typeBreakdown || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(metrics?.typeBreakdown || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions Taken - UNIQUE FEATURE */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Taken After Intervention</CardTitle>
          <CardDescription>What users did after receiving an intervention</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics?.actionsBreakdown || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="action" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  {(metrics?.actionsBreakdown || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent Interventions List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interventions</CardTitle>
          <CardDescription>Latest crisis support events (anonymized)</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(interventions || []).slice(0, 20).map((intervention) => (
                  <div 
                    key={intervention.id}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {intervention.trigger_type?.replace(/_/g, ' ') || 'Unknown'}
                          </Badge>
                          {intervention.risk_score && (
                            <Badge 
                              variant={intervention.risk_score > 7 ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              Risk: {intervention.risk_score}/10
                            </Badge>
                          )}
                          {intervention.was_acknowledged && (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          )}
                          {intervention.was_helpful === true && (
                            <ThumbsUp className="h-3 w-3 text-primary" />
                          )}
                          {intervention.was_helpful === false && (
                            <ThumbsDown className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(intervention.created_at).toLocaleString()}
                        </p>
                      </div>
                      {intervention.action_taken && (
                        <Badge variant="secondary" className="text-xs">
                          {intervention.action_taken}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {(!interventions || interventions.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No interventions recorded yet</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Calculate intervention metrics
function calculateInterventionMetrics(interventions: any[], logs: any[]) {
  const total = interventions.length;
  const acknowledged = interventions.filter(i => i.was_acknowledged).length;
  const helpful = interventions.filter(i => i.was_helpful === true).length;
  const notHelpful = interventions.filter(i => i.was_helpful === false).length;
  const noFeedback = interventions.filter(i => i.was_helpful === null).length;

  const acknowledgementRate = total > 0 ? Math.round((acknowledged / total) * 100) : 0;
  const helpfulRate = total > 0 ? Math.round((helpful / total) * 100) : 0;
  const notHelpfulRate = total > 0 ? Math.round((notHelpful / total) * 100) : 0;
  const noFeedbackRate = total > 0 ? Math.round((noFeedback / total) * 100) : 0;
  const feedbackRate = total > 0 ? Math.round(((helpful + notHelpful) / total) * 100) : 0;

  // Time to acknowledge (in minutes)
  const ackTimes = interventions
    .filter(i => i.was_acknowledged && i.acknowledged_at)
    .map(i => {
      const created = new Date(i.created_at);
      const acked = new Date(i.acknowledged_at);
      return (acked.getTime() - created.getTime()) / 60000;
    });
  const avgTimeToAck = ackTimes.length > 0 ? Math.round(ackTimes.reduce((a, b) => a + b, 0) / ackTimes.length) : 0;

  // Risk scores
  const riskScores = interventions.map(i => i.risk_score).filter(Boolean);
  const avgRiskScore = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;

  // Risk distribution
  const riskDistribution = [
    { label: 'Low (1-3)', count: riskScores.filter(r => r <= 3).length, percentage: 0 },
    { label: 'Medium (4-6)', count: riskScores.filter(r => r > 3 && r <= 6).length, percentage: 0 },
    { label: 'High (7-8)', count: riskScores.filter(r => r > 6 && r <= 8).length, percentage: 0 },
    { label: 'Critical (9-10)', count: riskScores.filter(r => r > 8).length, percentage: 0 },
  ];
  const maxRisk = Math.max(...riskDistribution.map(r => r.count), 1);
  riskDistribution.forEach(r => r.percentage = (r.count / maxRisk) * 100);

  // Interventions over time
  const now = new Date();
  const interventionsOverTime = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    
    const count = interventions.filter(int => {
      const t = new Date(int.created_at);
      return t >= dayStart && t < dayEnd;
    }).length;
    
    interventionsOverTime.push({
      date: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    });
  }

  // Type breakdown
  const typeCounts: Record<string, number> = {};
  interventions.forEach(i => {
    const type = i.trigger_type || 'unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  const typeBreakdown = Object.entries(typeCounts)
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    .sort((a, b) => b.value - a.value);

  // Actions breakdown
  const actionCounts: Record<string, number> = {};
  interventions.forEach(i => {
    const action = i.action_taken || 'no action';
    actionCounts[action] = (actionCounts[action] || 0) + 1;
  });
  const actionsBreakdown = Object.entries(actionCounts)
    .map(([action, count]) => ({ action: action.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalInterventions: total,
    acknowledgedCount: acknowledged,
    acknowledgementRate,
    helpfulCount: helpful,
    notHelpfulCount: notHelpful,
    noFeedbackCount: noFeedback,
    helpfulRate,
    notHelpfulRate,
    noFeedbackRate,
    feedbackRate,
    avgTimeToAck,
    avgRiskScore,
    riskDistribution,
    interventionsOverTime,
    typeBreakdown,
    actionsBreakdown,
  };
}

// Metric Card Component
function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  loading,
  color
}: { 
  title: string; 
  value: string | number; 
  icon: React.ComponentType<{ className?: string }>; 
  loading: boolean;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className={`h-4 w-4 ${color || ''}`} />
          <span className="text-sm">{title}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className={`text-2xl font-bold ${color || ''}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Funnel Step Component
function FunnelStep({ label, count, percentage }: { label: string; count: number; percentage: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 text-xs">{label}</div>
      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
        <div 
          className="h-full bg-primary/60 flex items-center justify-end pr-2"
          style={{ width: `${percentage}%` }}
        >
          <span className="text-xs font-medium">{count}</span>
        </div>
      </div>
      <span className="w-10 text-xs text-right">{percentage}%</span>
    </div>
  );
}
