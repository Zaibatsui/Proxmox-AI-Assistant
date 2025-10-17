import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { API } from "../App";
import { injectThemeStyles } from "../utils/themeInjector";

const ThemeContext = createContext();

export const themes = {
  cyan: {
    name: "Cyan Ocean",
    primary: "cyan",
    primaryLight: "6, 182, 212", // RGB for cyan-500
    primaryDark: "8, 145, 178",
    accent: "34, 211, 238"
  },
  purple: {
    name: "Purple Haze",
    primary: "purple",
    primaryLight: "168, 85, 247",
    primaryDark: "126, 34, 206",
    accent: "192, 132, 252"
  },
  emerald: {
    name: "Emerald Forest",
    primary: "emerald",
    primaryLight: "16, 185, 129",
    primaryDark: "5, 150, 105",
    accent: "52, 211, 153"
  },
  amber: {
    name: "Amber Sunset",
    primary: "amber",
    primaryLight: "245, 158, 11",
    primaryDark: "217, 119, 6",
    accent: "251, 191, 36"
  },
  blue: {
    name: "Deep Blue",
    primary: "blue",
    primaryLight: "59, 130, 246",
    primaryDark: "29, 78, 216",
    accent: "96, 165, 250"
  },
  rose: {
    name: "Rose Garden",
    primary: "rose",
    primaryLight: "244, 63, 94",
    primaryDark: "225, 29, 72",
    accent: "251, 113, 133"
  }
};

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState("cyan");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTheme();
  }, []);

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const fetchTheme = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await axios.get(`${API}/theme`);
        setCurrentTheme(response.data.theme_name || "cyan");
      }
    } catch (error) {
      console.error("Failed to fetch theme:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (themeName) => {
    const theme = themes[themeName] || themes.cyan;
    const root = document.documentElement;
    
    root.style.setProperty("--theme-primary", theme.primaryLight);
    root.style.setProperty("--theme-primary-dark", theme.primaryDark);
    root.style.setProperty("--theme-accent", theme.accent);
    
    // Inject dynamic theme styles
    injectThemeStyles();
    
    // Store in localStorage for instant load
    localStorage.setItem("theme", themeName);
  };

  const updateTheme = async (themeName) => {
    try {
      await axios.post(`${API}/theme`, { theme_name: themeName });
      setCurrentTheme(themeName);
      return true;
    } catch (error) {
      console.error("Failed to update theme:", error);
      return false;
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, updateTheme, themes, loading }}>
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
