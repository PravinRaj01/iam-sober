import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const TestNotificationButton = () => {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { toast } = useToast();

  const sendTest = async () => {
    setStatus("sending");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: user.id,
          title: "🎉 Test Notification",
          body: "Push notifications are working! You'll receive check-in reminders and AI insights here.",
          url: "/settings",
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message || "Failed to send");

      setStatus("sent");
      toast({
        title: "Test sent!",
        description: "You should receive a notification shortly.",
      });

      setTimeout(() => setStatus("idle"), 5000);
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

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={sendTest}
      disabled={status === "sending"}
    >
      {status === "sending" && (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending...
        </>
      )}
      {status === "sent" && (
        <>
          <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
          Sent! Check your notifications
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="mr-2 h-4 w-4 text-destructive" />
          Failed — tap to retry
        </>
      )}
      {status === "idle" && (
        <>
          <Bell className="mr-2 h-4 w-4" />
          Send Test Notification
        </>
      )}
    </Button>
  );
};
