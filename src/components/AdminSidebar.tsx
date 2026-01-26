import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Bot, AlertTriangle, TrendingUp, Users, ArrowLeft, Shield, LogOut, Sparkles, BarChart3, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminSidebarProps { 
  onLogout: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const adminMenuItems = [{ title: "Overview", url: "/admin", icon: LayoutDashboard }];
const analyticsItems = [
  { title: "AI Analytics", url: "/admin/ai-analytics", icon: Bot, badge: "Live" },
  { title: "Error Logs", url: "/admin/errors", icon: AlertTriangle },
  { title: "Interventions", url: "/admin/interventions", icon: TrendingUp },
  { title: "User Stats", url: "/admin/users", icon: Users },
];

export function AdminSidebar({ onLogout, isMobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState<boolean | null>(null);
  const [isTablet, setIsTablet] = useState(false);
  
  // Detect tablet breakpoint (md to lg: 768px to 1024px)
  useEffect(() => {
    const checkTablet = () => {
      const width = window.innerWidth;
      const tablet = width >= 768 && width < 1024;
      setIsTablet(tablet);
      // Auto-collapse on tablet if not manually set
      if (isManuallyCollapsed === null && tablet) {
        setIsManuallyCollapsed(true);
      }
    };
    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, [isManuallyCollapsed]);
  
  // Toggle function that works for both tablet and desktop
  const toggleCollapsed = () => {
    setIsManuallyCollapsed(prev => prev === null ? false : !prev);
  };
  
  // Use manual state if set, otherwise default to collapsed on tablet
  const isCollapsed = isManuallyCollapsed ?? isTablet;
  
  // Handle nav click on mobile - close sidebar
  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile overlay - only on mobile, not tablet */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      
      <aside 
        className={cn(
          "border-r border-border bg-card/50 backdrop-blur-sm flex flex-col h-screen transition-all duration-300 shrink-0",
          // Mobile: fixed positioning with slide animation, tablet+desktop: relative
          "fixed md:relative z-50",
          "top-0 left-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Width: collapsed on tablet or when manually collapsed on desktop
          isCollapsed && !isMobileOpen ? "md:w-16" : "w-64"
        )}
      >
        <div className={cn(
          "p-3 sm:p-4 border-b border-border flex items-center min-h-[73px]",
          isCollapsed && !isMobileOpen ? "md:justify-center" : "justify-between gap-2"
        )}>
          <div className={cn(
            "flex items-center gap-2 transition-opacity",
            isCollapsed && !isMobileOpen ? "md:hidden" : "opacity-100"
          )}>
            <div className="p-2 rounded-lg bg-destructive/10 shrink-0">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground truncate">Admin Panel</h2>
              <p className="text-xs text-muted-foreground truncate">Opik Dashboard</p>
            </div>
          </div>
          
          {/* Mobile close button - only on mobile */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMobileClose}
            className="md:hidden h-8 w-8 shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
          
          {/* Tablet/Desktop toggle button - centered when collapsed */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleCollapsed}
            className={cn(
              "hidden md:flex h-8 w-8 shrink-0 hover:bg-primary/20 transition-colors",
              isCollapsed && !isMobileOpen ? "mx-auto" : ""
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <Menu className="h-5 w-5" /> : "←"}
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <nav className="p-2 sm:p-3 space-y-1">
            {adminMenuItems.map((item) => (
              <NavLink 
                key={item.title} 
                to={item.url} 
                end 
                onClick={handleNavClick}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed && !isMobileOpen ? "md:justify-center md:px-2" : ""
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className={cn(
                  "truncate transition-opacity",
                  isCollapsed && !isMobileOpen ? "md:hidden" : ""
                )}>
                  {item.title}
                </span>
              </NavLink>
            ))}
          </nav>
          
          <Separator className="mx-3" />
          
          <div className="p-2 sm:p-3">
            <p className={cn(
              "text-xs font-medium px-3 mb-2 flex items-center gap-1",
              isCollapsed && !isMobileOpen 
                ? "md:justify-center md:px-0 text-muted-foreground/40" 
                : "text-muted-foreground"
            )}>
              <BarChart3 className={cn(
                "h-3 w-3 shrink-0",
                isCollapsed && !isMobileOpen ? "opacity-40" : ""
              )} />
              <span className={cn(isCollapsed && !isMobileOpen ? "md:hidden" : "")}>Analytics</span>
            </p>
            <div className="space-y-1">
              {analyticsItems.map((item) => (
                <NavLink 
                  key={item.title} 
                  to={item.url}
                  onClick={handleNavClick}
                className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isCollapsed && !isMobileOpen ? "md:justify-center md:px-2" : ""
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className={cn(
                    "flex-1 truncate",
                    isCollapsed && !isMobileOpen ? "md:hidden" : ""
                  )}>
                    {item.title}
                  </span>
                  {item.badge && !isCollapsed && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
          
          <Separator className="mx-3" />
          
          <div className={cn(
            "p-2 sm:p-3",
            isCollapsed && !isMobileOpen ? "md:hidden" : ""
          )}>
            <div className="p-3 rounded-lg bg-muted/50 border border-dashed border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3 shrink-0" />
                <span>All data is anonymized</span>
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <div className="p-2 sm:p-3 border-t border-border space-y-2">
          <NavLink 
            to="/"
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              isCollapsed && !isMobileOpen ? "md:justify-center md:px-2" : ""
            )}
            title={isCollapsed ? "Back to App" : undefined}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className={cn(isCollapsed && !isMobileOpen ? "md:hidden" : "")}>Back to App</span>
          </NavLink>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "w-full text-destructive hover:text-destructive hover:bg-destructive/10",
              isCollapsed && !isMobileOpen ? "md:justify-center" : "justify-start"
            )}
            onClick={onLogout}
            title={isCollapsed ? "Logout Admin" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn("ml-2", isCollapsed && !isMobileOpen ? "md:hidden" : "")}>Logout Admin</span>
          </Button>
        </div>
      </aside>
    </>
  );
}