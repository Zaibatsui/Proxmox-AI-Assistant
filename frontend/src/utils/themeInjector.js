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
    /* Primary Background Colors - Buttons */
    .theme-btn-primary {
      background-color: var(--theme-primary) !important;
    }
    
    .theme-btn-primary:hover {
      background-color: var(--theme-primary-dark) !important;
    }
    
    /* Override cyan buttons */
    button.bg-cyan-600,
    .bg-cyan-600 {
      background-color: var(--theme-primary) !important;
    }
    
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
    
    /* Icon Backgrounds - keep transparency separate */
    .theme-icon-bg,
    .bg-cyan-500\\/10 {
      background-color: var(--theme-primary) !important;
      opacity: 0.1 !important;
    }
    
    .bg-cyan-500\\/20 {
      background-color: var(--theme-primary) !important;
      opacity: 0.2 !important;
    }
    
    /* Text Colors */
    .theme-text,
    a.text-cyan-400,
    span.text-cyan-400,
    p.text-cyan-400 {
      color: var(--theme-primary) !important;
    }
    
    /* Active Navigation */
    nav a[class*="bg-cyan-500/10"] {
      background-color: rgba(var(--theme-primary-rgb), 0.1) !important;
    }
    
    nav a[class*="text-cyan-400"] {
      color: var(--theme-primary) !important;
    }
  `;
  
  document.head.appendChild(style);
}
