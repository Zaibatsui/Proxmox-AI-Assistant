// Inject theme styles dynamically
export function injectThemeStyles() {
  // Remove existing theme style if present
  const existingStyle = document.getElementById('dynamic-theme-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create new style element
  const style = document.createElement('style');
  style.id = 'dynamic-theme-styles';
  style.textContent = `
    /* Background Colors */
    body {
      background-color: var(--bg-primary) !important;
    }
    
    .bg-slate-950 {
      background-color: var(--bg-primary) !important;
    }
    
    .bg-slate-900 {
      background-color: var(--bg-card) !important;
    }
    
    .bg-slate-900\\/50 {
      background-color: var(--bg-card) !important;
      opacity: var(--card-opacity) !important;
      backdrop-filter: blur(var(--card-blur)) !important;
    }
    
    .border-slate-800 {
      border-color: var(--bg-border) !important;
      border-width: var(--card-border) !important;
    }
    
    /* Primary Background Colors - Buttons */
    .theme-btn-primary,
    button.bg-cyan-600,
    .bg-cyan-600 {
      background-color: var(--theme-primary) !important;
    }
    
    .theme-btn-primary:hover,
    button.bg-cyan-600:hover,
    button.hover\\:bg-cyan-700:hover,
    .bg-cyan-700:hover {
      background-color: var(--theme-primary-dark) !important;
    }
    
    /* Icon Colors */
    .theme-icon,
    .text-cyan-400 {
      color: var(--theme-primary) !important;
    }
    
    /* Icon Backgrounds - with proper opacity */
    .theme-icon-bg {
      background-color: var(--theme-primary) !important;
      opacity: 0.1 !important;
    }
    
    /* Override cyan icon backgrounds */
    .bg-cyan-500\\/10 {
      background-color: rgba(var(--theme-primary-rgb), 0.1) !important;
    }
    
    .bg-cyan-500\\/20 {
      background-color: rgba(var(--theme-primary-rgb), 0.2) !important;
    }
    
    /* Text/Link Colors */
    .theme-text {
      color: var(--theme-primary) !important;
    }
    
    a.text-cyan-400,
    button.text-cyan-400 {
      color: var(--theme-primary) !important;
    }
  `;
  
  document.head.appendChild(style);
}
