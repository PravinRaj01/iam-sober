import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { extractDominantColors } from "@/utils/colorExtractor";

interface BackgroundContextType {
  backgroundImage: string | null;
  setBackgroundImage: (url: string | null) => void;
  dominantColors: { primary: string; secondary: string; accent: string } | null;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export const BackgroundProvider = ({ children }: { children: ReactNode }) => {
  const [backgroundImage, setBackgroundImageState] = useState<string | null>(null);
  const [dominantColors, setDominantColors] = useState<{ primary: string; secondary: string; accent: string } | null>(null);
  const [attemptedUrls, setAttemptedUrls] = useState<Set<string>>(new Set());
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const setBackgroundImage = async (url: string | null) => {
    // Prevent re-attempting failed URLs
    if (url && failedUrls.has(url)) {
      return;
    }

    // Prevent multiple attempts for the same URL
    if (url && attemptedUrls.has(url)) {
      return;
    }

    setBackgroundImageState(url);
    
    if (url) {
      // Mark as attempted
      setAttemptedUrls(prev => new Set([...prev, url]));

      try {
        const colors = await extractDominantColors(url);
        setDominantColors(colors);
        
        // Update CSS custom properties
        const root = document.documentElement;
        root.style.setProperty('--bg-primary', colors.primary);
        root.style.setProperty('--bg-secondary', colors.secondary);
        root.style.setProperty('--bg-accent', colors.accent);
      } catch (error) {
        // Mark as failed to prevent retry
        setFailedUrls(prev => new Set([...prev, url]));
        console.error("Failed to extract colors from background image. Using defaults.");
      }
    } else {
      setDominantColors(null);
      // Reset to default
      const root = document.documentElement;
      root.style.removeProperty('--bg-primary');
      root.style.removeProperty('--bg-secondary');
      root.style.removeProperty('--bg-accent');
    }
  };

  return (
    <BackgroundContext.Provider value={{ backgroundImage, setBackgroundImage, dominantColors }}>
      {children}
    </BackgroundContext.Provider>
  );
};

export const useBackground = () => {
  const context = useContext(BackgroundContext);
  if (!context) {
    throw new Error("useBackground must be used within BackgroundProvider");
  }
  return context;
};
