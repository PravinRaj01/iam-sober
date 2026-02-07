import { Home, Heart, BookOpen, Target, Activity, TrendingUp, Settings, Trophy, Users, X, Watch, Brain, Bot, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import StorageImage from "@/components/StorageImage";
import { useSidebarOrder } from "@/hooks/useSidebarOrder";
import { useLanguage } from "@/contexts/LanguageContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import type { TranslationKey } from "@/i18n/en";

const allMenuItems: Array<{ titleKey: TranslationKey; title: string; url: string; icon: any }> = [
  { titleKey: "nav.dashboard", title: "Dashboard", url: "/", icon: Home },
  { titleKey: "nav.checkIn", title: "Check In", url: "/check-in", icon: Heart },
  { titleKey: "nav.journal", title: "Journal", url: "/journal", icon: BookOpen },
  { titleKey: "nav.goals", title: "Goals", url: "/goals", icon: Target },
  { titleKey: "nav.copingTools", title: "Coping Tools", url: "/coping", icon: Activity },
  { titleKey: "nav.progress", title: "Progress", url: "/progress", icon: TrendingUp },
  { titleKey: "nav.achievements", title: "Achievements", url: "/achievements", icon: Trophy },
  { titleKey: "nav.wearables", title: "Wearables", url: "/wearables", icon: Watch },
  { titleKey: "nav.aiCoach", title: "AI Coach", url: "/ai-agent", icon: Bot },
  { titleKey: "nav.aiInsights", title: "AI Insights", url: "/ai-observability", icon: Brain },
  { titleKey: "nav.community", title: "Community", url: "/community", icon: Users },
  { titleKey: "nav.settings", title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state, toggleSidebar, open, setOpen, openMobile, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isDevUnlocked, setIsDevUnlocked] = useState(false);
  const { order } = useSidebarOrder();
  const { t } = useLanguage();

  // Check dev tools unlock state
  useEffect(() => {
    const checkUnlock = () => {
      setIsDevUnlocked(localStorage.getItem('devToolsUnlocked') === 'true');
    };
    checkUnlock();
    window.addEventListener('storage', checkUnlock);
    return () => window.removeEventListener('storage', checkUnlock);
  }, []);

  // Build ordered menu items
  const menuItems = useMemo(() => {
    const dashboard = allMenuItems.find(item => item.title === "Dashboard")!;
    const settings = allMenuItems.find(item => item.title === "Settings")!;
    
    const allMiddleItems = allMenuItems.filter(item => 
      item.title !== "Dashboard" && item.title !== "Settings"
    );
    
    const orderedItems = order
      .map(title => allMiddleItems.find(item => item.title === title))
      .filter((item): item is typeof allMenuItems[number] => item !== undefined);
    
    const newItems = allMiddleItems.filter(item => !order.includes(item.title));
    
    return [dashboard, ...orderedItems, ...newItems, settings];
  }, [order]);

  // Fetch logo from storage
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data: pubData } = supabase.storage.from('logos').getPublicUrl('logo.png');
        if (pubData?.publicUrl) {
          setLogoUrl(pubData.publicUrl);
          return;
        }
      } catch (e) {
        // ignore
      }

      try {
        const { data: files } = await supabase.storage.from('logos').list();
        if (files && files.length > 0) {
          const { data } = supabase.storage.from('logos').getPublicUrl(files[0].name);
          setLogoUrl(data?.publicUrl ?? null);
        }
      } catch (e) {
        setLogoUrl(null);
      }
    };
    fetchLogo();
  }, []);

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isVisible = isMobile ? openMobile : true;

  return (
    <>
      {isMobile && openMobile && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setOpenMobile(false)}
        />
      )}
      
      <div 
        className={`h-screen bg-card/95 backdrop-blur-xl border-r border-border/30 transition-all duration-300 flex flex-col shrink-0 z-50
          fixed left-0 top-0 md:sticky md:top-0
          ${!isVisible ? '-translate-x-full pointer-events-none' : 'translate-x-0 pointer-events-auto'}
          ${collapsed && !isMobile ? "w-16" : "w-60"}
        `}
      >
        <div className="flex items-center justify-between px-3 py-6 border-b border-border/30 min-h-[73px]">
          {(!collapsed || isMobile) && (
            <div className="flex items-center gap-2">
              {isMobile ? (
                <>
                  <StorageImage
                    bucket="logos"
                    path="logo.png"
                    alt="I Am Sober Logo"
                    className="h-8 w-auto"
                  />
                  <h2 className="ml-1.5 text-xl font-alfa-slab text-teal-600 whitespace-nowrap">i am sober.</h2>
                </>
              ) : (
                <h2 className="text-2xl font-alfa-slab text-teal-600 ml-4 whitespace-nowrap">i am sober.</h2>
              )}
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => isMobile ? setOpenMobile(false) : toggleSidebar()}
            className={`h-8 w-8 shrink-0 hover:bg-primary/20 transition-colors ${collapsed && !isMobile ? "mx-auto" : ""}`}
            title={isMobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isMobile ? <X className="h-5 w-5" /> : (collapsed ? <Menu className="h-5 w-5" /> : "←")}
          </Button>
        </div>
        
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems
              .filter(item => {
                if (item.url === '/ai-observability') {
                  return isDevUnlocked;
                }
                return true;
              })
              .map((item) => (
              <li key={item.title}>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-primary/20 text-primary font-medium"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    } ${collapsed && !isMobile ? "justify-center" : ""}`
                  }
                  title={collapsed && !isMobile ? t(item.titleKey) : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {(!collapsed || isMobile) && <span className="truncate text-sm">{t(item.titleKey)}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
