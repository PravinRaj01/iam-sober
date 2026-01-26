import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CardHeader, CardContent } from "@/components/ui/card";
import { Loader2, Send, Sparkles, Minimize2, X, Maximize2, Plus, Trash2, MessageSquare, ChevronDown, Mic, MicOff } from "lucide-react";
import ChatMessage from "./ChatMessage";
import QuickActions from "./QuickActions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StorageImage from "@/components/StorageImage";
import { Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface ChatbotFullViewProps {
  messages: any[];
  streamingMessage: string;
  streaming: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onMinimize?: () => void;
  onExpandToFull?: () => void;
  onClose: () => void;
  onQuickAction: (message: string) => void;
  isLoading: boolean;
  isSidebarMode?: boolean;
  conversations: any[];
  currentConversationId: string | null;
  onConversationChange: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onClearChat: () => void;
  onConversationTitleChange: (id: string, title: string) => void;
}

const ChatbotFullView = ({
  messages,
  streamingMessage,
  streaming,
  input,
  onInputChange,
  onSend,
  onMinimize,
  onExpandToFull,
  onClose,
  onQuickAction,
  isLoading,
  isSidebarMode = false,
  conversations,
  currentConversationId,
  onConversationChange,
  onNewConversation,
  onDeleteConversation,
  onClearChat,
  onConversationTitleChange,
}: ChatbotFullViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Voice recording
  const handleTranscription = (text: string) => {
    onInputChange(text);
  };
  
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceRecording(handleTranscription);

  const handleVoiceToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingMessage]);

  const TypingIndicator = () => (
    <div className="flex items-center gap-2 p-4">
      <Avatar className="h-8 w-8 border-2 border-primary/20 bg-card">
        <StorageImage
          bucket="logos"
          path="logo.png"
          alt="Bot"
          className="h-full w-full object-contain p-1"
          fallback={
            <AvatarFallback className="bg-gradient-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </AvatarFallback>
          }
        />
      </Avatar>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse delay-0"></span>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse delay-200"></span>
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse delay-400"></span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Management */}
      {conversations.length > 0 && (
        <div className="px-4 pt-4 pb-2 border-b border-primary/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 max-w-[300px]">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {conversations.find(c => c.id === currentConversationId)?.title || "New Conversation"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[300px] max-h-[400px] overflow-y-auto bg-card/95 backdrop-blur-lg border-primary/20 z-[110]">
                <DropdownMenuLabel>Conversations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {conversations.map((conv) => (
                  <div key={conv.id} className="flex items-center group pr-2">
                    <DropdownMenuItem
                      className="flex-1 cursor-pointer"
                      onSelect={(e) => {
                        if ((e.target as HTMLElement).closest('input')) {
                          e.preventDefault();
                          return;
                        }
                        onConversationChange(conv.id);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                      <input
                        type="text"
                        value={conv.title ?? "New Conversation"}
                        onChange={(e) => {
                          onConversationTitleChange(conv.id, e.target.value);
                        }}
                        onBlur={async (e) => {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;
                          
                          await supabase
                            .from("conversations")
                            .update({ title: e.target.value })
                            .eq("id", conv.id);
                          
                          queryClient.invalidateQueries({ queryKey: ["conversations"] });
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-none outline-none flex-1 text-sm w-full"
                      />
                    </DropdownMenuItem>
                    {conversations.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversationToDelete(conv.id);
                          setShowDeleteDialog(true);
                        }}
                        className="h-8 w-8 mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onNewConversation}
            className="h-9 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (conversationToDelete) {
                  onDeleteConversation(conversationToDelete);
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

      <CardHeader className="pb-3 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20 bg-card">
              <StorageImage
                bucket="logos"
                path="logo.png"
                alt="Bot"
                className="h-full w-full object-contain p-1"
                fallback={
                  <AvatarFallback className="bg-gradient-primary">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </AvatarFallback>
                }
              />
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">AI Coach</p>
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">Always here to support you</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearChat}
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {onExpandToFull && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onExpandToFull}
                className="h-8 w-8 hover:bg-primary/10"
                title="Open AI Coach"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            {onMinimize && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMinimize}
                className="h-8 w-8 hover:bg-primary/10"
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-4 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea className="h-full pr-4">
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <Sparkles className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <p className="text-sm text-muted-foreground">Connecting to your coach...</p>
              </div>
            ) : messages?.length === 0 ? (
              <div className="text-center py-8 space-y-6">
                <div className="space-y-3">
                  <Avatar className="h-20 w-20 mx-auto border-4 border-primary/20 bg-card shadow-glow">
                    <StorageImage
                      bucket="logos"
                      path="logo.png"
                      alt="Bot"
                      className="h-full w-full object-contain p-2"
                      fallback={
                        <AvatarFallback className="bg-gradient-primary">
                          <Bot className="h-10 w-10 text-primary-foreground" />
                        </AvatarFallback>
                      }
                    />
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Welcome! 👋</h3>
                    <p className="text-muted-foreground text-sm">
                      I'm your AI recovery coach, here 24/7 to support your journey.
                    </p>
                  </div>
                </div>
                <QuickActions onAction={onQuickAction} />
              </div>
            ) : (
              <>
                {messages?.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
                ))}
                {streaming && (
                  <ChatMessage
                    role="assistant"
                    content={streamingMessage || "Thinking..."}
                    isStreaming
                  />
                )}
                <div ref={scrollRef} />
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {streaming && !streamingMessage && <TypingIndicator />}

      <div className="p-4 border-t border-primary/10 mt-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={isRecording ? "Listening..." : isProcessing ? "Processing..." : "Ask me anything..."}
                disabled={streaming || isRecording || isProcessing}
                className="pr-4 h-11 text-base bg-background/50 border-primary/20 focus:border-primary/40 transition-colors"
              />
            </div>
            
            {/* Voice Recording Button */}
            <Button
              type="button"
              onClick={handleVoiceToggle}
              disabled={streaming || isProcessing}
              size="icon"
              variant={isRecording ? "destructive" : "outline"}
              className={`h-11 w-11 shrink-0 ${isRecording ? 'animate-pulse' : ''}`}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            
            {/* Send Button */}
            <Button
              type="submit"
              disabled={!input.trim() || streaming}
              size="icon"
              className="h-11 w-11 shrink-0 bg-gradient-primary hover:shadow-glow transition-all"
            >
              {streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Powered by AI • Tap mic for voice input
        </p>
      </div>
    </div>
  );
};

export default ChatbotFullView;
