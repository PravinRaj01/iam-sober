import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useAIAnalyticsRealtime } from "@/hooks/useAdminRealtime";
import { 
  Bot, 
  Clock, 
  Zap,
  TrendingUp,
  DollarSign,
  Activity,
  Sparkles,
  Gauge,
  BarChart3,
  PieChart,
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
  PieChart as RechartsPie,
  Pie,
  Legend
} from "recharts";

/**
 * AI Analytics Page - Opik-style Observability Dashboard
 * 
 * FEATURES:
 * - Real-time WebSocket updates
 * - Latency percentiles (p50, p95, p99)
 * - Token cost estimation with model breakdown
 * - Mobile/tablet responsive layout
 */

// Cost per 1K tokens (approximate)
const MODEL_COSTS = {
  "llama-3.3-70b-versatile": { input: 0.0007, output: 0.0008 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "claude-3": { input: 0.015, output: 0.075 },
  default: { input: 0.001, output: 0.002 },
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function AIAnalytics() {
  // Enable real-time updates
  useAIAnalyticsRealtime();

  // Fetch all AI logs for comprehensive analytics
  const { data: aiLogs, isLoading } = useQuery({
    queryKey: ["admin-ai-analytics-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_observability_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      return data || [];
    },
  });

  // Calculate advanced metrics
  const metrics = aiLogs ? calculateMetrics(aiLogs) : null;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">AI Analytics</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Opik-style observability metrics</p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1 w-fit">
          <Radio className="h-3 w-3 text-green-500 animate-pulse" />
          <span className="text-xs sm:text-sm">Live</span>
        </Badge>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <MetricCard
          title="Total Calls"
          value={metrics?.totalCalls || 0}
          icon={Activity}
          loading={isLoading}
          trend={metrics?.callsTrend}
        />
        <MetricCard
          title="Avg Latency"
          value={`${metrics?.avgLatency || 0}ms`}
          icon={Clock}
          loading={isLoading}
          subtitle="p50"
        />
        <MetricCard
          title="Throughput"
          value={`${metrics?.throughputPerHour || 0}/hr`}
          icon={Zap}
          loading={isLoading}
        />
        <MetricCard
          title="Est. Cost"
          value={`$${metrics?.estimatedCost?.toFixed(4) || '0.00'}`}
          icon={DollarSign}
          loading={isLoading}
          subtitle="This period"
        />
      </div>

      {/* Latency Percentiles */}
      <Card>
        <CardHeader className="pb-2 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Gauge className="h-4 w-4 sm:h-5 sm:w-5" />
            Latency Percentiles
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Response time distribution (p50, p95, p99)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <PercentileBar label="p50 (Median)" value={metrics?.p50 || 0} max={metrics?.p99 || 1000} color="bg-primary" />
              <PercentileBar label="p95" value={metrics?.p95 || 0} max={metrics?.p99 || 1000} color="bg-chart-2" />
              <PercentileBar label="p99 (Tail)" value={metrics?.p99 || 0} max={metrics?.p99 || 1000} color="bg-destructive" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>0ms</span>
                <span>{Math.round((metrics?.p99 || 1000) / 2)}ms</span>
                <span>{metrics?.p99 || 1000}ms</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Calls Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI Calls Over Time
            </CardTitle>
            <CardDescription>Hourly request volume</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={metrics?.callsOverTime || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary)/0.2)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Function Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Calls by Function
            </CardTitle>
            <CardDescription>Distribution of AI calls</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={metrics?.functionBreakdown || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(metrics?.functionBreakdown || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tool Usage Analytics - OPIK FEATURE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Tool Usage Analytics
          </CardTitle>
          <CardDescription>AI tool calls breakdown with performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics?.toolUsageData || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="tool" type="category" width={150} className="text-xs" />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Model Performance Comparison - UNIQUE */}
      <Card>
        <CardHeader>
          <CardTitle>Model Performance Comparison</CardTitle>
          <CardDescription>Latency and cost efficiency by model</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {(metrics?.modelPerformance || []).map((model, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div>
                        <p className="font-mono text-sm">{model.name}</p>
                        <p className="text-xs text-muted-foreground">{model.calls} calls</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{model.avgLatency}ms avg</p>
                      <p className="text-xs text-muted-foreground">${model.cost.toFixed(4)} est.</p>
                    </div>
                  </div>
                ))}
                {(!metrics?.modelPerformance || metrics.modelPerformance.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">No model data available</p>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Token Usage */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Token Consumption</CardTitle>
            <CardDescription>Input vs Output tokens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Input Tokens</span>
              <span className="font-mono text-lg">{metrics?.totalInputTokens?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Output Tokens</span>
              <span className="font-mono text-lg">{metrics?.totalOutputTokens?.toLocaleString() || 0}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Tokens</span>
                <span className="font-mono text-xl text-primary">
                  {((metrics?.totalInputTokens || 0) + (metrics?.totalOutputTokens || 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Estimated costs by category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Input Cost</span>
              <span className="font-mono">${metrics?.inputCost?.toFixed(4) || '0.0000'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Output Cost</span>
              <span className="font-mono">${metrics?.outputCost?.toFixed(4) || '0.0000'}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Estimated</span>
                <span className="font-mono text-xl text-primary">${metrics?.estimatedCost?.toFixed(4) || '0.0000'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper function to calculate all metrics
function calculateMetrics(logs: any[]) {
  if (!logs.length) return null;

  const responseTimes = logs.map(l => l.response_time_ms || 0).filter(t => t > 0).sort((a, b) => a - b);
  const totalCalls = logs.length;
  
  // Percentiles
  const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
  const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
  const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
  const avgLatency = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) || 0;

  // Calls over time (last 24 hours)
  const now = new Date();
  const callsOverTime = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const calls = logs.filter(l => {
      const logTime = new Date(l.created_at);
      return logTime >= hourStart && logTime < hourEnd;
    }).length;
    callsOverTime.push({
      hour: hourStart.getHours().toString().padStart(2, '0') + ':00',
      calls,
    });
  }

  // Throughput
  const lastHourLogs = logs.filter(l => new Date(l.created_at) > new Date(now.getTime() - 60 * 60 * 1000));
  const throughputPerHour = lastHourLogs.length;

  // Function breakdown
  const functionCounts: Record<string, number> = {};
  logs.forEach(l => {
    const fn = l.function_name || 'unknown';
    functionCounts[fn] = (functionCounts[fn] || 0) + 1;
  });
  const functionBreakdown = Object.entries(functionCounts)
    .map(([name, value]) => ({ name: name.replace(/-/g, ' '), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Tool usage
  const toolCounts: Record<string, number> = {};
  logs.forEach(l => {
    const tools = l.tools_called as string[] | null;
    if (tools && Array.isArray(tools)) {
      tools.forEach((tool: string) => {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      });
    }
  });
  const toolUsageData = Object.entries(toolCounts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Model performance
  const modelStats: Record<string, { calls: number; totalLatency: number; tokens: number }> = {};
  logs.forEach(l => {
    const model = l.model_used || 'unknown';
    if (!modelStats[model]) {
      modelStats[model] = { calls: 0, totalLatency: 0, tokens: 0 };
    }
    modelStats[model].calls++;
    modelStats[model].totalLatency += l.response_time_ms || 0;
    modelStats[model].tokens += (l.input_tokens || 0) + (l.output_tokens || 0);
  });
  const modelPerformance = Object.entries(modelStats).map(([name, stats]) => {
    const costs = MODEL_COSTS[name as keyof typeof MODEL_COSTS] || MODEL_COSTS.default;
    return {
      name,
      calls: stats.calls,
      avgLatency: Math.round(stats.totalLatency / stats.calls),
      cost: (stats.tokens / 1000) * ((costs.input + costs.output) / 2),
    };
  }).sort((a, b) => b.calls - a.calls);

  // Token totals
  const totalInputTokens = logs.reduce((sum, l) => sum + (l.input_tokens || 0), 0);
  const totalOutputTokens = logs.reduce((sum, l) => sum + (l.output_tokens || 0), 0);
  
  const inputCost = (totalInputTokens / 1000) * MODEL_COSTS.default.input;
  const outputCost = (totalOutputTokens / 1000) * MODEL_COSTS.default.output;
  const estimatedCost = inputCost + outputCost;

  // Trend (compare last 12h to previous 12h)
  const last12h = logs.filter(l => new Date(l.created_at) > new Date(now.getTime() - 12 * 60 * 60 * 1000)).length;
  const prev12h = logs.filter(l => {
    const t = new Date(l.created_at);
    return t > new Date(now.getTime() - 24 * 60 * 60 * 1000) && t <= new Date(now.getTime() - 12 * 60 * 60 * 1000);
  }).length;
  const callsTrend = prev12h > 0 ? Math.round(((last12h - prev12h) / prev12h) * 100) : 0;

  return {
    totalCalls,
    avgLatency,
    p50,
    p95,
    p99,
    callsOverTime,
    throughputPerHour,
    functionBreakdown,
    toolUsageData,
    modelPerformance,
    totalInputTokens,
    totalOutputTokens,
    inputCost,
    outputCost,
    estimatedCost,
    callsTrend,
  };
}

// Metric Card Component
function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  loading, 
  trend,
  subtitle 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ComponentType<{ className?: string }>; 
  loading: boolean;
  trend?: number;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{title}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            {trend !== undefined && trend !== 0 && (
              <span className={`text-xs ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
          </div>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// Percentile Bar Component
function PercentileBar({ 
  label, 
  value, 
  max, 
  color 
}: { 
  label: string; 
  value: number; 
  max: number; 
  color: string;
}) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value}ms</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
