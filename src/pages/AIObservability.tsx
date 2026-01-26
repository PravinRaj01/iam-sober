import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AICapabilitiesBadge from "@/components/AICapabilitiesBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { 
  Brain, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  BarChart3,
  Sparkles,
  MessageCircle,
  Heart,
  Target,
  Calendar,
  Bot,
  Wrench,
  Eye,
  Shield,
  Zap,
  Activity,
  AlertTriangle
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays, subDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

// Tool categories for the capabilities showcase (hidden easter egg)
const TOOL_CATEGORIES = {
  read: {
    title: "Read Tools",
    description: "Access and analyze user data",
    icon: Eye,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    tools: [
      { name: "get_user_progress", description: "Sobriety stats, streaks, level, XP" },
      { name: "get_recent_moods", description: "Check-in history and mood patterns" },
      { name: "get_active_goals", description: "Current goals and progress" },
      { name: "get_recent_journal_entries", description: "Journal excerpts and sentiment" },
      { name: "get_biometric_data", description: "Wearable health metrics" },
      { name: "get_conversation_context", description: "Past interaction summaries" },
    ]
  },
  write: {
    title: "Write Tools",
    description: "Take actions on behalf of users",
    icon: Wrench,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    tools: [
      { name: "create_goal", description: "Create recovery goals with confirmation" },
      { name: "create_check_in", description: "Log mood and urge check-ins" },
      { name: "create_journal_entry", description: "Save journal entries" },
      { name: "complete_goal", description: "Mark goals as completed" },
      { name: "log_coping_activity", description: "Track coping strategy usage" },
    ]
  },
  action: {
    title: "Action Tools",
    description: "Proactive support and planning",
    icon: Zap,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    tools: [
      { name: "suggest_coping_activity", description: "Context-aware coping suggestions" },
      { name: "create_action_plan", description: "Multi-step recovery planning" },
      { name: "escalate_crisis", description: "Emergency escalation with resources" },
    ]
  },
  meta: {
    title: "Meta Tools",
    description: "Observability and tracking",
    icon: Activity,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    tools: [
      { name: "log_intervention", description: "Track AI interventions for analytics" },
    ]
  }
};

const AGENT_FEATURES = [
  {
    title: "Autonomous Tool Selection",
    description: "Agent decides which tools to use based on context - no hardcoded rules",
    icon: Brain,
  },
  {
    title: "Multi-Step Reasoning",
    description: "Chains up to 5 tool calls to answer complex questions",
    icon: TrendingUp,
  },
  {
    title: "Pattern Recognition",
    description: "Identifies mood trends, risk patterns, and milestone approaches",
    icon: Sparkles,
  },
  {
    title: "Crisis Detection",
    description: "Real-time detection with automatic escalation and resources",
    icon: Shield,
  },
  {
    title: "Confirmation Flow",
    description: "Confirms before write actions to prevent accidental data creation",
    icon: CheckCircle2,
  },
  {
    title: "Proactive Interventions",
    description: "Reaches out when risk signals detected (missed check-ins, declining mood)",
    icon: Heart,
  }
];

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const AIObservability = () => {
  // Easter egg: show AI capabilities when Opik badge is clicked
  const [showCapabilities, setShowCapabilities] = useState(false);
  
  // AI Observability logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ["ai-observability-logs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("ai_observability_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: interventions } = useQuery({
    queryKey: ["ai-interventions-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("ai_interventions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Recovery insights data
  const { data: aiStats } = useQuery({
    queryKey: ["ai-recovery-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const weekAgo = subDays(new Date(), 7);
      const twoWeeksAgo = subDays(new Date(), 14);

      const { data: thisWeek } = await supabase
        .from("ai_observability_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", weekAgo.toISOString());

      const { data: lastWeek } = await supabase
        .from("ai_observability_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", twoWeeksAgo.toISOString())
        .lt("created_at", weekAgo.toISOString());

      const { data: chatMessages } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", weekAgo.toISOString());

      return {
        thisWeekCount: thisWeek?.length || 0,
        lastWeekCount: lastWeek?.length || 0,
        chatCount: chatMessages?.length || 0,
      };
    },
  });

  // Coping effectiveness
  const { data: copingData } = useQuery({
    queryKey: ["coping-effectiveness"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: activities } = await supabase
        .from("coping_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("times_used", { ascending: false })
        .limit(5);

      return activities || [];
    },
  });

  // User profile for days sober
  const { data: profile } = useQuery({
    queryKey: ["profile-insights"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      return data;
    },
  });

  // Compute simple metrics
  const totalCalls = logs?.length || 0;
  const avgResponseTime = logs?.length 
    ? Math.round(logs.reduce((acc, l) => acc + (l.response_time_ms || 0), 0) / logs.length)
    : 0;
  const errorCount = logs?.filter(l => l.error_message)?.length || 0;
  const successRate = totalCalls > 0 ? Math.round(((totalCalls - errorCount) / totalCalls) * 100) : 100;
  const weeklyChange = aiStats ? aiStats.thisWeekCount - aiStats.lastWeekCount : 0;
  const daysSober = profile?.sobriety_start_date 
    ? differenceInDays(new Date(), new Date(profile.sobriety_start_date))
    : 0;

  // Function distribution - top 5
  const functionCounts = (logs || []).reduce((acc: Record<string, number>, log) => {
    acc[log.function_name] = (acc[log.function_name] || 0) + 1;
    return acc;
  }, {});
  const functionChartData = Object.entries(functionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, calls]) => ({
      name: name.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      calls,
    }));

  // Response time trend - last 10
  const responseTimeData = logs?.slice(0, 10).reverse().map((log, index) => ({
    index: index + 1,
    time: log.response_time_ms || 0,
  })) || [];

  // Tool usage counts for capabilities view
  const toolCounts: Record<string, number> = {};
  (logs || []).forEach(log => {
    const tools = Array.isArray(log.tools_called) ? log.tools_called : [];
    tools.forEach((tool: string) => {
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    });
  });

  const callsWithTools = (logs || []).filter(l => Array.isArray(l.tools_called) && l.tools_called.length > 0).length;
  const autonomyRate = totalCalls > 0 ? Math.round((callsWithTools / totalCalls) * 100) : 0;

  // Tool usage pie chart data
  const toolUsageData = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count
    }));

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <PageHeader 
        title="AI Insights" 
        actions={
          <AICapabilitiesBadge onClick={() => setShowCapabilities(!showCapabilities)} />
        }
      />

      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Easter Egg: AI Capabilities Section */}
          {showCapabilities && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
              {/* Hero Section */}
              <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/30 overflow-hidden">
                <CardContent className="pt-8 pb-8">
                  <div className="flex flex-col md:flex-row items-start gap-6">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                      <Bot className="h-12 w-12 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h1 className="text-2xl md:text-3xl font-bold">
                          Fully Agentic AI Recovery Coach
                        </h1>
                        <Badge variant="secondary" className="text-xs">
                          🎉 Easter Egg!
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-4 max-w-2xl">
                        Powered by Llama 3.3 70B with ReAct (Reasoning + Acting) architecture. 
                        This agent autonomously decides when to read data, take actions, and provide proactive support.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          <Brain className="h-3 w-3 mr-1" />
                          15 Tools Available
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          5-Step Reasoning Chain
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Crisis Detection
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          Full Observability
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agent Features Grid */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Agentic Features
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {AGENT_FEATURES.map((feature) => (
                    <Card key={feature.title} className="hover:border-primary/50 transition-colors">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <feature.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm">{feature.title}</h3>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-600/30">
                                Active
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{feature.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Tool Categories */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Available Tools ({Object.values(TOOL_CATEGORIES).reduce((acc, cat) => acc + cat.tools.length, 0)})
                </h2>
                <Tabs defaultValue="read" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-4">
                    {Object.entries(TOOL_CATEGORIES).map(([key, category]) => (
                      <TabsTrigger key={key} value={key} className="text-xs md:text-sm">
                        <category.icon className="h-4 w-4 mr-1.5" />
                        <span className="hidden sm:inline">{category.title}</span>
                        <span className="sm:hidden">{key}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {Object.entries(TOOL_CATEGORIES).map(([key, category]) => (
                    <TabsContent key={key} value={key}>
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${category.bgColor}`}>
                              <category.icon className={`h-5 w-5 ${category.color}`} />
                            </div>
                            <div>
                              <CardTitle className="text-base">{category.title}</CardTitle>
                              <CardDescription className="text-xs">{category.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-2">
                            {category.tools.map((tool) => (
                              <div 
                                key={tool.name}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <code className="text-xs font-mono bg-background px-2 py-1 rounded">
                                    {tool.name}
                                  </code>
                                  <span className="text-sm text-muted-foreground hidden sm:inline">
                                    {tool.description}
                                  </span>
                                </div>
                                {toolCounts?.[tool.name] && (
                                  <Badge variant="secondary" className="text-xs">
                                    {toolCounts[tool.name]}x used
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* Tool Usage Chart */}
              {toolUsageData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Tool Usage Distribution
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Most frequently used tools in the last 7 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={toolUsageData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {toolUsageData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Architecture Diagram */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    ReAct Agent Architecture
                  </CardTitle>
                  <CardDescription className="text-xs">
                    How the AI agent processes requests and makes decisions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
                    {[
                      { step: 1, title: "User Message", icon: MessageCircle, desc: "Input received" },
                      { step: 2, title: "Reasoning", icon: Brain, desc: "Analyze intent" },
                      { step: 3, title: "Tool Selection", icon: Wrench, desc: "Choose tools" },
                      { step: 4, title: "Execution", icon: Zap, desc: "Call tools (1-5x)" },
                      { step: 5, title: "Response", icon: CheckCircle2, desc: "Synthesize answer" },
                    ].map((item, index, arr) => (
                      <div key={item.step} className="flex items-center gap-2">
                        <div className="flex flex-col items-center text-center">
                          <div className="p-3 rounded-xl bg-primary/10 mb-2">
                            <item.icon className="h-6 w-6 text-primary" />
                          </div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        {index < arr.length - 1 && (
                          <div className="hidden md:block text-muted-foreground">→</div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Safety Features */}
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    Safety Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { title: "Crisis Detection", desc: "Real-time keyword monitoring with automatic escalation" },
                      { title: "Confirmation Flow", desc: "User must confirm before any write actions execute" },
                      { title: "Full Observability", desc: "All interactions logged for transparency" },
                      { title: "Medical Boundaries", desc: "Clear disclaimers; always recommends professional help" },
                    ].map((item) => (
                      <div key={item.title} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Button 
                variant="outline" 
                onClick={() => setShowCapabilities(false)}
                className="w-full"
              >
                Hide AI Capabilities
              </Button>
            </div>
          )}

          {/* Recovery Summary */}
          <Card className="bg-gradient-to-r from-primary/10 to-green-500/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Your AI-Powered Recovery</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {aiStats?.thisWeekCount === 0 
                      ? "Start chatting with your AI coach to get personalized insights!"
                      : `This week, you used AI support ${aiStats?.thisWeekCount} times. ${
                          weeklyChange > 0 
                            ? `That's ${weeklyChange} more than last week!` 
                            : weeklyChange < 0
                              ? `You're using it less frequently - that could be a sign of growing confidence!`
                              : "Consistent engagement is key to recovery!"
                        }`
                    }
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-card/50 text-center">
                  <p className="text-2xl font-bold text-green-600">{daysSober}</p>
                  <p className="text-xs text-muted-foreground">Days Sober</p>
                </div>
                <div className="p-3 rounded-lg bg-card/50 text-center">
                  <p className="text-2xl font-bold text-primary">{aiStats?.thisWeekCount || 0}</p>
                  <p className="text-xs text-muted-foreground">AI Calls</p>
                </div>
                <div className="p-3 rounded-lg bg-card/50 text-center">
                  <p className="text-2xl font-bold text-amber-600">{aiStats?.chatCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Chats</p>
                </div>
                <div className="p-3 rounded-lg bg-card/50 text-center">
                  <p className="text-2xl font-bold text-purple-600">{interventions?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Check-ins</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total AI Calls</span>
                </div>
                <p className="text-2xl font-bold">{totalCalls}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-accent" />
                  <span className="text-xs text-muted-foreground">Avg Speed</span>
                </div>
                <p className="text-2xl font-bold">{avgResponseTime}ms</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Success</span>
                </div>
                <p className="text-2xl font-bold">{successRate}%</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Autonomy</span>
                </div>
                <p className="text-2xl font-bold">{autonomyRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Response Time Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Response Speed
                </CardTitle>
                <CardDescription className="text-xs">Last 10 AI calls (ms)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[180px]">
                  {responseTimeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={responseTimeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="index" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="time" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      No data yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Function Usage Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  AI Features Used
                </CardTitle>
                <CardDescription className="text-xs">Your most used AI features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[180px]">
                  {functionChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={functionChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={9}
                          width={80}
                          tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                        />
                        <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      No data yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coping Strategies */}
          {copingData && copingData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-primary" />
                  Your Top Coping Strategies
                </CardTitle>
                <CardDescription className="text-xs">Activities you've used most often</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {copingData.map((activity: any, index: number) => (
                    <div key={activity.id} className="flex items-center gap-4">
                      <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{activity.activity_name}</span>
                          <Badge variant="secondary" className="text-xs">{activity.category}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={(activity.times_used / (copingData[0]?.times_used || 1)) * 100} className="h-2" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {activity.times_used}x
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4 text-primary" />
                Recent AI Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : logs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No AI activity yet</p>
                  <p className="text-xs mt-1">Start chatting with your AI coach!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs?.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${log.error_message ? 'bg-destructive' : 'bg-green-500'}`} />
                        <span className="text-sm font-medium truncate">
                          {log.function_name.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{log.response_time_ms}ms</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Proactive Check-ins */}
          {interventions && interventions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  AI Proactive Check-ins
                </CardTitle>
                <CardDescription className="text-xs">Times your AI coach reached out</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {interventions.slice(0, 3).map((intervention) => (
                    <div key={intervention.id} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm line-clamp-2">{intervention.message}</p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {intervention.trigger_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(intervention.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hint about easter egg */}
          {!showCapabilities && (
            <p className="text-xs text-center text-muted-foreground">
              💡 Tip: Click the "Powered by Opik" badge to discover the AI's hidden capabilities!
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default AIObservability;
