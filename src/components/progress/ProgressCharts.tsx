import { useEffect, useRef, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { Chart } from "chart.js/auto";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Brain, Calendar as CalendarIcon, Target, TrendingUp, CalendarDays, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface ProgressData {
  date: string;
  mood: number;
  stress: number;
  goals_completed: number;
  urge_intensity: number;
}

type FilterType = "7days" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

export function ProgressCharts() {
  const [activeTab, setActiveTab] = useState("emotions");
  const [filterType, setFilterType] = useState<FilterType>("thisMonth");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const chartRef = useRef<Chart | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Memoize date range calculation to prevent infinite re-renders
  const dateRangeQuery = useMemo(() => {
    const now = new Date();
    switch (filterType) {
      case "7days":
        return {
          start: subDays(now, 7).toISOString(),
          end: now.toISOString(),
        };
      case "thisMonth":
        return {
          start: startOfMonth(now).toISOString(),
          end: endOfMonth(now).toISOString(),
        };
      case "lastMonth":
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return {
          start: startOfMonth(lastMonth).toISOString(),
          end: endOfMonth(lastMonth).toISOString(),
        };
      case "thisYear":
        return {
          start: startOfYear(now).toISOString(),
          end: endOfYear(now).toISOString(),
        };
      case "custom":
        if (customDateRange?.from && customDateRange?.to) {
          return {
            start: customDateRange.from.toISOString(),
            end: customDateRange.to.toISOString(),
          };
        }
        // Default to this month if custom range not set
        return {
          start: startOfMonth(now).toISOString(),
          end: endOfMonth(now).toISOString(),
        };
      default:
        return {
          start: startOfMonth(now).toISOString(),
          end: endOfMonth(now).toISOString(),
        };
    }
  }, [filterType, customDateRange]);

  const { data: checkIns } = useQuery({
    queryKey: ["insights-check-ins", dateRangeQuery.start, dateRangeQuery.end],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("check_ins")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", dateRangeQuery.start)
        .lte("created_at", dateRangeQuery.end)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: journalSentiments } = useQuery({
    queryKey: ["insights-sentiments", dateRangeQuery.start, dateRangeQuery.end],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("journal_entries")
        .select("created_at, sentiment")
        .eq("user_id", user.id)
        .gte("created_at", dateRangeQuery.start)
        .lte("created_at", dateRangeQuery.end)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: goals } = useQuery({
    queryKey: ["insights-goals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const createChart = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Destroy any existing chart on the canvas before creating a new one
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      const existingChart = Chart.getChart(canvas);
      if (existingChart) {
        existingChart.destroy();
      }

      let chartConfig: any = null;

      if (activeTab === "emotions" && checkIns) {
        const labels = checkIns.map(ci => format(new Date(ci.created_at), "MMM d"));
        const moodMap: Record<string, number> = {
          'great': 10, 'good': 8, 'okay': 5, 'struggling': 3, 'bad': 1
        };
        const moodData = checkIns.map(ci => moodMap[ci.mood] || 5);
        const urgeData = checkIns.map(ci => ci.urge_intensity || 0);

        chartConfig = {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Mood",
                data: moodData,
                borderColor: "hsl(var(--primary))",
                tension: 0.4,
                fill: false,
              },
              {
                label: "Urge Intensity",
                data: urgeData,
                borderColor: "hsl(var(--warning))",
                tension: 0.4,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { min: 0, max: 10, grid: { color: "rgba(255, 255, 255, 0.1)" } },
              x: { grid: { display: false } },
            },
          },
        };
      } else if (activeTab === "urges" && checkIns) {
        const labels = checkIns.map(ci => format(new Date(ci.created_at), "MMM d"));
        const urgeData = checkIns.map(ci => ci.urge_intensity || 0);

        chartConfig = {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Urge Intensity",
                data: urgeData,
                backgroundColor: "hsl(var(--warning) / 0.5)",
                borderColor: "hsl(var(--warning))",
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, max: 10, grid: { color: "rgba(255, 255, 255, 0.1)" } },
              x: { grid: { display: false } },
            },
          },
        };
      } else if (activeTab === "goals" && goals) {
        const completedOverTime = goals.reduce((acc: number[], goal) => {
          const lastValue = acc.length > 0 ? acc[acc.length - 1] : 0;
          return [...acc, goal.completed ? lastValue + 1 : lastValue];
        }, []);

        chartConfig = {
          type: "line",
          data: {
            labels: goals.map(g => format(new Date(g.created_at), "MMM d")),
            datasets: [
              {
                label: "Completed Goals",
                data: completedOverTime,
                borderColor: "hsl(var(--success))",
                backgroundColor: "hsl(var(--success) / 0.1)",
                tension: 0.4,
                fill: true,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, grid: { color: "rgba(255, 255, 255, 0.1)" } },
              x: { grid: { display: false } },
            },
          },
        };
      }

      if (chartConfig) {
        requestAnimationFrame(() => {
          if (canvasRef.current) {
            chartRef.current = new Chart(canvasRef.current, chartConfig);
          }
        });
      }
    };

    createChart();

    // Cleanup function to destroy the chart on component unmount or before re-render
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [activeTab, checkIns, goals, dateRangeQuery]);

  const renderContent = () => {
    const hasData = (activeTab === 'emotions' && checkIns && checkIns.length > 0) ||
                    (activeTab === 'urges' && checkIns && checkIns.length > 0) ||
                    (activeTab === 'goals' && goals && goals.length > 0);
    
    const noDataMessage = activeTab === 'goals' ? 'No goals to display yet' : 'No check-ins to display yet';

    return hasData ? (
      <div className="relative w-full h-[300px] sm:h-[350px]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"></canvas>
      </div>
    ) : (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {noDataMessage}
      </div>
    );
  };

  return (
    <Card className="bg-card/50 backdrop-blur-lg border-border/50">
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Advanced Insights
            </CardTitle>
            <CardDescription className="mt-1">
              Analyze patterns in your recovery journey
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
              <SelectTrigger className="w-[160px] bg-card backdrop-blur-sm border-border/50">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover backdrop-blur-xl border-border/50 z-50">
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {filterType === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                    <CalendarDays className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {customDateRange?.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, "MMM d")} - {format(customDateRange.to, "MMM d")}
                          </>
                        ) : (
                          format(customDateRange.from, "MMM d, yyyy")
                        )
                      ) : (
                        "Select dates"
                      )}
                    </span>
                    <span className="sm:hidden">Dates</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover backdrop-blur-xl border-border/50 z-50" align="end">
                  <Calendar
                    mode="range"
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={1}
                    className={cn("p-3 pointer-events-auto")}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full grid grid-cols-3 gap-2 h-auto bg-muted/50 p-1">
            <TabsTrigger value="emotions" className="flex items-center justify-center gap-2 whitespace-nowrap px-2 py-2 data-[state=active]:bg-background">
              <Brain className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline truncate">Emotional State</span>
              <span className="md:hidden truncate">Emotions</span>
            </TabsTrigger>
            <TabsTrigger value="urges" className="flex items-center justify-center gap-2 whitespace-nowrap px-2 py-2 data-[state=active]:bg-background">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline truncate">Urge Tracking</span>
              <span className="md:hidden truncate">Urges</span>
            </TabsTrigger>
            <TabsTrigger value="goals" className="flex items-center justify-center gap-2 whitespace-nowrap px-2 py-2 data-[state=active]:bg-background">
              <Target className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline truncate">Goals Progress</span>
              <span className="md:hidden truncate">Goals</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emotions" className="space-y-4">
            {renderContent()}
          </TabsContent>

          <TabsContent value="urges" className="space-y-4">
            {renderContent()}
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            {renderContent()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}