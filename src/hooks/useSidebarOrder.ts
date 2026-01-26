import { useState, useEffect } from "react";

// Default menu items order (excluding Dashboard and Settings which are fixed)
const DEFAULT_ORDER = [
  "Check In",
  "Journal", 
  "Goals",
  "Coping Tools",
  "Progress",
  "Achievements",
  "Wearables",
  "AI Coach",
  "AI Insights",
  "Community",
];

const STORAGE_KEY = "sidebarOrder";

export function useSidebarOrder() {
  const [order, setOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_ORDER;
      }
    }
    return DEFAULT_ORDER;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, [order]);

  const updateOrder = (newOrder: string[]) => {
    setOrder(newOrder);
  };

  const resetOrder = () => {
    setOrder(DEFAULT_ORDER);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { order, updateOrder, resetOrder, defaultOrder: DEFAULT_ORDER };
}
