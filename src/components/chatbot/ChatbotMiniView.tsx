import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Maximize2, X, Send, Loader2 } from "lucide-react";
import ChatMessage from "./ChatMessage";
import QuickActions from "./QuickActions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StorageImage from "@/components/StorageImage";
import { Bot, Sparkles } from "lucide-react";
import { CardHeader, CardContent } from "@/components/ui/card";

interface ChatbotMiniViewProps {
  messages: any[];
  streamingMessage: string;
  streaming: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onExpandToSidebar: () => void;
  onQuickAction: (message: string) => void;
  onClose: () => void;
}

const ChatbotMiniView = ({
  messages,
  streamingMessage,
  streaming,
  input,
  onInputChange,
  onSend,
  onExpandToSidebar,
  onQuickAction,
  onClose,
}: ChatbotMiniViewProps) => {
  // Show more messages for scrolling
  const displayMessages = messages || [];

  const TypingIndicator = () => (
    <div className="flex items-center gap-2 p-2">
      <Avatar className="h-6 w-6 border-2 border-primary/20 bg-card">
        <StorageImage
          bucket="logos"
          path="logo.png"
          alt="Bot"
          className="h-full w-full object-contain p-0.5"
          fallback={
            <AvatarFallback className="bg-gradient-primary">
              <Bot className="h-3 w-3 text-primary-foreground" />
            </AvatarFallback>
          }
        />
      </Avatar>
      <div className="flex items-center gap-1">
        <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse delay-0"></span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse delay-200"></span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse delay-400"></span>
      </div>
    </div>
  );

  return (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
            <div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold">AI Coach</p>
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">Always here to help</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onExpandToSidebar}
              className="h-7 w-7 hover:bg-primary/10"
              title="Expand to sidebar"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col h-[calc(100%-5rem)] pt-0 overflow-hidden">
        {/* Message Area - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto mb-2 pr-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          <div className="space-y-2 py-1">
            {displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] space-y-3">
                <Avatar className="h-12 w-12 border-2 border-primary/20 bg-card shadow-glow">
                  <StorageImage
                    bucket="logos"
                    path="logo.png"
                    alt="Bot"
                    className="h-full w-full object-contain p-1.5"
                    fallback={
                      <AvatarFallback className="bg-gradient-primary">
                        <Bot className="h-6 w-6 text-primary-foreground" />
                      </AvatarFallback>
                    }
                  />
                </Avatar>
                <div className="text-center">
                  <p className="text-sm font-semibold mb-1">Hi there! 👋</p>
                  <p className="text-xs text-muted-foreground">How can I support you?</p>
                </div>
              </div>
            ) : (
              <>
                {displayMessages.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} content={msg.content} compact />
                ))}
                {streaming && streamingMessage && (
                  <ChatMessage
                    role="assistant"
                    content={streamingMessage}
                    isStreaming
                    compact
                  />
                )}
              </>
            )}
          </div>
        </div>

        {streaming && !streamingMessage && <TypingIndicator />}

        {/* Quick Actions */}
        {messages && messages.length > 0 && (
          <div className="border-t border-primary/10 pt-2 pb-2">
            <QuickActions onAction={onQuickAction} compact />
          </div>
        )}

        {/* Input Area */}
        <div className="pt-2 border-t border-primary/10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask me anything..."
              disabled={streaming}
              className="flex-1 bg-background/50 border-primary/20 focus:border-primary/40 transition-colors text-sm h-9"
            />
            <Button
              type="submit"
              disabled={!input.trim() || streaming}
              size="icon"
              className="bg-gradient-primary hover:shadow-glow transition-all h-9 w-9"
            >
              {streaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </>
  );
};

export default ChatbotMiniView;
