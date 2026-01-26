import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ChatToolIndicator from "./ChatToolIndicator";

interface ChatMessageProps {
  role: string;
  content: string;
  isStreaming?: boolean;
  compact?: boolean;
  toolsUsed?: string[];
  isThinking?: boolean;
}

const ChatMessage = ({ role, content, isStreaming, compact = false, toolsUsed, isThinking }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div className={cn("space-y-1.5 animate-fade-in", compact && "space-y-1")}>
      {/* Tool indicator for AI messages */}
      {!isUser && (toolsUsed?.length || isThinking) && (
        <div className={cn("ml-10", compact && "ml-8")}>
          <ChatToolIndicator toolsUsed={toolsUsed} isThinking={isThinking} compact={compact} />
        </div>
      )}
      
      <div
        className={cn(
          "flex gap-2",
          isUser ? "flex-row-reverse" : "flex-row",
          compact && "gap-1.5"
        )}
      >
      {!isUser && (
        <Avatar className={cn("shrink-0 border border-primary/20", compact ? "h-6 w-6" : "h-8 w-8")}>
          <AvatarFallback className="bg-gradient-primary text-primary-foreground">
            <Bot className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-2xl shadow-sm",
          compact ? "px-3 py-1.5 text-xs max-w-[90%]" : "px-4 py-2.5 max-w-[85%]",
          isUser
            ? "bg-gradient-primary text-primary-foreground"
            : "bg-card/80 backdrop-blur-sm border border-primary/10"
        )}
      >
        <div
          className={cn(
            "prose max-w-none",
            compact ? "prose-xs" : "prose-sm",
            isUser ? "prose-invert" : "prose-slate dark:prose-invert"
          )}
        >
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className={compact ? "mb-1 last:mb-0" : "mb-2 last:mb-0"}>{children}</p>,
              ul: ({ children }) => <ul className={compact ? "my-1 ml-3" : "my-2 ml-4"}>{children}</ul>,
              ol: ({ children }) => <ol className={compact ? "my-1 ml-3" : "my-2 ml-4"}>{children}</ol>,
              li: ({ children }) => <li className="my-1">{children}</li>,
              code: ({ children }) => (
                <code className={cn("bg-background/50 rounded", compact ? "px-1 py-0.5 text-xs" : "px-1.5 py-0.5 text-sm")}>
                  {children}
                </code>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {isStreaming && (
          <span className="inline-flex gap-1 ml-1">
            <span className={cn("bg-current rounded-full animate-bounce [animation-delay:-0.3s]", compact ? "w-1 h-1" : "w-1.5 h-1.5")} />
            <span className={cn("bg-current rounded-full animate-bounce [animation-delay:-0.15s]", compact ? "w-1 h-1" : "w-1.5 h-1.5")} />
            <span className={cn("bg-current rounded-full animate-bounce", compact ? "w-1 h-1" : "w-1.5 h-1.5")} />
          </span>
        )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
