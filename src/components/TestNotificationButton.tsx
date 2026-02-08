import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, CheckCircle2, XCircle, Timer, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

type Status = "idle" | "sending" | "scheduled" | "sent" | "error";

export const TestNotificationButton = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [scheduledLabel, setScheduledLabel] = useState("");
  const { toast } = useToast();

  const sendTest = async (delaySeconds: number = 0) => {
    setStatus("sending");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: user.id,
          title: "🎉 Test Notification",
          body: delaySeconds > 0
            ? `This was scheduled ${delaySeconds}s ago — background delivery works!`
            : "Push notifications are working! You'll receive check-in reminders and AI insights here.",
          url: "/settings",
          delay_seconds: delaySeconds,
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message || "Failed to send");

      if (delaySeconds > 0) {
        const label = delaySeconds >= 60 ? `${delaySeconds / 60} min` : `${delaySeconds}s`;
        setScheduledLabel(label);
        setStatus("scheduled");
        toast({
          title: `Scheduled in ${label}`,
          description: "Notification is being handled server-side. You can close the app now!",
        });
        // Reset after the delay passes
        setTimeout(() => setStatus("idle"), Math.min(delaySeconds * 1000 + 5000, 15000));
      } else {
        setStatus("sent");
        toast({
          title: "Test sent!",
          description: "You should receive a notification shortly.",
        });
        setTimeout(() => setStatus("idle"), 5000);
      }
    } catch (err: any) {
      console.error("[TestNotification]", err);
      setStatus("error");
      toast({
        title: "Failed to send",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  if (status === "sending") {
    return (
      <Button variant="outline" className="w-full" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Sending to server...
      </Button>
    );
  }

  if (status === "sent") {
    return (
      <Button variant="outline" className="w-full" disabled>
        <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
        Sent! Check your notifications
      </Button>
    );
  }

  if (status === "error") {
    return (
      <Button variant="outline" className="w-full" onClick={() => sendTest(0)}>
        <XCircle className="mr-2 h-4 w-4 text-destructive" />
        Failed — tap to retry
      </Button>
    );
  }

  if (status === "scheduled") {
    return (
      <Button variant="outline" className="w-full" disabled>
        <Timer className="mr-2 h-4 w-4 animate-pulse text-primary" />
        Server will send in {scheduledLabel} — close the app!
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full">
          <Bell className="mr-2 h-4 w-4" />
          Send Test Notification
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Choose when to send
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => sendTest(0)}>
          <Bell className="mr-2 h-4 w-4" />
          Send Now
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => sendTest(30)}>
          <Timer className="mr-2 h-4 w-4" />
          In 30 seconds (server-side)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => sendTest(60)}>
          <Timer className="mr-2 h-4 w-4" />
          In 1 minute (server-side)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => sendTest(120)}>
          <Clock className="mr-2 h-4 w-4" />
          In 2 minutes (server-side)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
