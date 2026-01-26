import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type RealtimeTable = 
  | "ai_observability_logs" 
  | "ai_interventions" 
  | "profiles" 
  | "check_ins" 
  | "goals" 
  | "journal_entries";

interface UseAdminRealtimeOptions {
  tables: RealtimeTable[];
  queryKeys: string[][];
  onUpdate?: (payload: any) => void;
}

/**
 * Hook for real-time admin dashboard updates using Supabase Realtime
 * 
 * Features:
 * - Subscribes to multiple tables for live updates
 * - Automatically invalidates React Query cache
 * - Debounced updates to prevent excessive re-renders
 * - Shows toast notifications for important events
 */
export function useAdminRealtime({ tables, queryKeys, onUpdate }: UseAdminRealtimeOptions) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const invalidateQueries = useCallback(() => {
    // Debounce to prevent rapid-fire updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    }, 500);
  }, [queryClient, queryKeys]);

  useEffect(() => {
    const channels = tables.map(table => {
      const channel = supabase
        .channel(`admin-realtime-${table}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: table,
          },
          (payload) => {
            console.log(`[Admin Realtime] ${table} update:`, payload.eventType);
            invalidateQueries();
            onUpdate?.(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Admin Realtime] Subscribed to ${table}`);
          }
        });

      return channel;
    });

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [tables, invalidateQueries, onUpdate]);
}

/**
 * Hook specifically for AI Analytics real-time updates
 */
export function useAIAnalyticsRealtime() {
  useAdminRealtime({
    tables: ["ai_observability_logs"],
    queryKeys: [["admin-ai-analytics-full"]],
  });
}

/**
 * Hook specifically for Error Logs real-time updates
 */
export function useErrorLogsRealtime() {
  useAdminRealtime({
    tables: ["ai_observability_logs"],
    queryKeys: [["admin-error-logs"]],
    onUpdate: (payload) => {
      if (payload.eventType === 'INSERT' && payload.new?.error_message) {
        toast.error("New error detected", {
          description: payload.new.function_name || "AI Function",
          duration: 3000,
        });
      }
    },
  });
}

/**
 * Hook specifically for Interventions real-time updates
 */
export function useInterventionsRealtime() {
  useAdminRealtime({
    tables: ["ai_observability_logs", "ai_interventions"],
    queryKeys: [["admin-intervention-logs"], ["admin-interventions-table"]],
    onUpdate: (payload) => {
      if (payload.eventType === 'INSERT' && payload.new?.intervention_triggered) {
        toast.info("New intervention triggered", {
          description: payload.new.intervention_type || "Crisis support",
          duration: 4000,
        });
      }
    },
  });
}

/**
 * Hook specifically for User Stats real-time updates
 */
export function useUserStatsRealtime() {
  useAdminRealtime({
    tables: ["profiles", "check_ins", "goals"],
    queryKeys: [["admin-user-stats"]],
  });
}

/**
 * Hook for main Admin Panel real-time updates
 */
export function useAdminPanelRealtime() {
  useAdminRealtime({
    tables: ["ai_observability_logs", "profiles", "check_ins", "goals", "journal_entries"],
    queryKeys: [
      ["admin-usage-stats"],
      ["admin-ai-metrics"],
      ["admin-intervention-stats"],
      ["admin-recent-errors"],
    ],
  });
}
