import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showBackButton?: boolean;
}

/**
 * Consistent header component for all pages.
 * - Mobile: Shows menu trigger + title in header (no duplicate title in content)
 * - Tablet/Desktop: Shows back button + optional actions
 */
export function PageHeader({ title, subtitle, actions, showBackButton = true }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-30">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile: Menu trigger */}
            <SidebarTrigger className="md:hidden shrink-0" />
            
            {/* Desktop: Back button */}
            {showBackButton && (
              <Button 
                variant="ghost" 
                onClick={() => navigate("/")} 
                className="hidden md:inline-flex items-center gap-2 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
            )}
            
            {/* Title - mobile only */}
            <div className="min-w-0 flex-1 md:hidden">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
            </div>
          </div>
          
          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
