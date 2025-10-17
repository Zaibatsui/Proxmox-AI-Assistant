// Helper to get theme-aware Tailwind classes
export const getThemeClasses = () => {
  return {
    // Buttons
    primaryButton: "theme-bg theme-bg-hover text-white",
    
    // Backgrounds
    primaryBg: "theme-bg",
    primaryBgLight: "bg-opacity-10",
    
    // Text
    primaryText: "theme-text",
    
    // Borders
    primaryBorder: "theme-border",
    
    // Icon backgrounds
    iconBg: "bg-cyan-500/10", // Will be updated via inline styles
  };
};

// Get theme color for inline styles
export const getThemeColor = () => {
  const root = getComputedStyle(document.documentElement);
  return {
    primary: root.getPropertyValue('--theme-primary').trim(),
    primaryDark: root.getPropertyValue('--theme-primary-dark').trim(),
    accent: root.getPropertyValue('--theme-accent').trim(),
  };
};
