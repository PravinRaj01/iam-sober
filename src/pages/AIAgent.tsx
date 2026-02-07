import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import ConversationList from "@/components/ai-agent/ConversationList";
import ChatView from "@/components/ai-agent/ChatView";

const AIAgent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [showConversationList, setShowConversationList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Rename dialog
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [conversationToRename, setConversationToRename] = useState<string | null>(null);
  const [newConversationTitle, setNewConversationTitle] = useState("");

  // Voice recording
  const handleTranscription = useCallback((text: string) => {
    setInput(text);
  }, []);
  
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceRecording(handleTranscription);

  // Initialize conversation
  useEffect(() => {
    const initConversation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: conversations } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        setCurrentConversationId(conversations[0].id);
        if (!isMobile) setShowConversationList(true);
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, title: "New Conversation" })
          .select()
          .single();
        
        if (newConv) setCurrentConversationId(newConv.id);
      }
    };

    initConversation();
  }, [navigate, isMobile]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingMessage]);

  // Maintain input focus after state changes
  useEffect(() => {
    if (!streaming && !isRecording && !isProcessing && inputRef.current) {
      // Small delay to ensure re-renders complete
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [streaming, isRecording, isProcessing]);

  // Handle input change with stable callback
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

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
    enabled: !!currentConversationId,
  });

  const filteredConversations = conversations?.filter(conv => 
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const handleSend = useCallback(async (message?: string) => {
    const messageToSend = message || input.trim();
    if (!messageToSend || streaming || !currentConversationId) return;

    const userInput = messageToSend;
    setInput("");
    setStreaming(true);
    setStreamingMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const userMessage = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: userInput,
        created_at: new Date().toISOString(),
        conversation_id: currentConversationId,
        user_id: user.id,
      };

      const currentMessages = queryClient.getQueryData<any[]>(["chat-messages", currentConversationId]) || [];
      queryClient.setQueryData(["chat-messages", currentConversationId], [...currentMessages, userMessage]);

      await saveMessageMutation.mutateAsync({ role: "user", content: userInput });

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
          throw new Error("The AI coach is taking a breather 😌 Please wait a few seconds and try again.");
        }
        if (response.status === 402) {
          throw new Error("AI usage limit reached. Please add credits to continue.");
        }
        throw new Error(errorData.error || "Failed to get AI response");
      }

      const data = await response.json();
      const aiResponse = data.response || data.choices?.[0]?.message?.content || "";
      const toolsUsed = data.tools_used || [];
      
      if (aiResponse) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          conversation_id: currentConversationId,
          role: "assistant",
          content: aiResponse,
          metadata: { tools_used: toolsUsed, response_time_ms: data.response_time_ms }
        });
        
        queryClient.invalidateQueries({ queryKey: ["chat-messages", currentConversationId] });
        
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
      queryClient.invalidateQueries({ queryKey: ["chat-messages", currentConversationId] });
    } finally {
      setStreaming(false);
      setStreamingMessage("");
    }
  }, [input, streaming, currentConversationId, queryClient, saveMessageMutation, toast]);

  const handleNewConversation = useCallback(async () => {
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
      if (isMobile) setShowConversationList(false);
    }
  }, [queryClient, isMobile]);

  const handleSelectConversation = useCallback((convId: string) => {
    setCurrentConversationId(convId);
    if (isMobile) setShowConversationList(false);
  }, [isMobile]);

  const handleDeleteConversation = useCallback(async (convId: string) => {
    await supabase.from("chat_messages").delete().eq("conversation_id", convId);
    await supabase.from("conversations").delete().eq("id", convId);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    
    if (convId === currentConversationId && conversations && conversations.length > 1) {
      const nextConv = conversations.find(c => c.id !== convId);
      setCurrentConversationId(nextConv?.id || null);
    }
  }, [currentConversationId, conversations, queryClient]);

  const handleRenameConversation = useCallback(async () => {
    if (!conversationToRename || !newConversationTitle.trim()) return;
    
    await supabase
      .from("conversations")
      .update({ title: newConversationTitle.trim() })
      .eq("id", conversationToRename);
    
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    setShowRenameDialog(false);
    setConversationToRename(null);
    setNewConversationTitle("");
    
    toast({
      title: "Conversation renamed",
      description: "The conversation title has been updated.",
    });
  }, [conversationToRename, newConversationTitle, queryClient, toast]);

  const handleClearChat = useCallback(async () => {
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
  }, [currentConversationId, queryClient, toast]);

  const handleVoiceToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const openRenameDialog = useCallback((convId: string, currentTitle: string) => {
    setConversationToRename(convId);
    setNewConversationTitle(currentTitle);
    setShowRenameDialog(true);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  return (
    <>
      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (conversationToDelete) {
                  handleDeleteConversation(conversationToDelete);
                  setShowDeleteDialog(false);
                  setConversationToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newConversationTitle}
            onChange={(e) => setNewConversationTitle(e.target.value)}
            placeholder="Conversation name..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRenameConversation();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConversation} disabled={!newConversationTitle.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layout */}
      <div className="flex h-full">
        {/* Mobile: Show either list or chat */}
        {isMobile ? (
          showConversationList ? (
            <div className="w-full h-full">
              <ConversationList
                isMobile={isMobile}
                searchQuery={searchQuery}
                handleSearchChange={handleSearchChange}
                searchInputRef={searchInputRef}
                filteredConversations={filteredConversations}
                currentConversationId={currentConversationId}
                handleSelectConversation={handleSelectConversation}
                handleNewConversation={handleNewConversation}
                openRenameDialog={openRenameDialog}
                setConversationToDelete={setConversationToDelete}
                setShowDeleteDialog={setShowDeleteDialog}
                conversationsCount={conversations?.length || 0}
              />
            </div>
          ) : (
            <div className="w-full h-full">
              <ChatView
                isMobile={isMobile}
                currentConversationId={currentConversationId}
                conversations={conversations}
                messages={messages}
                messagesLoading={isLoading}
                input={input}
                handleInputChange={handleInputChange}
                streaming={streaming}
                streamingMessage={streamingMessage}
                handleSend={handleSend}
                handleClearChat={handleClearChat}
                inputRef={inputRef}
                scrollRef={scrollRef}
                isRecording={isRecording}
                isProcessing={isProcessing}
                handleVoiceToggle={handleVoiceToggle}
              />
            </div>
          )
        ) : (
          /* Desktop: Resizable panels */
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40} className="hidden md:block">
              <ConversationList
                isMobile={isMobile}
                searchQuery={searchQuery}
                handleSearchChange={handleSearchChange}
                searchInputRef={searchInputRef}
                filteredConversations={filteredConversations}
                currentConversationId={currentConversationId}
                handleSelectConversation={handleSelectConversation}
                handleNewConversation={handleNewConversation}
                openRenameDialog={openRenameDialog}
                setConversationToDelete={setConversationToDelete}
                setShowDeleteDialog={setShowDeleteDialog}
                conversationsCount={conversations?.length || 0}
              />
            </ResizablePanel>
            <ResizableHandle withHandle className="hidden md:flex" />
            <ResizablePanel defaultSize={75} minSize={50}>
              <ChatView
                isMobile={isMobile}
                currentConversationId={currentConversationId}
                conversations={conversations}
                messages={messages}
                messagesLoading={isLoading}
                input={input}
                handleInputChange={handleInputChange}
                streaming={streaming}
                streamingMessage={streamingMessage}
                handleSend={handleSend}
                handleClearChat={handleClearChat}
                inputRef={inputRef}
                scrollRef={scrollRef}
                isRecording={isRecording}
                isProcessing={isProcessing}
                handleVoiceToggle={handleVoiceToggle}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </>
  );
};

export default AIAgent;
