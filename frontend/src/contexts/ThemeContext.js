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
  const [background, setBackground] = useState("dark");
  const [cardStyle, setCardStyle] = useState("glass");
  const [accentColor, setAccentColor] = useState(null);
  // Advanced appearance options
  const [primaryColor, setPrimaryColor] = useState(null);
  const [secondaryColor, setSecondaryColor] = useState(null);
  const [sidebarBgColor, setSidebarBgColor] = useState(null);
  const [headerBgColor, setHeaderBgColor] = useState(null);
  const [layoutDensity, setLayoutDensity] = useState("comfortable");
  const [borderRadius, setBorderRadius] = useState("rounded");
  const [shadowIntensity, setShadowIntensity] = useState("medium");
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTheme();
  }, []);

  useEffect(() => {
    applyTheme(currentTheme, background, cardStyle, accentColor, primaryColor, secondaryColor, 
               sidebarBgColor, headerBgColor, layoutDensity, borderRadius, shadowIntensity, sidebarWidth);
  }, [currentTheme, background, cardStyle, accentColor, primaryColor, secondaryColor, 
      sidebarBgColor, headerBgColor, layoutDensity, borderRadius, shadowIntensity, sidebarWidth]);

  const fetchTheme = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await axios.get(`${API}/theme`);
        setCurrentTheme(response.data.theme_name || "cyan");
        setBackground(response.data.background || "dark");
        setCardStyle(response.data.card_style || "glass");
        setAccentColor(response.data.accent_color);
        setPrimaryColor(response.data.primary_color);
        setSecondaryColor(response.data.secondary_color);
        setSidebarBgColor(response.data.sidebar_bg_color);
        setHeaderBgColor(response.data.header_bg_color);
        setLayoutDensity(response.data.layout_density || "comfortable");
        setBorderRadius(response.data.border_radius || "rounded");
        setShadowIntensity(response.data.shadow_intensity || "medium");
        setSidebarWidth(response.data.sidebar_width || 256);
      }
    } catch (error) {
      console.error("Failed to fetch theme:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (themeName, bg, cardStyle, accent, primary, secondary, sidebarBg, headerBg, 
                      density, radius, shadow, sidebarW) => {
    const theme = themes[themeName] || themes.cyan;
    const root = document.documentElement;
    
    // Set color variables (use custom colors if provided, otherwise use theme defaults)
    root.style.setProperty("--theme-primary-rgb", primary || theme.primaryLight);
    root.style.setProperty("--theme-primary", `rgb(${primary || theme.primaryLight})`);
    root.style.setProperty("--theme-primary-dark", `rgb(${theme.primaryDark})`);
    root.style.setProperty("--theme-accent", accent ? `rgb(${accent})` : `rgb(${theme.accent})`);
    
    // Custom colors
    if (secondary) {
      root.style.setProperty("--theme-secondary", `rgb(${secondary})`);
    } else {
      root.style.setProperty("--theme-secondary", `rgb(${theme.accent})`);
    }
    
    // Background colors
    const backgrounds = {
      dark: { bg: "#020617", card: "#0f172a", border: "#1e293b" },
      darker: { bg: "#000000", card: "#0a0a0a", border: "#1a1a1a" },
      midnight: { bg: "#0c1222", card: "#1a2332", border: "#2a3442" }
    };
    
    const bgColors = backgrounds[bg] || backgrounds.dark;
    root.style.setProperty("--bg-primary", bgColors.bg);
    root.style.setProperty("--bg-card", bgColors.card);
    root.style.setProperty("--bg-border", bgColors.border);
    
    // Sidebar and header backgrounds
    if (sidebarBg) {
      root.style.setProperty("--sidebar-bg", `rgb(${sidebarBg})`);
    } else {
      root.style.setProperty("--sidebar-bg", bgColors.card);
    }
    
    if (headerBg) {
      root.style.setProperty("--header-bg", `rgb(${headerBg})`);
    } else {
      root.style.setProperty("--header-bg", bgColors.card);
    }
    
    // Card styles
    const cardStyles = {
      glass: { opacity: "0.5", blur: "12px", border: "1px" },
      solid: { opacity: "1", blur: "0px", border: "0px" },
      bordered: { opacity: "0.8", blur: "0px", border: "2px" }
    };
    
    const cardStyleConfig = cardStyles[cardStyle] || cardStyles.glass;
    root.style.setProperty("--card-opacity", cardStyleConfig.opacity);
    root.style.setProperty("--card-blur", cardStyleConfig.blur);
    root.style.setProperty("--card-border", cardStyleConfig.border);
    
    // Layout density
    const densityValues = {
      compact: "0.75",
      comfortable: "1",
      spacious: "1.25"
    };
    root.style.setProperty("--layout-density", densityValues[density] || "1");
    
    // Border radius
    const radiusValues = {
      sharp: "0px",
      rounded: "0.5rem",
      "very-rounded": "1rem"
    };
    root.style.setProperty("--border-radius", radiusValues[radius] || "0.5rem");
    
    // Shadow intensity
    const shadowValues = {
      none: "0 0 0 rgba(0, 0, 0, 0)",
      subtle: "0 1px 3px rgba(0, 0, 0, 0.12)",
      medium: "0 4px 6px rgba(0, 0, 0, 0.1)",
      strong: "0 10px 15px rgba(0, 0, 0, 0.3)"
    };
    root.style.setProperty("--shadow", shadowValues[shadow] || shadowValues.medium);
    
    // Sidebar width
    root.style.setProperty("--sidebar-width", `${sidebarW || 256}px`);
    
    // Apply body background
    document.body.style.backgroundColor = bgColors.bg;
    
    // Inject dynamic theme styles
    injectThemeStyles();
    
    // Store in localStorage
    localStorage.setItem("theme", themeName);
    localStorage.setItem("background", bg);
    localStorage.setItem("cardStyle", cardStyle);
  };

  const updateTheme = async (themeName, bg, cardStyle, accent) => {
    try {
      await axios.post(`${API}/theme`, {
        theme_name: themeName,
        background: bg,
        card_style: cardStyle,
        accent_color: accent
      });
      setCurrentTheme(themeName);
      setBackground(bg);
      setCardStyle(cardStyle);
      setAccentColor(accent);
      return true;
    } catch (error) {
      console.error("Failed to update theme:", error);
      return false;
    }
  };

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      background,
      cardStyle,
      accentColor,
      updateTheme,
      themes,
      loading
    }}>
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
