"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ThemeValue } from "@/lib/types";
import { getStoredTheme, initTheme, setStoredTheme } from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeValue;
  setTheme: (theme: ThemeValue) => void;
  showThemeModal: boolean;
  modalSelection: ThemeValue;
  setModalSelection: (theme: ThemeValue) => void;
  openThemeModal: () => void;
  closeThemeModal: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeValue {
  if (typeof window === "undefined") {
    return "default";
  }
  return getStoredTheme();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeValue>(readInitialTheme);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [modalSelection, setModalSelection] = useState<ThemeValue>(theme);

  useEffect(() => {
    initTheme();
  }, []);

  const setTheme = (value: ThemeValue) => {
    setStoredTheme(value);
    setThemeState(value);
  };

  const openThemeModal = () => {
    const current = getStoredTheme();
    setModalSelection(current);
    setShowThemeModal(true);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        showThemeModal,
        modalSelection,
        setModalSelection,
        openThemeModal,
        closeThemeModal: () => setShowThemeModal(false),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
