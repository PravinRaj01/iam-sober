import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { lazy, Suspense, useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import CheckIn from "./pages/CheckIn";
import Journal from "./pages/Journal";
import Goals from "./pages/Goals";
import CopingTools from "./pages/CopingTools";
import Achievements from "./pages/Achievements";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";
import Community from "./pages/Community";
import WearableData from "./pages/WearableData";
import AIObservability from "./pages/AIObservability";
import AIAgent from "./pages/AIAgent";
// AICapabilities merged into AIObservability as easter egg
import Install from "./pages/Install";
import { OnboardingWizard } from "./components/OnboardingWizard";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./layouts/AdminLayout";
import { ChatHeadProvider, useChatHead } from "@/contexts/ChatHeadContext";
import FloatingChatHead from "@/components/chatbot/FloatingChatHead";
import ChatbotDrawer from "@/components/chatbot/ChatbotDrawer";

const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AIAnalytics = lazy(() => import("./pages/admin/AIAnalytics"));
const ErrorLogs = lazy(() => import("./pages/admin/ErrorLogs"));
const Interventions = lazy(() => import("./pages/admin/Interventions"));
const UserStats = lazy(() => import("./pages/admin/UserStats"));

const queryClient = new QueryClient();

const AdminLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center space-y-2">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Chat head overlay component that shows the floating button and drawer
const ChatHeadOverlay = () => {
  const location = useLocation();
  const { isEnabled, isOpen, closeChat } = useChatHead();
  
  // Don't show chat head on AI Agent page (already has full chat)
  const isAIAgentPage = location.pathname === "/ai-agent";
  
  if (!isEnabled || isAIAgentPage) return null;
  
  return (
    <>
      <FloatingChatHead />
      <ChatbotDrawer 
        state={isOpen ? "mini" : "closed"} 
        onStateChange={(state) => {
          if (state === "closed") closeChat();
        }} 
      />
    </>
  );
};

const AppContent = () => {
  // Track dev tools unlock state reactively
  const [isDevUnlocked, setIsDevUnlocked] = useState(() => 
    localStorage.getItem('devToolsUnlocked') === 'true'
  );

  useEffect(() => {
    const checkUnlock = () => {
      setIsDevUnlocked(localStorage.getItem('devToolsUnlocked') === 'true');
    };
    window.addEventListener('storage', checkUnlock);
    return () => window.removeEventListener('storage', checkUnlock);
  }, []);

  // Handle service worker navigation messages from push notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.url) {
          window.location.href = event.data.url;
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, []);

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/onboarding" element={<OnboardingWizard />} />
      <Route path="/install" element={<Install />} />
      <Route path="/admin/login" element={<Suspense fallback={<AdminLoader />}><AdminLogin /></Suspense>} />

      {/* Admin routes */}
      <Route path="/admin" element={<AdminLayout><Suspense fallback={<AdminLoader />}><AdminPanel /></Suspense></AdminLayout>} />
      <Route path="/admin/ai-analytics" element={<AdminLayout><Suspense fallback={<AdminLoader />}><AIAnalytics /></Suspense></AdminLayout>} />
      <Route path="/admin/errors" element={<AdminLayout><Suspense fallback={<AdminLoader />}><ErrorLogs /></Suspense></AdminLayout>} />
      <Route path="/admin/interventions" element={<AdminLayout><Suspense fallback={<AdminLoader />}><Interventions /></Suspense></AdminLayout>} />
      <Route path="/admin/users" element={<AdminLayout><Suspense fallback={<AdminLoader />}><UserStats /></Suspense></AdminLayout>} />

      <Route path="/*" element={
        <ChatHeadProvider>
          <SidebarProvider>
            <div className="min-h-screen flex w-full min-w-0 bg-background relative overflow-x-hidden">
              <AppSidebar />
              <main className="flex-1 min-w-0 overflow-auto overflow-x-hidden relative z-10 h-screen">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/check-in" element={<CheckIn />} />
                  <Route path="/journal" element={<Journal />} />
                  <Route path="/goals" element={<Goals />} />
                  <Route path="/coping" element={<CopingTools />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/wearables" element={<WearableData />} />
                  <Route path="/ai-observability" element={isDevUnlocked ? <AIObservability /> : <Navigate to="/settings" replace />} />
                  <Route path="/ai-agent" element={<AIAgent />} />
                  {/* AICapabilities merged into AIObservability */}
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <ChatHeadOverlay />
            </div>
          </SidebarProvider>
        </ChatHeadProvider>
      } />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
