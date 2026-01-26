import { memo, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Trash2, 
  MessageSquare, 
  Search,
  MoreVertical,
  Pencil
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
}

interface ConversationListProps {
  isMobile: boolean;
  searchQuery: string;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  filteredConversations: Conversation[] | undefined;
  currentConversationId: string | null;
  handleSelectConversation: (convId: string) => void;
  handleNewConversation: () => void;
  openRenameDialog: (convId: string, currentTitle: string) => void;
  setConversationToDelete: (convId: string | null) => void;
  setShowDeleteDialog: (show: boolean) => void;
  conversationsCount: number;
}

const ConversationList = memo(({
  isMobile,
  searchQuery,
  handleSearchChange,
  searchInputRef,
  filteredConversations,
  currentConversationId,
  handleSelectConversation,
  handleNewConversation,
  openRenameDialog,
  setConversationToDelete,
  setShowDeleteDialog,
  conversationsCount,
}: ConversationListProps) => (
  <div className="flex flex-col h-full bg-card/95 border-r border-border/50">
    {/* Header */}
    <div className="p-4 border-b border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {isMobile && <SidebarTrigger className="h-8 w-8" />}
          <h2 className="text-lg font-bold">Chats</h2>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNewConversation}
          className="h-8 w-8"
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search chats..."
          className="pl-9 h-9 bg-muted/50"
        />
      </div>
    </div>
    
    {/* Conversation List */}
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {filteredConversations?.map((conv) => (
          <div
            key={conv.id}
            onClick={() => handleSelectConversation(conv.id)}
            className={`
              group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
              ${conv.id === currentConversationId 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-muted/50'
              }
            `}
          >
            <Avatar className={`h-10 w-10 border-2 ${conv.id === currentConversationId ? 'border-primary-foreground/30' : 'border-primary/20'} bg-card shrink-0`}>
              <AvatarFallback className={conv.id === currentConversationId ? 'bg-primary-foreground/20' : 'bg-primary/10'}>
                <MessageSquare className={`h-4 w-4 ${conv.id === currentConversationId ? 'text-primary-foreground' : 'text-primary'}`} />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{conv.title || "New Conversation"}</p>
              <p className={`text-xs truncate ${conv.id === currentConversationId ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
              </p>
            </div>
            
            {/* 3-dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`
                    h-7 w-7 shrink-0 transition-colors
                    ${conv.id === currentConversationId 
                      ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground' 
                      : 'bg-muted/50 hover:bg-muted text-foreground'
                    }
                  `}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  openRenameDialog(conv.id, conv.title || "New Conversation");
                }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                {conversationsCount > 1 && (
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setConversationToDelete(conv.id);
                      setShowDeleteDialog(true);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        
        {(!filteredConversations || filteredConversations.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No conversations yet</p>
            <Button
              variant="link"
              onClick={handleNewConversation}
              className="text-primary mt-2"
            >
              Start your first chat
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  </div>
));

ConversationList.displayName = "ConversationList";

export default ConversationList;
