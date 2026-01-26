import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChatbotState } from "./ChatbotDrawer";

interface ChatbotButtonProps {
  onClick: () => void;
  unreadCount?: number;
  state: ChatbotState;
}

const ChatbotButton = ({ onClick, unreadCount = 0, state }: ChatbotButtonProps) => {
  const isClosed = state === 'closed';

  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-elegant transition-all duration-300",
        isClosed
          ? "bg-gradient-primary hover:scale-110 shadow-glow"
          : "bg-card/80 backdrop-blur-sm border-2 border-primary/20 hover:border-primary/40 scale-95"
      )}
      aria-label="Open AI Coach"
    >
      {isClosed ? (
        <MessageCircle className="h-6 w-6" />
      ) : (
        <Sparkles className="h-6 w-6 text-primary animate-pulse" />
      )}
      {unreadCount > 0 && isClosed && (
        <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-xs animate-pulse">
          {unreadCount}
        </Badge>
      )}
    </Button>
  );
};

export default ChatbotButton;
