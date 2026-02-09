import { useState, useRef, useEffect, useCallback, memo } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useChatHead } from "@/contexts/ChatHeadContext";

const FloatingChatHead = memo(() => {
  const { 
    isEnabled, 
    isOpen, 
    unreadCount, 
    position, 
    openChat, 
    setPosition 
  } = useChatHead();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentY, setCurrentY] = useState(position.y);
  const [currentSide, setCurrentSide] = useState(position.side);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Sync with stored position
  useEffect(() => {
    setCurrentY(position.y);
    setCurrentSide(position.side);
  }, [position]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!buttonRef.current) return;
    
    const touch = e.touches[0];
    const rect = buttonRef.current.getBoundingClientRect();
    
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
    hasMoved.current = false;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - startPosRef.current.y);
    
    // Only start visual drag if moved more than threshold
    if (deltaX > 5 || deltaY > 5) {
      hasMoved.current = true;
    }
    
    const newY = touch.clientY - dragOffset.y;
    const screenWidth = window.innerWidth;
    const newSide = touch.clientX < screenWidth / 2 ? "left" : "right";
    
    // Clamp Y to screen bounds
    const clampedY = Math.max(50, Math.min(window.innerHeight - 100, newY));
    
    setCurrentY(clampedY);
    setCurrentSide(newSide);
  }, [isDragging, dragOffset]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      
      if (hasMoved.current) {
        // Save new position
        setPosition({
          x: 0,
          y: currentY,
          side: currentSide
        });
      } else {
        // It was a tap, not a drag
        openChat();
      }
    }
  }, [isDragging, currentY, currentSide, setPosition, openChat]);

  const handleClick = useCallback(() => {
    // For non-touch devices
    if (!isDragging) {
      openChat();
    }
  }, [isDragging, openChat]);

  // Don't render if disabled or chat is already open
  if (!isEnabled || isOpen) return null;

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        "fixed z-50 h-14 w-14 rounded-full shadow-elegant transition-all duration-200",
        "bg-gradient-primary hover:scale-110 shadow-glow",
        "flex items-center justify-center touch-none select-none",
        isDragging && "scale-110 opacity-90",
        currentSide === "right" ? "right-4" : "left-4"
      )}
      style={{
        top: `${currentY}px`,
        transition: isDragging ? "none" : "top 0.2s ease-out, transform 0.2s ease-out"
      }}
      aria-label="Open AI Coach chat"
    >
      {unreadCount > 0 ? (
        <Sparkles className="h-6 w-6 text-primary-foreground animate-pulse" />
      ) : (
        <MessageCircle className="h-6 w-6 text-primary-foreground" />
      )}
      
      {unreadCount > 0 && (
        <Badge 
          className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-xs animate-pulse"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
      )}
    </button>
  );
});

FloatingChatHead.displayName = "FloatingChatHead";

export default FloatingChatHead;
