import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import ChatbotMiniView from "./ChatbotMiniView";
import ChatbotFullView from "./ChatbotFullView";

export type ChatbotState = 'closed' | 'mini' | 'sidebar' | 'full';

interface ChatbotDrawerProps {
  state: ChatbotState;
  onStateChange: (state: ChatbotState) => void;
}

const ChatbotDrawer = ({ state, onStateChange }: ChatbotDrawerProps) => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { state: sidebarState } = useSidebar();
  const isMobile = useIsMobile();
  const sidebarWidth = sidebarState === "collapsed" ? "left-16" : "left-60";

  // Fetch or create default conversation
  useEffect(() => {
    const initConversation = async () => {
      if (state === 'closed') return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: conversations } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        setCurrentConversationId(conversations[0].id);
      } else {
        // Create first conversation
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, title: "New Conversation" })
          .select()
          .single();
        
        if (newConv) setCurrentConversationId(newConv.id);
      }
    };

    initConversation();
  }, [state]);

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: state !== 'closed',
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ["chat-messages", currentConversationId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentConversationId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: state !== 'closed' && !!currentConversationId,
  });

  const handleConversationTitleChange = (convId: string, newTitle: string) => {
    queryClient.setQueryData(['conversations'], (oldData: any[] | undefined) => {
      if (!oldData) return [];
      return oldData.map(conv => 
        conv.id === convId ? { ...conv, title: newTitle } : conv
      );
    });
  };

  const saveMessageMutation = useMutation({
    mutationFn: async ({ role, content }: { role: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentConversationId) throw new Error("Not authenticated");

      const { error } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        conversation_id: currentConversationId,
        role,
        content,
      });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentConversationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", currentConversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const handleSend = async (message?: string) => {
    const messageToSend = message || input.trim();
    if (!messageToSend || streaming || !currentConversationId) return;

    const userInput = messageToSend;
    setInput("");
    setStreaming(true);
    setStreamingMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Immediately add user message to UI
      const userMessage = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: userInput,
        created_at: new Date().toISOString(),
        conversation_id: currentConversationId,
        user_id: user.id,
      };

      // Get current messages BEFORE adding optimistic update
      const currentMessages = queryClient.getQueryData<any[]>(["chat-messages", currentConversationId]) || [];
      
      queryClient.setQueryData(["chat-messages", currentConversationId], [...currentMessages, userMessage]);

      // Save user message to DB
      await saveMessageMutation.mutateAsync({ role: "user", content: userInput });

      // Build conversation history from EXISTING messages (not including the one we just added)
      const conversationHistory = currentMessages.map(m => ({ 
        role: m.role, 
        content: m.content 
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/chat-with-ai`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userInput,
            conversationHistory: conversationHistory,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error("Rate limits exceeded. Please try again later.");
        }
        if (response.status === 402) {
          throw new Error("AI usage limit reached. Please add credits to continue.");
        }
        throw new Error(errorData.error || "Failed to get AI response");
      }

      // Parse JSON response
      const data = await response.json();
      const aiResponse = data.response || data.choices?.[0]?.message?.content || "";
      const toolsUsed = data.tools_used || [];
      
      if (aiResponse) {
        // Save assistant message with metadata
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          conversation_id: currentConversationId,
          role: "assistant",
          content: aiResponse,
          metadata: { tools_used: toolsUsed, response_time_ms: data.response_time_ms }
        });
        
        // Refresh messages from DB to ensure sync
        queryClient.invalidateQueries({ queryKey: ["chat-messages", currentConversationId] });
        
        // Also invalidate goals/check-ins if tools were used
        if (toolsUsed.length > 0) {
          queryClient.invalidateQueries({ queryKey: ["goals"] });
          queryClient.invalidateQueries({ queryKey: ["check-ins"] });
          queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Refresh messages on error to restore correct state
      queryClient.invalidateQueries({ queryKey: ["chat-messages", currentConversationId] });
    } finally {
      setStreaming(false);
      setStreamingMessage("");
    }
  };

  const handleNewConversation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newConv } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "New Conversation" })
      .select()
      .single();

    if (newConv) {
      setCurrentConversationId(newConv.id);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    await supabase.from("conversations").delete().eq("id", convId);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    
    if (convId === currentConversationId && conversations && conversations.length > 1) {
      const nextConv = conversations.find(c => c.id !== convId);
      setCurrentConversationId(nextConv?.id || null);
    }
  };

  const handleClearChat = async () => {
    if (!currentConversationId) return;
    
    await supabase
      .from("chat_messages")
      .delete()
      .eq("conversation_id", currentConversationId);
    
    queryClient.invalidateQueries({ queryKey: ["chat-messages", currentConversationId] });
    
    toast({
      title: "Chat cleared",
      description: "All messages have been removed from this conversation.",
    });
  };

  const handleExpandToSidebar = () => onStateChange('sidebar');
  const handleExpandToFull = () => {
    // Navigate to full-screen AI Agent page
    onStateChange('closed');
    navigate('/ai-agent');
  };
  const handleMinimize = () => onStateChange('mini');
  const handleClose = () => onStateChange('closed');

  if (state === 'closed') return null;

  // On mobile, always use full screen view
  const effectiveState = isMobile ? 'full' : state;

  return (
    <div 
      className={cn(
        "fixed transition-all duration-300",
        isMobile ? "inset-0 z-[100]" : (
          effectiveState === 'full' ? `inset-y-0 right-0 ${sidebarWidth} z-[100]` :
          effectiveState === 'sidebar' ? "top-4 right-4 bottom-4 z-50" :
          "bottom-4 right-4 z-50"
        )
      )}
    >
      <Card 
        className={cn(
          "shadow-2xl transition-all duration-300 border-primary/20 flex flex-col overflow-hidden",
          isMobile ? "w-full h-full rounded-none" : (
            effectiveState === 'full' ? "w-full h-full" :
            effectiveState === 'sidebar' ? "w-[400px] lg:w-[500px] h-full max-w-[calc(100vw-280px)]" :
            "w-[400px] h-[500px]"
          )
        )}
      >
        {effectiveState === 'mini' ? (
          <ChatbotMiniView
            messages={messages || []}
            streamingMessage={streamingMessage}
            streaming={streaming}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onExpandToSidebar={handleExpandToSidebar}
            onQuickAction={handleSend}
            onClose={handleClose}
          />
        ) : (
          <ChatbotFullView
            messages={messages || []}
            streamingMessage={streamingMessage}
            streaming={streaming}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onMinimize={isMobile ? undefined : handleMinimize}
            onExpandToFull={handleExpandToFull}
            onClose={handleClose}
            onQuickAction={handleSend}
            isLoading={isLoading}
            isSidebarMode={!isMobile && state === 'sidebar'}
            conversations={conversations || []}
            currentConversationId={currentConversationId}
            onConversationChange={setCurrentConversationId}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
            onClearChat={handleClearChat}
            onConversationTitleChange={handleConversationTitleChange}
          />
        )}
      </Card>
    </div>
  );
};

export default ChatbotDrawer;