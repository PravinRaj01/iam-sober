import { useState, useEffect, useCallback } from "react";
import { TimePickerWheel } from "@/components/ui/time-picker-wheel";
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
import { Bell, User, Shield, LogOut, Sparkles, Info, RefreshCw, Trash2, AlertTriangle, Gamepad2, CheckCircle2, Loader2, Globe, Brain, Moon, MessageCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useBackground } from "@/contexts/BackgroundContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/PageHeader";
import SidebarOrderEditor from "@/components/SidebarOrderEditor";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { TestNotificationButton } from "@/components/TestNotificationButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { languageNames, type Language } from "@/i18n";
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
const TAP_THRESHOLD = 10;
const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setBackgroundImage: setGlobalBackground } = useBackground();
  const queryClient = useQueryClient();
  const { language, setLanguage, t } = useLanguage();
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
  const [weeklyReportTime, setWeeklyReportTime] = useState("10:00");
  const [milestoneAlerts, setMilestoneAlerts] = useState(true);
  const [supporterUpdates, setSupporterUpdates] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  
  // Proactive AI settings
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [proactiveFrequency, setProactiveFrequency] = useState("medium");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
  const [chatHeadEnabled, setChatHeadEnabled] = useState(false);

  // Comprehensive timezone list grouped by region
  const COMMON_TIMEZONES = [
    // Americas
    { value: "America/New_York", label: "New York (ET)" },
    { value: "America/Chicago", label: "Chicago (CT)" },
    { value: "America/Denver", label: "Denver (MT)" },
    { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
    { value: "America/Anchorage", label: "Alaska" },
    { value: "Pacific/Honolulu", label: "Hawaii" },
    { value: "America/Toronto", label: "Toronto (ET)" },
    { value: "America/Vancouver", label: "Vancouver (PT)" },
    { value: "America/Mexico_City", label: "Mexico City" },
    { value: "America/Bogota", label: "Bogotá" },
    { value: "America/Lima", label: "Lima" },
    { value: "America/Santiago", label: "Santiago" },
    { value: "America/Buenos_Aires", label: "Buenos Aires" },
    { value: "America/Sao_Paulo", label: "São Paulo" },
    // Europe
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris (CET)" },
    { value: "Europe/Berlin", label: "Berlin (CET)" },
    { value: "Europe/Madrid", label: "Madrid (CET)" },
    { value: "Europe/Rome", label: "Rome (CET)" },
    { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
    { value: "Europe/Zurich", label: "Zurich (CET)" },
    { value: "Europe/Stockholm", label: "Stockholm (CET)" },
    { value: "Europe/Warsaw", label: "Warsaw (CET)" },
    { value: "Europe/Athens", label: "Athens (EET)" },
    { value: "Europe/Helsinki", label: "Helsinki (EET)" },
    { value: "Europe/Bucharest", label: "Bucharest (EET)" },
    { value: "Europe/Istanbul", label: "Istanbul (TRT)" },
    { value: "Europe/Moscow", label: "Moscow (MSK)" },
    // Middle East
    { value: "Asia/Dubai", label: "Dubai (GST)" },
    { value: "Asia/Riyadh", label: "Riyadh (AST)" },
    { value: "Asia/Tehran", label: "Tehran (IRST)" },
    { value: "Asia/Jerusalem", label: "Jerusalem (IST)" },
    // South Asia
    { value: "Asia/Karachi", label: "Karachi (PKT)" },
    { value: "Asia/Kolkata", label: "India (IST)" },
    { value: "Asia/Colombo", label: "Colombo (IST)" },
    { value: "Asia/Dhaka", label: "Dhaka (BST)" },
    { value: "Asia/Kathmandu", label: "Kathmandu (NPT)" },
    // Southeast Asia
    { value: "Asia/Kuala_Lumpur", label: "Malaysia (MYT)" },
    { value: "Asia/Singapore", label: "Singapore (SGT)" },
    { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
    { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh (ICT)" },
    { value: "Asia/Jakarta", label: "Jakarta (WIB)" },
    { value: "Asia/Manila", label: "Manila (PHT)" },
    { value: "Asia/Yangon", label: "Yangon (MMT)" },
    // East Asia
    { value: "Asia/Shanghai", label: "China (CST)" },
    { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
    { value: "Asia/Taipei", label: "Taipei (CST)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Seoul", label: "Seoul (KST)" },
    // Oceania
    { value: "Australia/Perth", label: "Perth (AWST)" },
    { value: "Australia/Adelaide", label: "Adelaide (ACST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST)" },
    { value: "Australia/Brisbane", label: "Brisbane (AEST)" },
    { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
    { value: "Pacific/Auckland", label: "Auckland (NZST)" },
    { value: "Pacific/Fiji", label: "Fiji" },
    // Africa
    { value: "Africa/Cairo", label: "Cairo (EET)" },
    { value: "Africa/Lagos", label: "Lagos (WAT)" },
    { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
    { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
    { value: "Africa/Casablanca", label: "Casablanca (WET)" },
  ];

  // Privacy settings
  const [shareJournal, setShareJournal] = useState(false);
  const [shareCheckIns, setShareCheckIns] = useState(false);
  const [shareMilestones, setShareMilestones] = useState(true);

  // Push notifications hook
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();

  // Check if dev tools are unlocked
  const isDevUnlocked = localStorage.getItem('devToolsUnlocked') === 'true';

  // Konami code listener
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key;
    
    setKonamiProgress(prev => {
      const newProgress = [...prev, key].slice(-10);
      const isOnTrack = newProgress.every((k, i) => k === KONAMI_CODE[i]);
      
      if (!isOnTrack) {
        setKonamiIndicator(0);
        return [];
      }
      
      setKonamiIndicator(newProgress.length);
      
      if (newProgress.length === KONAMI_CODE.length) {
        localStorage.setItem('devToolsUnlocked', 'true');
        window.dispatchEvent(new Event('storage'));
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
        const notifPrefs = (data as any).notification_preferences as any;
        if (notifPrefs) {
          setDailyReminder(notifPrefs.daily_reminder ?? true);
          setDailyReminderTime(notifPrefs.daily_reminder_time || "09:00");
          setTimezone(notifPrefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
          setWeeklyReport(notifPrefs.weekly_report ?? true);
          setWeeklyReportDay(notifPrefs.weekly_report_day || "monday");
          setWeeklyReportTime(notifPrefs.weekly_report_time || "10:00");
          setMilestoneAlerts(notifPrefs.milestone_alerts ?? true);
          setSupporterUpdates(notifPrefs.supporter_updates ?? false);
          // Proactive AI settings
          setProactiveEnabled(notifPrefs.proactive_enabled ?? true);
          setProactiveFrequency(notifPrefs.proactive_frequency || "medium");
          setQuietHoursEnabled(notifPrefs.quiet_hours_enabled ?? false);
          setQuietHoursStart(notifPrefs.quiet_hours_start || "22:00");
          setQuietHoursEnd(notifPrefs.quiet_hours_end || "08:00");
          setChatHeadEnabled(notifPrefs.chat_head_enabled ?? false);
        }
      }
      
      return data;
    },
    retry: false,
  });

  useEffect(() => {
    if (error && error.message.includes("auth")) {
      navigate("/auth");
    }
  }, [error, navigate]);

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
        title: t("common.success"),
        description: t("settings.saveProfile"),
      });
      refetch();
    } catch (error: any) {
      toast({
        title: t("common.error"),
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
            weekly_report_time: weeklyReportTime,
            milestone_alerts: milestoneAlerts,
            supporter_updates: supporterUpdates,
            proactive_enabled: proactiveEnabled,
            proactive_frequency: proactiveFrequency,
            quiet_hours_enabled: quietHoursEnabled,
            quiet_hours_start: quietHoursStart,
            quiet_hours_end: quietHoursEnd,
            chat_head_enabled: chatHeadEnabled,
          },
        } as any)
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("settings.saveNotifications"),
      });
      refetch();
    } catch (error: any) {
      toast({
        title: t("common.error"),
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

      queryClient.invalidateQueries();

      toast({
        title: t("settings.resetAccount"),
        description: t("common.success"),
      });

      navigate("/onboarding", { replace: true });
      refetch();
      return data;
    } catch (error: any) {
      toast({
        title: t("common.error"),
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

      await Promise.all([
        supabase.from("community_comments").delete().eq("user_id", user.id),
        supabase.from("community_reactions").delete().eq("user_id", user.id),
        supabase.from("goal_completions").delete().eq("user_id", user.id),
      ]);

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

      await supabase.auth.signOut();
      
      toast({
        title: t("settings.deleteAccount"),
        description: t("common.success"),
      });
      
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: t("common.error"),
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

  const handleEasterEggTap = useCallback(() => {
    const now = Date.now();
    
    if (now - lastTapTime > 2000) {
      setTapCount(1);
    } else {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      
      if (newCount >= TAP_THRESHOLD) {
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
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <main className="container mx-auto px-4 py-8 max-w-3xl animate-fade-in space-y-6">

        {/* Language Selector */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t("settings.language")}
            </CardTitle>
            <CardDescription>{t("settings.languageDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {(["en", "ms", "ta"] as Language[]).map((lang) => (
                <Button
                  key={lang}
                  variant={language === lang ? "default" : "outline"}
                  className={`w-full ${language === lang ? "" : "hover:bg-muted/50"}`}
                  onClick={() => setLanguage(lang)}
                >
                  {languageNames[lang]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("settings.profile")}
            </CardTitle>
            <CardDescription>{t("settings.profileDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pseudonym">{t("settings.displayName")}</Label>
              <Input
                id="pseudonym"
                placeholder={t("settings.displayNamePlaceholder")}
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.displayNameHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addiction">{t("settings.recoveryFocus")}</Label>
              <Select value={addictionType} onValueChange={setAddictionType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("settings.recoveryFocusPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alcohol">{t("onboarding.addiction.alcohol")}</SelectItem>
                  <SelectItem value="drugs">{t("onboarding.addiction.drugs")}</SelectItem>
                  <SelectItem value="smoking">{t("onboarding.addiction.smoking")}</SelectItem>
                  <SelectItem value="pornography">{t("onboarding.addiction.pornography")}</SelectItem>
                  <SelectItem value="gambling">{t("onboarding.addiction.gambling")}</SelectItem>
                  <SelectItem value="gaming">{t("onboarding.addiction.gaming")}</SelectItem>
                  <SelectItem value="food">{t("onboarding.addiction.food")}</SelectItem>
                  <SelectItem value="other">{t("onboarding.addiction.other")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("settings.recoveryFocusHint")}
              </p>
            </div>

            <Button onClick={handleUpdateProfile} disabled={loading}>
              {t("settings.saveProfile")}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("settings.notifications")}
            </CardTitle>
            <CardDescription>{t("settings.notificationsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Timezone - moved to top as it applies to all times */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t("settings.timezone")}
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("settings.timezoneAuto")} {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </div>

            <Separator />

            {/* Daily Check-in Reminder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <Label>{t("settings.dailyReminder")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.dailyReminderDesc")}</p>
                </div>
                <Switch checked={dailyReminder} onCheckedChange={setDailyReminder} className="shrink-0" />
              </div>
              {dailyReminder && (
                <div className="ml-4 pl-4 border-l-2 border-border">
                  <Label className="text-sm">{t("settings.reminderTime")}</Label>
                  <TimePickerWheel
                    value={dailyReminderTime}
                    onChange={setDailyReminderTime}
                    className="w-36 mt-1"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Weekly Progress Report */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <Label>{t("settings.weeklyReport")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.weeklyReportDesc")}</p>
                </div>
                <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} className="shrink-0" />
              </div>
              {weeklyReport && (
                <div className="ml-4 pl-4 border-l-2 border-border space-y-3">
                  <div>
                    <Label className="text-sm">{t("settings.reportDay")}</Label>
                    <Select value={weeklyReportDay} onValueChange={setWeeklyReportDay}>
                      <SelectTrigger className="w-40 mt-1">
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
                  <div>
                    <Label className="text-sm">Report Time</Label>
                    <TimePickerWheel
                      value={weeklyReportTime}
                      onChange={setWeeklyReportTime}
                      className="w-36 mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <Label>{t("settings.milestoneAlerts")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.milestoneAlertsDesc")}</p>
              </div>
              <Switch checked={milestoneAlerts} onCheckedChange={setMilestoneAlerts} className="shrink-0" />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <Label>{t("settings.supporterUpdates")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.supporterUpdatesDesc")}</p>
              </div>
              <Switch checked={supporterUpdates} onCheckedChange={setSupporterUpdates} className="shrink-0" />
            </div>

            <Separator />

            {/* AI Coach Proactive Interventions */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Brain className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">AI Coach</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <Label>Proactive Check-ins</Label>
                    <p className="text-sm text-muted-foreground">
                      Let AI Coach reach out when it detects you may need support
                    </p>
                  </div>
                  <Switch checked={proactiveEnabled} onCheckedChange={setProactiveEnabled} className="shrink-0" />
                </div>
                
                {proactiveEnabled && (
                  <div className="ml-4 pl-4 border-l-2 border-border">
                    <Label className="text-sm">Check-in Frequency</Label>
                    <Select value={proactiveFrequency} onValueChange={setProactiveFrequency}>
                      <SelectTrigger className="w-full sm:w-48 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low (once daily)</SelectItem>
                        <SelectItem value="medium">Medium (every 6 hours)</SelectItem>
                        <SelectItem value="high">High (when risk detected)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Higher frequency means more proactive support during difficult times
                    </p>
                  </div>
                )}
              </div>
              
              {/* Quiet Hours */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <Label className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Quiet Hours
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Pause notifications during sleep or focus time
                    </p>
                  </div>
                  <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} className="shrink-0" />
                </div>
                
                {quietHoursEnabled && (
                <div className="ml-4 pl-4 border-l-2 border-border flex flex-col sm:flex-row sm:items-end gap-4">
                    <div>
                      <Label className="text-xs">Start</Label>
                      <TimePickerWheel
                        value={quietHoursStart}
                        onChange={setQuietHoursStart}
                        className="w-36 mt-1"
                      />
                    </div>
                    <span className="text-muted-foreground sm:pb-2">to</span>
                    <div>
                      <Label className="text-xs">End</Label>
                      <TimePickerWheel
                        value={quietHoursEnd}
                        onChange={setQuietHoursEnd}
                        className="w-36 mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Floating Chat Head */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <Label className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Floating Chat Head
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Show a draggable AI Coach button on all pages for quick access
                    </p>
                  </div>
                  <Switch checked={chatHeadEnabled} onCheckedChange={setChatHeadEnabled} className="shrink-0" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Push Notifications Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <Label className="flex items-center gap-2">
                    {t("settings.pushNotifications")}
                    {isSubscribed && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isSupported 
                      ? t("settings.pushEnabled")
                      : t("settings.pushNotSupported")}
                  </p>
                </div>
                <Switch 
                  checked={isSubscribed} 
                  onCheckedChange={handlePushToggle}
                  disabled={!isSupported || pushLoading}
                  className="shrink-0"
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
                      {t("common.loading")}
                    </>
                  ) : (
                    <>
                      <Bell className="mr-2 h-4 w-4" />
                      {t("settings.enablePush")}
                    </>
                  )}
                </Button>
              )}

              {isSubscribed && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-sm text-primary">
                      {t("settings.pushEnabledMsg")}
                    </p>
                  </div>
                  <TestNotificationButton />
                </div>
              )}
            </div>

            <Separator />

            <Button 
              onClick={handleSaveNotificationPrefs} 
              disabled={notificationLoading}
              className="w-full"
            >
              {notificationLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                t("settings.saveNotifications")
              )}
            </Button>
          </CardContent>
        </Card>


        {/* Privacy Settings */}
        <Card className="bg-card/50 backdrop-blur-lg border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("settings.privacy")}
            </CardTitle>
            <CardDescription>{t("settings.privacyDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("settings.shareJournal")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.shareJournalDesc")}</p>
              </div>
              <Switch checked={shareJournal} onCheckedChange={setShareJournal} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("settings.shareCheckIns")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.shareCheckInsDesc")}</p>
              </div>
              <Switch checked={shareCheckIns} onCheckedChange={setShareCheckIns} />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("settings.shareMilestones")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.shareMilestonesDesc")}</p>
              </div>
              <Switch checked={shareMilestones} onCheckedChange={setShareMilestones} />
            </div>

            <Button onClick={handleUpdateProfile} disabled={loading}>
              {t("settings.savePrivacy")}
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
              {t("settings.aiFeatures")}
            </CardTitle>
            <CardDescription>
              {t("settings.aiFeaturesDesc")}
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
            
            {/* Hidden hint for developers */}
            <div 
              className="flex flex-col gap-2 mt-4 p-3 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 cursor-pointer select-none"
              onClick={handleEasterEggTap}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gamepad2 className="h-4 w-4" />
                <span className="font-medium">Easter Egg:</span>
                <span className="hidden lg:inline">Try the Konami code or tap 10 times...</span>
                <span className="lg:hidden">Tap 10 times for luck...</span>
              </div>
              
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
                      <AlertDialogCancel className="w-full sm:w-auto">{t("common.cancel")}</AlertDialogCancel>
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
            <CardTitle>{t("settings.account")}</CardTitle>
            <CardDescription>{t("settings.accountDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reset Account */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-amber-600 border-amber-600/50 hover:bg-amber-600/10">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("settings.resetAccount")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    {t("settings.resetAccount")}?
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
                  <AlertDialogCancel className="w-full sm:w-auto">{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetAccount} 
                    disabled={resetLoading}
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
                  >
                    {resetLoading ? t("common.loading") : t("settings.resetAccount")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete Account */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive border-destructive/50 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("settings.deleteAccount")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="h-5 w-5" />
                    {t("settings.deleteAccount")}?
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
                  <AlertDialogCancel className="w-full sm:w-auto">{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount} 
                    disabled={deleteLoading}
                    className="w-full sm:w-auto bg-destructive hover:bg-destructive/90"
                  >
                    {deleteLoading ? t("common.loading") : t("settings.deleteAccount")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Separator />

            <Button onClick={handleSignOut} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              {t("settings.signOut")}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
