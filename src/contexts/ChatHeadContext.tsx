import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface ChatHeadPosition {
  x: number;
  y: number;
  side: "left" | "right";
}

interface ChatHeadContextType {
  isEnabled: boolean;
  isOpen: boolean;
  unreadCount: number;
  position: ChatHeadPosition;
  openChat: () => void;
  closeChat: () => void;
  setPosition: (pos: ChatHeadPosition) => void;
  incrementUnread: () => void;
  clearUnread: () => void;
}

const ChatHeadContext = createContext<ChatHeadContextType | undefined>(undefined);

const DEFAULT_POSITION: ChatHeadPosition = {
  x: 0,
  y: 300,
  side: "right"
};

export const ChatHeadProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [position, setPositionState] = useState<ChatHeadPosition>(() => {
    const stored = localStorage.getItem("chat_head_position");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return DEFAULT_POSITION;
      }
    }
    return DEFAULT_POSITION;
  });

  // Fetch user's chat head setting
  const { data: profile } = useQuery({
    queryKey: ["profile-chat-head"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", user.id)
        .single();

      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isEnabled = (profile?.notification_preferences as any)?.chat_head_enabled ?? false;

  const setPosition = (pos: ChatHeadPosition) => {
    setPositionState(pos);
    localStorage.setItem("chat_head_position", JSON.stringify(pos));
  };

  const openChat = () => {
    setIsOpen(true);
    clearUnread();
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  const incrementUnread = () => {
    if (!isOpen) {
      setUnreadCount(prev => prev + 1);
    }
  };

  const clearUnread = () => {
    setUnreadCount(0);
  };

  return (
    <ChatHeadContext.Provider
      value={{
        isEnabled,
        isOpen,
        unreadCount,
        position,
        openChat,
        closeChat,
        setPosition,
        incrementUnread,
        clearUnread,
      }}
    >
      {children}
    </ChatHeadContext.Provider>
  );
};

export const useChatHead = () => {
  const context = useContext(ChatHeadContext);
  if (context === undefined) {
    throw new Error("useChatHead must be used within a ChatHeadProvider");
  }
  return context;
};
