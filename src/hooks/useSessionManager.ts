import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SESSION_KEY = "auth_session_info";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionInfo {
  loginAt: number;
  rememberMe: boolean;
}

export const getSessionInfo = (): SessionInfo | null => {
  const localData = localStorage.getItem(SESSION_KEY);
  const sessionData = sessionStorage.getItem(SESSION_KEY);
  
  if (localData) {
    try {
      return JSON.parse(localData);
    } catch {
      return null;
    }
  }
  
  if (sessionData) {
    try {
      return JSON.parse(sessionData);
    } catch {
      return null;
    }
  }
  
  return null;
};

export const setSessionInfo = (rememberMe: boolean) => {
  const info: SessionInfo = {
    loginAt: Date.now(),
    rememberMe,
  };
  
  // Clear both storages first
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  
  if (rememberMe) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(info));
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(info));
  }
};

export const clearSessionInfo = () => {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
};

export const isSessionExpired = (sessionInfo: SessionInfo | null): boolean => {
  if (!sessionInfo) return false;
  
  const now = Date.now();
  const elapsed = now - sessionInfo.loginAt;
  
  return elapsed > SEVEN_DAYS_MS;
};

export const useSessionManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const checkSessionExpiry = useCallback(async () => {
    const sessionInfo = getSessionInfo();
    
    if (sessionInfo && isSessionExpired(sessionInfo)) {
      clearSessionInfo();
      await supabase.auth.signOut();
      
      toast({
        title: "Session expired",
        description: "For your security, please sign in again.",
        variant: "default",
      });
      
      navigate("/auth");
      return true;
    }
    
    return false;
  }, [navigate, toast]);

  useEffect(() => {
    checkSessionExpiry();
  }, [checkSessionExpiry]);

  return { checkSessionExpiry };
};

export default useSessionManager;
