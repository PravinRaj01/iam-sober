import { memo, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { 
  Loader2, 
  Send, 
  Sparkles, 
  Trash2, 
  Bot,
  Mic,
  MicOff
} from "lucide-react";
import ChatMessage from "@/components/chatbot/ChatMessage";
import QuickActions from "@/components/chatbot/QuickActions";
import StorageImage from "@/components/StorageImage";
import AICapabilitiesBadge from "@/components/AICapabilitiesBadge";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string | null;
}

interface ChatViewProps {
  isMobile: boolean;
  currentConversationId: string | null;
  conversations: Conversation[] | undefined;
  messages: ChatMessage[] | undefined;
  messagesLoading: boolean;
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  streaming: boolean;
  streamingMessage: string;
  handleSend: (message?: string) => void;
  handleClearChat: () => void;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  scrollRef: RefObject<HTMLDivElement>;
  isRecording: boolean;
  isProcessing: boolean;
  handleVoiceToggle: () => void;
}

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

const ChatView = memo(({
  isMobile,
  currentConversationId,
  conversations,
  messages,
  messagesLoading,
  input,
  handleInputChange,
  streaming,
  streamingMessage,
  handleSend,
  handleClearChat,
  inputRef,
  scrollRef,
  isRecording,
  isProcessing,
  handleVoiceToggle,
}: ChatViewProps) => (
  <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
    {/* Header */}
    <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-40 shrink-0">
      <div className="px-4 py-4 flex items-center justify-between gap-4 max-w-full overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          {isMobile && <SidebarTrigger className="h-8 w-8 shrink-0" />}
          {!isMobile && <SidebarTrigger className="lg:hidden shrink-0" />}
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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold truncate">
                {conversations?.find(c => c.id === currentConversationId)?.title || "AI Coach"}
              </h1>
              <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">Your intelligent recovery companion</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AICapabilitiesBadge />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>

    {/* Messages Area */}
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <Sparkles className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground">Loading your conversation...</p>
            </div>
          ) : messages?.length === 0 ? (
            <div className="text-center py-16 space-y-6">
              <div className="space-y-3">
                <Avatar className="h-24 w-24 mx-auto border-4 border-primary/20 bg-card shadow-glow">
                  <StorageImage
                    bucket="logos"
                    path="logo.png"
                    alt="Bot"
                    className="h-full w-full object-contain p-3"
                    fallback={
                      <AvatarFallback className="bg-gradient-primary">
                        <Bot className="h-12 w-12 text-primary-foreground" />
                      </AvatarFallback>
                    }
                  />
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome! 👋</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    I'm your AI Coach. I can help you set goals, log your mood, write journal entries, and provide personalized support on your recovery journey.
                  </p>
                </div>
              </div>
              <QuickActions onAction={handleSend} />
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
    </div>

    {streaming && !streamingMessage && <TypingIndicator />}

    {/* Input Area */}
    <div className="border-t border-border/50 bg-card/80 backdrop-blur-xl">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="relative flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef as any}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !streaming) handleSend();
                  }
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
                placeholder={isRecording ? "Listening..." : isProcessing ? "Processing..." : "Ask me anything about your recovery..."}
                disabled={streaming || isRecording || isProcessing}
                rows={1}
                className="flex w-full rounded-md border border-primary/20 bg-background/50 px-3 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none overflow-hidden"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            
            {/* Voice Recording Button */}
            <Button
              type="button"
              onClick={handleVoiceToggle}
              disabled={streaming || isProcessing}
              size="icon"
              variant={isRecording ? "destructive" : "outline"}
              className={`h-12 w-12 shrink-0 ${isRecording ? 'animate-pulse' : ''}`}
              title={isRecording ? "Stop recording" : "Start voice recording"}
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            
            {/* Send Button */}
            <Button
              type="submit"
              disabled={!input.trim() || streaming}
              size="icon"
              className="h-12 w-12 shrink-0 bg-gradient-primary hover:shadow-glow transition-all"
            >
              {streaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Powered by Agentic AI • Tap mic to send voice notes
        </p>
      </div>
    </div>
  </div>
));

ChatView.displayName = "ChatView";

export default ChatView;
