import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Heart, BookOpen, Target, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ProgressCharts } from "@/components/progress/ProgressCharts";
import BiometricTrendsChart from "@/components/BiometricTrendsChart";
import { PageHeader } from "@/components/layout/PageHeader";

const RELAPSES_PER_PAGE = 5;

const Progress = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [relapseDialogOpen, setRelapseDialogOpen] = useState(false);
  const [relapseCurrentPage, setRelapseCurrentPage] = useState(1);

  const { data: checkIns } = useQuery({
    queryKey: ["progress-check-ins"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("check_ins")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: journalEntries } = useQuery({
    queryKey: ["progress-journal"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const { data: goals } = useQuery({
    queryKey: ["progress-goals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data;
    },
  });

  // Fetch all relapses for the dialog with pagination
  const { data: allRelapses } = useQuery({
    queryKey: ["progress-all-relapses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("relapses")
        .select("*")
        .eq("user_id", user.id)
        .order("relapse_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Get latest relapse for summary view
  const latestRelapse = allRelapses?.[0];
  const totalRelapses = allRelapses?.length || 0;
  const totalRelapsePages = Math.ceil(totalRelapses / RELAPSES_PER_PAGE);
  const paginatedRelapses = allRelapses?.slice(
    (relapseCurrentPage - 1) * RELAPSES_PER_PAGE,
    relapseCurrentPage * RELAPSES_PER_PAGE
  ) || [];

  // Calendar heatmap
  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getDayInfo = (day: Date) => {
    const hasCheckIn = checkIns?.some((checkIn) =>
      isSameDay(new Date(checkIn.created_at), day)
    );
    const hasRelapse = allRelapses?.some((relapse) =>
      isSameDay(new Date(relapse.relapse_date), day)
    );
    const dayGoals = goals?.filter(
      (g) =>
        g.start_date &&
        g.end_date &&
        new Date(g.start_date) <= day &&
        new Date(g.end_date) >= day
    );

    return { hasCheckIn, hasRelapse, dayGoals };
  };

  const getDayData = (day: Date) => {
    const dayCheckIns = checkIns?.filter((c) =>
      isSameDay(new Date(c.created_at), day)
    );
    const dayJournal = journalEntries?.filter((j) =>
      isSameDay(new Date(j.created_at), day)
    );
    const dayRelapses = allRelapses?.filter((r) =>
      isSameDay(new Date(r.relapse_date), day)
    );
    const dayGoals = goals?.filter(
      (g) =>
        g.start_date &&
        g.end_date &&
        new Date(g.start_date) <= day &&
        new Date(g.end_date) >= day
    );

    return { dayCheckIns, dayJournal, dayRelapses, dayGoals };
  };

  const completedGoals = goals?.filter((g) => g.completed).length || 0;
  const totalGoals = goals?.length || 0;
  const weeklyCheckIns =
    checkIns?.filter((c) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(c.created_at) > weekAgo;
    }).length || 0;

  return (
    <div className="flex-1 bg-gradient-calm min-h-screen">
      <PageHeader title="Progress" />

      <main className="container mx-auto px-4 py-8 max-w-6xl animate-fade-in space-y-6">
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold mb-2">Progress & History</h1>
          <p className="text-muted-foreground">Your recovery journey visualized</p>
        </div>

        {/* Advanced Insights */}
        <ProgressCharts />
        
        {/* Biometric Trends */}
        <BiometricTrendsChart />

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-card/50 backdrop-blur-lg border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="h-4 w-4 text-success" />
                Check-ins This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{weeklyCheckIns}</div>
              <p className="text-xs text-muted-foreground mt-1">Keep tracking your mood</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-lg border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Goals Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {completedGoals}/{totalGoals}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Goals completed</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-lg border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-accent" />
                Journal Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{journalEntries?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Recent entries</p>
            </CardContent>
          </Card>
        </div>

        {/* Interactive Check-in Calendar Heatmap */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Interactive Calendar
                </CardTitle>
                <CardDescription className="mt-1">
                  Click on any day to see details. Green = Check-in, Red = Relapse, Blue border = Active goal
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium min-w-[120px] text-center">
                  {format(currentMonth, "MMMM yyyy")}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs text-muted-foreground font-medium">
                  {day}
                </div>
              ))}
              {monthDays.map((day, idx) => {
                const { hasCheckIn, hasRelapse, dayGoals } = getDayInfo(day);
                const hasGoals = dayGoals && dayGoals.length > 0;
                
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs transition-all hover:scale-105 hover:shadow-lg ${
                      hasRelapse
                        ? "bg-destructive text-destructive-foreground font-bold"
                        : hasCheckIn
                        ? "bg-success text-success-foreground font-medium"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    } ${hasGoals ? "ring-2 ring-primary ring-offset-1" : ""}`}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Latest Relapse */}
        {latestRelapse && (
          <Card className="bg-card/50 backdrop-blur-lg border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Latest Relapse
              </CardTitle>
              <CardDescription>Learning from setbacks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{format(new Date(latestRelapse.relapse_date), "PPP")}</p>
                    {latestRelapse.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{latestRelapse.notes}</p>
                    )}
                    {latestRelapse.triggers && latestRelapse.triggers.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {latestRelapse.triggers.map((trigger: string, idx: number) => (
                          <Badge key={idx} variant="destructive" className="text-xs">
                            {trigger}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {totalRelapses > 1 && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setRelapseCurrentPage(1);
                    setRelapseDialogOpen(true);
                  }}
                >
                  See All Relapses ({totalRelapses})
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Journal Entries */}
        {journalEntries && journalEntries.length > 0 && (
          <Card className="bg-card/50 backdrop-blur-lg border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Recent Journal Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {journalEntries.map((entry) => (
                  <div key={entry.id} className="p-3 bg-muted/30 rounded-lg">
                    <p className="font-medium">{entry.title || "Untitled"}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{entry.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(entry.created_at), "PPp")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Day Details Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="bg-card/90 backdrop-blur-2xl border-border/40 max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, "PPPP")}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDate && (() => {
            const { dayCheckIns, dayJournal, dayRelapses, dayGoals } = getDayData(selectedDate);
            const hasActivity = 
              (dayCheckIns && dayCheckIns.length > 0) ||
              (dayJournal && dayJournal.length > 0) ||
              (dayRelapses && dayRelapses.length > 0) ||
              (dayGoals && dayGoals.length > 0);

            return (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {!hasActivity && (
                  <p className="text-muted-foreground text-center py-8">No activity recorded for this day</p>
                )}

                {/* Check-ins */}
                {dayCheckIns && dayCheckIns.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Check-ins ({dayCheckIns.length})
                    </h3>
                    {dayCheckIns.map((checkIn) => (
                      <Card key={checkIn.id} className="bg-success/5 border-success/20">
                        <CardContent className="pt-4">
                          <div className="flex gap-2 flex-wrap mb-2">
                            {checkIn.mood && <Badge variant="outline">Mood: {checkIn.mood}</Badge>}
                            {checkIn.urge_intensity !== null && (
                              <Badge variant="outline">Urge: {checkIn.urge_intensity}/10</Badge>
                            )}
                          </div>
                          {checkIn.notes && <p className="text-sm">{checkIn.notes}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Journal Entries */}
                {dayJournal && dayJournal.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-accent" />
                      Journal Entries ({dayJournal.length})
                    </h3>
                    {dayJournal.map((entry) => (
                      <Card key={entry.id} className="bg-accent/5 border-accent/20">
                        <CardContent className="pt-4">
                          <p className="font-medium mb-1">{entry.title || "Untitled"}</p>
                          <p className="text-sm text-muted-foreground">{entry.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Relapses */}
                {dayRelapses && dayRelapses.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      Relapses ({dayRelapses.length})
                    </h3>
                    {dayRelapses.map((relapse) => (
                      <Card key={relapse.id} className="bg-destructive/5 border-destructive/20">
                        <CardContent className="pt-4">
                          {relapse.notes && <p className="text-sm">{relapse.notes}</p>}
                          {relapse.triggers && relapse.triggers.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-2">
                              {relapse.triggers.map((trigger: string, idx: number) => (
                                <Badge key={idx} variant="destructive">
                                  {trigger}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Active Goals */}
                {dayGoals && dayGoals.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Active Goals ({dayGoals.length})
                    </h3>
                    {dayGoals.map((goal) => (
                      <Card key={goal.id} className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-4">
                          <p className="font-medium">{goal.title}</p>
                          {goal.description && (
                            <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                          )}
                          <Badge className="mt-2" variant={goal.completed ? "default" : "outline"}>
                            {goal.completed ? "Completed" : "In Progress"}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Relapse History Dialog */}
      <Dialog open={relapseDialogOpen} onOpenChange={setRelapseDialogOpen}>
        <DialogContent className="bg-card/90 backdrop-blur-2xl border-border/40 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Relapse History
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {paginatedRelapses.map((relapse) => (
              <div
                key={relapse.id}
                className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
              >
                <p className="font-medium">{format(new Date(relapse.relapse_date), "PPP")}</p>
                {relapse.notes && (
                  <p className="text-sm text-muted-foreground mt-1">{relapse.notes}</p>
                )}
                {relapse.triggers && relapse.triggers.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {relapse.triggers.map((trigger: string, idx: number) => (
                      <Badge key={idx} variant="destructive" className="text-xs">
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalRelapsePages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRelapseCurrentPage((p) => Math.max(1, p - 1))}
                disabled={relapseCurrentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {relapseCurrentPage} of {totalRelapsePages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRelapseCurrentPage((p) => Math.min(totalRelapsePages, p + 1))}
                disabled={relapseCurrentPage === totalRelapsePages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Progress;
