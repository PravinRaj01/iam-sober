import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useErrorLogsRealtime } from "@/hooks/useAdminRealtime";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertTriangle, 
  Search,
  Filter,
  TrendingUp,
  Clock,
  AlertCircle,
  XCircle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronUp,
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
  Cell
} from "recharts";

/**
 * Error Logs Page - Opik-style Error Tracking
 * 
 * FEATURES:
 * - Real-time WebSocket updates with toast notifications
 * - Error trend analysis over time
 * - Mobile/tablet responsive layout
 */

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-500', icon: XCircle, label: 'Critical' },
  error: { color: 'bg-orange-500', icon: AlertCircle, label: 'Error' },
  warning: { color: 'bg-yellow-500', icon: AlertTriangle, label: 'Warning' },
  info: { color: 'bg-blue-500', icon: Info, label: 'Info' },
};

const COLORS = ['hsl(var(--destructive))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function ErrorLogs() {
  // Enable real-time updates
  useErrorLogsRealtime();

  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [functionFilter, setFunctionFilter] = useState<string>("all");
  const [expandedError, setExpandedError] = useState<string | null>(null);

  // Fetch all error logs
  const { data: errorLogs, isLoading, refetch } = useQuery({
    queryKey: ["admin-error-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_observability_logs")
        .select("id, error_message, function_name, created_at, response_time_ms, model_used")
        .not("error_message", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  // Calculate metrics
  const metrics = errorLogs ? calculateErrorMetrics(errorLogs) : null;

  // Filter errors
  const filteredErrors = errorLogs?.filter(error => {
    const matchesSearch = !searchQuery || 
      error.error_message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.function_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || getSeverity(error.error_message) === severityFilter;
    const matchesFunction = functionFilter === "all" || error.function_name === functionFilter;
    
    return matchesSearch && matchesSeverity && matchesFunction;
  }) || [];

  // Get unique functions for filter
  const uniqueFunctions = [...new Set(errorLogs?.map(e => e.function_name) || [])];

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Error Logs</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Technical error tracking & analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Radio className="h-3 w-3 text-green-500 animate-pulse" />
            <span className="text-xs">Live</span>
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatCard
          title="Total Errors"
          value={metrics?.totalErrors || 0}
          icon={AlertTriangle}
          loading={isLoading}
          variant="destructive"
        />
        <StatCard
          title="Last 24h"
          value={metrics?.errorsLast24h || 0}
          icon={Clock}
          loading={isLoading}
        />
        <StatCard
          title="Error Rate"
          value={`${metrics?.errorRate || 0}%`}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          title="Most Affected"
          value={metrics?.mostAffectedFunction || 'N/A'}
          icon={AlertCircle}
          loading={isLoading}
          isText
        />
      </div>

      {/* Error Trends Chart */}
      <Card>
        <CardHeader className="pb-2 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            Error Trend (Last 7 Days)
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Daily error count over time</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[160px] sm:h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={metrics?.errorTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tick={{ fontSize: 10 }} width={30} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="errors" 
                  stroke="hsl(var(--destructive))" 
                  fill="hsl(var(--destructive)/0.2)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Errors by Function */}
        <Card>
          <CardHeader className="pb-2 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Errors by Function</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Which functions are failing most</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[160px] sm:h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={metrics?.errorsByFunction || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="function" type="category" width={80} className="text-xs" tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {(metrics?.errorsByFunction || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Error Categories */}
        <Card>
          <CardHeader className="pb-2 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Error Categories</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Common error patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[160px] sm:h-[200px]">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {(metrics?.errorCategories || []).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-xs sm:text-sm truncate flex-1">{cat.category}</span>
                      <Badge variant="outline" className="text-xs">{cat.count}</Badge>
                    </div>
                  ))}
                  {(!metrics?.errorCategories || metrics.errorCategories.length === 0) && (
                    <p className="text-center text-muted-foreground py-4 text-sm">No error categories</p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Error List with Filters */}
      <Card>
        <CardHeader className="pb-2 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            Error Log Browser
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Search and filter through all errors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search errors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-[130px]">
                  <Filter className="h-4 w-4 mr-1 sm:mr-2" />
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
              <Select value={functionFilter} onValueChange={setFunctionFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Function" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  {uniqueFunctions.map(fn => (
                    <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error List */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredErrors.map((error) => {
                  const severity = getSeverity(error.error_message);
                  const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.error;
                  const isExpanded = expandedError === error.id;
                  
                  return (
                    <div 
                      key={error.id} 
                      className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedError(isExpanded ? null : error.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-1.5 rounded ${config.color}/10`}>
                            <config.icon className={`h-4 w-4 text-${severity === 'critical' ? 'red' : severity === 'warning' ? 'yellow' : 'orange'}-500`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{error.function_name}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(error.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className={`text-sm font-mono ${isExpanded ? '' : 'truncate'}`}>
                              {error.error_message}
                            </p>
                            {isExpanded && (
                              <div className="mt-2 p-2 rounded bg-muted/50 text-xs space-y-1">
                                <p><strong>Response Time:</strong> {error.response_time_ms || 'N/A'}ms</p>
                                <p><strong>Model:</strong> {error.model_used || 'N/A'}</p>
                                <p><strong>Timestamp:</strong> {error.created_at}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredErrors.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No errors found matching your filters</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <p className="text-xs text-muted-foreground text-center">
            Showing {filteredErrors.length} of {errorLogs?.length || 0} errors
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper to determine severity from error message
function getSeverity(message: string | null): string {
  if (!message) return 'error';
  const lower = message.toLowerCase();
  if (lower.includes('critical') || lower.includes('fatal') || lower.includes('crash')) return 'critical';
  if (lower.includes('warning') || lower.includes('deprecat')) return 'warning';
  return 'error';
}

// Calculate error metrics
function calculateErrorMetrics(logs: any[]) {
  const totalErrors = logs.length;
  const now = new Date();
  const last24h = logs.filter(l => new Date(l.created_at) > new Date(now.getTime() - 24 * 60 * 60 * 1000)).length;

  // Error trend (last 7 days)
  const errorTrend = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    
    const errors = logs.filter(l => {
      const t = new Date(l.created_at);
      return t >= dayStart && t < dayEnd;
    }).length;
    
    errorTrend.push({
      date: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      errors,
    });
  }

  // Errors by function
  const functionCounts: Record<string, number> = {};
  logs.forEach(l => {
    const fn = l.function_name || 'unknown';
    functionCounts[fn] = (functionCounts[fn] || 0) + 1;
  });
  const errorsByFunction = Object.entries(functionCounts)
    .map(([fn, count]) => ({ function: fn.replace(/-/g, ' '), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const mostAffectedFunction = errorsByFunction[0]?.function || 'N/A';

  // Error categories (group by first few words)
  const categoryCounts: Record<string, number> = {};
  logs.forEach(l => {
    if (l.error_message) {
      // Extract first 5 words or key phrase
      const category = l.error_message.split(/[\s:]/g).slice(0, 4).join(' ').substring(0, 40);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
  });
  const errorCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Error rate (need total calls for this)
  const errorRate = 0; // Would need total calls to calculate

  return {
    totalErrors,
    errorsLast24h: last24h,
    errorRate,
    mostAffectedFunction,
    errorTrend,
    errorsByFunction,
    errorCategories,
  };
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  loading,
  variant,
  isText
}: { 
  title: string; 
  value: string | number; 
  icon: React.ComponentType<{ className?: string }>; 
  loading: boolean;
  variant?: 'destructive';
  isText?: boolean;
}) {
  return (
    <Card className={variant === 'destructive' ? 'border-destructive/30' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className={`h-4 w-4 ${variant === 'destructive' ? 'text-destructive' : ''}`} />
          <span className="text-sm">{title}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className={`${isText ? 'text-lg' : 'text-2xl'} font-bold ${variant === 'destructive' ? 'text-destructive' : ''}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
