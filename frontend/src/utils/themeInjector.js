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
    /* Primary buttons */
    .btn-primary,
    [class*="bg-cyan-6"] {
      background-color: var(--theme-primary) !important;
    }
    
    .btn-primary:hover,
    [class*="bg-cyan-7"]:hover,
    [class*="hover:bg-cyan"] {
      background-color: var(--theme-primary-dark) !important;
    }
    
    /* Icon backgrounds */
    [class*="bg-cyan-500/10"] {
      background-color: var(--theme-primary) !important;
      opacity: 0.1 !important;
    }
    
    [class*="bg-cyan-500/20"] {
      background-color: var(--theme-primary) !important;
      opacity: 0.2 !important;
    }
    
    /* Text colors */
    [class*="text-cyan-4"] {
      color: var(--theme-primary) !important;
    }
    
    /* Active nav items */
    .bg-cyan-500\\/10 {
      background-color: var(--theme-primary) !important;
      opacity: 0.1 !important;
    }
    
    .text-cyan-400 {
      color: var(--theme-primary) !important;
    }
    
    /* Specific button overrides */
    button.bg-cyan-600,
    button[class*="bg-cyan-6"] {
      background-color: var(--theme-primary) !important;
    }
    
    button.bg-cyan-600:hover,
    button.hover\\:bg-cyan-700:hover,
    button[class*="bg-cyan-6"]:hover {
      background-color: var(--theme-primary-dark) !important;
    }
  `;
  
  document.head.appendChild(style);
}
