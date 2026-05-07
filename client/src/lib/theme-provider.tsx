import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type LogoTheme = "original" | "blue-tech" | "green-stock" | "orange-ops" | "black-gold";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  logoTheme: LogoTheme;
  setLogoTheme: (t: LogoTheme) => void;
  customizerOpen: boolean;
  openCustomizer: () => void;
  closeCustomizer: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "light";
  });

  const [logoTheme, setLogoThemeState] = useState<LogoTheme>(() => {
    return (localStorage.getItem("wms:logo-theme") as LogoTheme) || "original";
  });

  const [customizerOpen, setCustomizerOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-logo-theme", logoTheme);
    localStorage.setItem("wms:logo-theme", logoTheme);
  }, [logoTheme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState(prev => prev === "light" ? "dark" : "light");
  const setLogoTheme = (t: LogoTheme) => setLogoThemeState(t);
  const openCustomizer = () => setCustomizerOpen(true);
  const closeCustomizer = () => setCustomizerOpen(false);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, toggleTheme,
      logoTheme, setLogoTheme,
      customizerOpen, openCustomizer, closeCustomizer,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
