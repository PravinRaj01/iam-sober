import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, User, Shield, LogOut, Sparkles, Info, RefreshCw, Trash2, AlertTriangle, Gamepad2, CheckCircle2, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useBackground } from "@/contexts/BackgroundContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/PageHeader";
import SidebarOrderEditor from "@/components/SidebarOrderEditor";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const TAP_THRESHOLD = 10; // Number of taps needed on mobile/tablet
const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setBackgroundImage: setGlobalBackground } = useBackground();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pseudonym, setPseudonym] = useState("");
  const [addictionType, setAddictionType] = useState<string>("");
  const [konamiProgress, setKonamiProgress] = useState<string[]>([]);
  const [konamiIndicator, setKonamiIndicator] = useState<number>(0);
  const [tapCount, setTapCount] = useState<number>(0);
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  
  // Notification settings
  const [dailyReminder, setDailyReminder] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState("09:00");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [weeklyReportDay, setWeeklyReportDay] = useState("monday");
  const [milestoneAlerts, setMilestoneAlerts] = useState(true);
  const [supporterUpdates, setSupporterUpdates] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);

  // Common timezones list
  const COMMON_TIMEZONES = [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Anchorage", label: "Alaska Time" },
    { value: "Pacific/Honolulu", label: "Hawaii Time" },
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris (CET)" },
    { value: "Europe/Berlin", label: "Berlin (CET)" },
    { value: "Asia/Dubai", label: "Dubai (GST)" },
    { value: "Asia/Kolkata", label: "India (IST)" },
    { value: "Asia/Singapore", label: "Singapore (SGT)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "China (CST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST)" },
    { value: "Australia/Perth", label: "Perth (AWST)" },
    { value: "Pacific/Auckland", label: "Auckland (NZST)" },
    { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
    { value: "Africa/Lagos", label: "Lagos (WAT)" },
    { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
    { value: "America/Mexico_City", label: "Mexico City (CST)" },
  ];

  // Privacy settings
  const [shareJournal, setShareJournal] = useState(false);
  const [shareCheckIns, setShareCheckIns] = useState(false);
  const [shareMilestones, setShareMilestones] = useState(true);

  // Push notifications hook
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  // Check if dev tools are unlocked
  const isDevUnlocked = localStorage.getItem('devToolsUnlocked') === 'true';

  // Konami code listener - desktop only (keyboard required)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only process keyboard Konami code on desktop (non-touch primary devices)
    const key = event.key;
    
    setKonamiProgress(prev => {
      const newProgress = [...prev, key].slice(-10);
      
      // Check if the sequence matches so far
      const isOnTrack = newProgress.every((k, i) => k === KONAMI_CODE[i]);
      
      if (!isOnTrack) {
        setKonamiIndicator(0);
        return [];
      }
      
      // Update visual indicator
      setKonamiIndicator(newProgress.length);
      
      if (newProgress.length === KONAMI_CODE.length) {
        // Konami code complete!
        localStorage.setItem('devToolsUnlocked', 'true');
        window.dispatchEvent(new Event('storage')); // Notify sidebar
        toast({
          title: "🎮 Developer Mode Unlocked!",
          description: "You found the secret! AI Insights is now accessible.",
        });
        setKonamiIndicator(0);
        navigate('/ai-observability');
        return [];
      }
      
      return newProgress;
    });
  }, [toast, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const { data: profile, refetch, isLoading, error } = useQuery({
    queryKey: ["settings-profile"],
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        navigate("/auth");
        return null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setPseudonym(data.pseudonym || "");
        setAddictionType(data.addiction_type || "");
        const privacy = data.privacy_settings as any;
        if (privacy) {
          setShareJournal(privacy.share_journal || false);
          setShareCheckIns(privacy.share_check_ins || false);
          setShareMilestones(privacy.share_milestones || false);
        }
        // Load notification preferences
        const notifPrefs = (data as any).notification_preferences as any;
        if (notifPrefs) {
          setDailyReminder(notifPrefs.daily_reminder ?? true);
          setDailyReminderTime(notifPrefs.daily_reminder_time || "09:00");
          setTimezone(notifPrefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
          setWeeklyReport(notifPrefs.weekly_report ?? true);
          setWeeklyReportDay(notifPrefs.weekly_report_day || "monday");
          setMilestoneAlerts(notifPrefs.milestone_alerts ?? true);
          setSupporterUpdates(notifPrefs.supporter_updates ?? false);
        }
      }
      
      return data;
    },
    retry: false,
  });

  // Handle auth errors by redirecting
  if (error && error.message.includes("auth")) {
    navigate("/auth");
    return null;
  }


  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          pseudonym: pseudonym.trim() || null,
          addiction_type: addictionType || null,
          privacy_settings: {
            share_journal: shareJournal,
            share_check_ins: shareCheckIns,
            share_milestones: shareMilestones,
          },
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Settings updated!",
        description: "Your preferences have been saved.",
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotificationPrefs = async () => {
    setNotificationLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          notification_preferences: {
            daily_reminder: dailyReminder,
            daily_reminder_time: dailyReminderTime,
            timezone: timezone,
            weekly_report: weeklyReport,
            weekly_report_day: weeklyReportDay,
            milestone_alerts: milestoneAlerts,
            supporter_updates: supporterUpdates,
          },
        } as any)
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Notification preferences saved!",
        description: "Your notification settings have been updated.",
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setNotificationLoading(false);
    }
  };



  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleResetAccount = async () => {
    setResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-data", {
        body: {},
      });

      if (error) {
        // Try to surface the edge function's JSON error message
        let message = error.message;
        try {
          const ctx = (error as any).context as Response | undefined;
          if (ctx) {
            const json = await ctx.json().catch(() => null);
            if (json?.error) message = json.error;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      // Invalidate all queries
      queryClient.invalidateQueries();

      toast({
        title: "Account Reset",
        description: "Your account has been reset. Starting fresh!",
      });

      // Send user straight into onboarding (no need to wait for another navigation)
      navigate("/onboarding", { replace: true });

      refetch();
      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete all user data first (child tables with foreign keys)
      await Promise.all([
        supabase.from("community_comments").delete().eq("user_id", user.id),
        supabase.from("community_reactions").delete().eq("user_id", user.id),
        supabase.from("goal_completions").delete().eq("user_id", user.id),
      ]);

      // Then delete parent tables
      await Promise.all([
        supabase.from("check_ins").delete().eq("user_id", user.id),
        supabase.from("journal_entries").delete().eq("user_id", user.id),
        supabase.from("goals").delete().eq("user_id", user.id),
        supabase.from("user_achievements").delete().eq("user_id", user.id),
        supabase.from("coping_activities").delete().eq("user_id", user.id),
        supabase.from("relapses").delete().eq("user_id", user.id),
        supabase.from("triggers").delete().eq("user_id", user.id),
        supabase.from("motivations").delete().eq("user_id", user.id),
        supabase.from("reflections").delete().eq("user_id", user.id),
        supabase.from("supporters").delete().eq("user_id", user.id),
        supabase.from("community_interactions").delete().eq("user_id", user.id),
        supabase.from("chat_messages").delete().eq("user_id", user.id),
        supabase.from("conversations").delete().eq("user_id", user.id),
        supabase.from("biometric_logs").delete().eq("user_id", user.id),
        supabase.from("ai_interventions").delete().eq("user_id", user.id),
        supabase.from("ai_observability_logs").delete().eq("user_id", user.id),
        supabase.from("push_subscriptions").delete().eq("user_id", user.id),
        supabase.from("online_members").delete().eq("user_id", user.id),
        supabase.from("profiles").delete().eq("id", user.id),
      ]);

      // Sign out and redirect
      await supabase.auth.signOut();
      
      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently deleted.",
      });
      
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  // Handle tap easter egg for mobile/tablet
  const handleEasterEggTap = useCallback(() => {
    const now = Date.now();
    
    // Reset if more than 2 seconds between taps
    if (now - lastTapTime > 2000) {
      setTapCount(1);
    } else {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      
      if (newCount >= TAP_THRESHOLD) {
        // Easter egg complete!
        localStorage.setItem('devToolsUnlocked', 'true');
        window.dispatchEvent(new Event('storage'));
        toast({
          title: "🎮 Developer Mode Unlocked!",
          description: "You found the secret! AI Insights is now accessible.",
        });
        setTapCount(0);
        navigate('/ai-observability');
      }
    }
    
    setLastTapTime(now);
  }, [tapCount, lastTapTime, toast, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <main className="container mx-auto px-4 py-8 max-w-3xl animate-fade-in space-y-6">

        {/* Profile Settings */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Manage your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pseudonym">Display Name / Pseudonym</Label>
              <Input
                id="pseudonym"
                placeholder="How you want to be called"
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This name will be visible to supporters you invite
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addiction">Primary Recovery Focus</Label>
              <Select value={addictionType} onValueChange={setAddictionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your focus area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alcohol">Alcohol</SelectItem>
                  <SelectItem value="drugs">Drugs</SelectItem>
                  <SelectItem value="smoking">Smoking</SelectItem>
                  <SelectItem value="pornography">Pornography</SelectItem>
                  <SelectItem value="gambling">Gambling</SelectItem>
                  <SelectItem value="gaming">Gaming</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This helps personalize motivational content
              </p>
            </div>

            <Button onClick={handleUpdateProfile} disabled={loading}>
              Save Profile
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Configure your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Daily Check-in Reminder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Check-in Reminder</Label>
                  <p className="text-sm text-muted-foreground">Get reminded to log your daily check-in</p>
                </div>
                <Switch checked={dailyReminder} onCheckedChange={setDailyReminder} />
              </div>
              {dailyReminder && (
                <div className="ml-4 pl-4 border-l-2 border-border space-y-3">
                  <div>
                    <Label className="text-sm">Reminder Time</Label>
                    <Select value={dailyReminderTime} onValueChange={setDailyReminderTime}>
                      <SelectTrigger className="w-32 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="06:00">6:00 AM</SelectItem>
                        <SelectItem value="07:00">7:00 AM</SelectItem>
                        <SelectItem value="08:00">8:00 AM</SelectItem>
                        <SelectItem value="09:00">9:00 AM</SelectItem>
                        <SelectItem value="10:00">10:00 AM</SelectItem>
                        <SelectItem value="12:00">12:00 PM</SelectItem>
                        <SelectItem value="18:00">6:00 PM</SelectItem>
                        <SelectItem value="20:00">8:00 PM</SelectItem>
                        <SelectItem value="21:00">9:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Your Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Weekly Progress Report */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Progress Report</Label>
                  <p className="text-sm text-muted-foreground">Receive a summary of your week</p>
                </div>
                <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} />
              </div>
              {weeklyReport && (
                <div className="ml-4 pl-4 border-l-2 border-border">
                  <Label className="text-sm">Report Day</Label>
                  <Select value={weeklyReportDay} onValueChange={setWeeklyReportDay}>
                    <SelectTrigger className="w-32 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Milestone Alerts</Label>
                <p className="text-sm text-muted-foreground">Celebrate when you reach milestones</p>
              </div>
              <Switch checked={milestoneAlerts} onCheckedChange={setMilestoneAlerts} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Supporter Updates</Label>
                <p className="text-sm text-muted-foreground">Notify when supporters send messages</p>
              </div>
              <Switch checked={supporterUpdates} onCheckedChange={setSupporterUpdates} />
            </div>

            <Separator />

            {/* Push Notifications Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    Push Notifications
                    {isSubscribed && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isSupported 
                      ? "Enable to receive all the above notifications" 
                      : "Not supported in this browser"}
                  </p>
                </div>
                <Switch 
                  checked={isSubscribed} 
                  onCheckedChange={handlePushToggle}
                  disabled={!isSupported || pushLoading}
                />
              </div>
              
              {isSupported && !isSubscribed && (
                <Button 
                  onClick={subscribe} 
                  variant="outline" 
                  className="w-full"
                  disabled={pushLoading}
                >
                  {pushLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <Bell className="mr-2 h-4 w-4" />
                      Enable Push Notifications
                    </>
                  )}
                </Button>
              )}

              {isSubscribed && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm text-primary">
                    Push notifications are enabled. You'll receive the notifications you've enabled above.
                  </p>
                </div>
              )}
            </div>

            <Button 
              onClick={handleSaveNotificationPrefs} 
              disabled={notificationLoading}
              className="w-full"
            >
              {notificationLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Notification Preferences"
              )}
            </Button>
          </CardContent>
        </Card>


        {/* Privacy Settings */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy
            </CardTitle>
            <CardDescription>Control what supporters can see</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Share Journal Entries</Label>
                <p className="text-sm text-muted-foreground">Allow supporters to read your journal</p>
              </div>
              <Switch checked={shareJournal} onCheckedChange={setShareJournal} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Share Check-ins</Label>
                <p className="text-sm text-muted-foreground">Let supporters see your mood logs</p>
              </div>
              <Switch checked={shareCheckIns} onCheckedChange={setShareCheckIns} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Share Milestones</Label>
                <p className="text-sm text-muted-foreground">Show milestone achievements</p>
              </div>
              <Switch checked={shareMilestones} onCheckedChange={setShareMilestones} />
            </div>

            <Button onClick={handleUpdateProfile} disabled={loading}>
              Save Privacy Settings
            </Button>
          </CardContent>
        </Card>

        {/* Sidebar Order */}
        <SidebarOrderEditor />

        {/* AI Features Info */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Features
            </CardTitle>
            <CardDescription>
              Agentic AI recovery companion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your AI companion can take actions on your behalf:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Create goals</strong> - Just tell the AI your goals</li>
                  <li><strong>Log check-ins</strong> - Share how you're feeling</li>
                  <li><strong>Write journal entries</strong> - Speak your thoughts</li>
                  <li><strong>Track coping activities</strong> - Mention what helps you</li>
                  <li><strong>Analyze your progress</strong> - Ask about your journey</li>
                </ul>
                <p className="mt-2 text-sm text-muted-foreground">
                  The AI reads your data to give personalized support and can take action when you ask.
                </p>
              </AlertDescription>
            </Alert>
            
            {/* Hidden hint for developers - tap works on all devices */}
            <div 
              className="flex flex-col gap-2 mt-4 p-3 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 cursor-pointer select-none"
              onClick={handleEasterEggTap}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gamepad2 className="h-4 w-4" />
                <span className="font-medium">Easter Egg:</span>
                {/* Desktop: show Konami hint, but tapping also works */}
                <span className="hidden lg:inline">Try the Konami code or tap 10 times...</span>
                {/* Tablet & Mobile: tap only */}
                <span className="lg:hidden">Tap 10 times for luck...</span>
              </div>
              
              {/* Tap progress indicator - shows on all devices after 3 taps */}
              {tapCount >= 3 && (
                <div className="flex items-center gap-3 animate-fade-in">
                  <div className="flex items-center gap-1.5 p-2 rounded-full bg-primary/10 border border-primary/30">
                    <Gamepad2 className="h-4 w-4 text-primary" />
                    <div className="flex gap-0.5">
                      {Array.from({ length: TAP_THRESHOLD }).map((_, idx) => (
                        <div 
                          key={idx}
                          className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                            idx < tapCount 
                              ? 'bg-primary shadow-sm shadow-primary/50' 
                              : 'bg-muted-foreground/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-primary font-medium animate-pulse">
                    {tapCount}/{TAP_THRESHOLD}
                  </span>
                </div>
              )}
              
              {/* Konami progress indicator - desktop only, shows after 3 correct steps */}
              {konamiIndicator >= 3 && (
                <div className="hidden lg:flex items-center gap-3 animate-fade-in">
                  <div className="flex items-center gap-1.5 p-2 rounded-full bg-primary/10 border border-primary/30">
                    <Gamepad2 className="h-4 w-4 text-primary" />
                    <div className="flex gap-0.5">
                      {KONAMI_CODE.map((_, idx) => (
                        <div 
                          key={idx}
                          className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                            idx < konamiIndicator 
                              ? 'bg-primary shadow-sm shadow-primary/50' 
                              : 'bg-muted-foreground/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-primary font-medium animate-pulse">
                    {konamiIndicator}/10 (Konami)
                  </span>
                </div>
              )}
            </div>
            
            {/* Show dev tools controls if unlocked */}
            {isDevUnlocked && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">AI Insights Dashboard</Label>
                    <p className="text-xs text-muted-foreground">Monitor AI interactions and performance</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/ai-observability')}
                  >
                    Open
                  </Button>
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-destructive w-full justify-start"
                    >
                      Disable AI Insights access
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disable AI Insights?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will hide the AI Insights page from the sidebar. To re-enable it, you'll need to enter the Konami code again in Settings.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => {
                          localStorage.removeItem('devToolsUnlocked');
                          window.dispatchEvent(new Event('storage'));
                          toast({
                            title: "AI Insights disabled",
                            description: "Enter the Konami code to unlock it again.",
                          });
                        }}
                        className="w-full sm:w-auto"
                      >
                        Disable
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reset Account */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-amber-600 border-amber-600/50 hover:bg-amber-600/10">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Account (Start Fresh)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Reset Your Account?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset all your progress including:
                    <ul className="list-disc list-inside mt-2 space-y-1 text-left">
                      <li>Your sobriety streak</li>
                      <li>All check-ins and journal entries</li>
                      <li>Goals and achievements</li>
                      <li>XP and level progress</li>
                      <li>Community posts</li>
                    </ul>
                    <p className="mt-3 font-medium">Your account will remain active but start from scratch.</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetAccount} 
                    disabled={resetLoading}
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
                  >
                    {resetLoading ? "Resetting..." : "Yes, Reset Everything"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete Account */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive border-destructive/50 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account Permanently
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="h-5 w-5" />
                    Delete Your Account?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    <span className="font-bold text-destructive">This action cannot be undone.</span>
                    <br /><br />
                    This will permanently delete:
                    <ul className="list-disc list-inside mt-2 space-y-1 text-left">
                      <li>Your account and profile</li>
                      <li>All recovery data and history</li>
                      <li>Journal entries and check-ins</li>
                      <li>Goals, achievements, and progress</li>
                      <li>Community posts and interactions</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount} 
                    disabled={deleteLoading}
                    className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
                  >
                    {deleteLoading ? "Deleting..." : "Yes, Delete Forever"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Separator />

            <Button onClick={handleSignOut} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
