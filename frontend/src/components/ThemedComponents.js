import { Button } from "@/components/ui/button";

export function ThemedButton({ children, className = "", ...props }) {
  return (
    <Button
      {...props}
      className={`text-white ${className}`}
      style={{
        backgroundColor: 'var(--theme-primary)',
        borderColor: 'var(--theme-primary)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--theme-primary-dark)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--theme-primary)';
      }}
    >
      {children}
    </Button>
  );
}

export function ThemedIconBg({ children, className = "" }) {
  return (
    <div
      className={`p-2 rounded-lg ${className}`}
      style={{
        backgroundColor: 'var(--theme-primary)',
        opacity: 0.1,
      }}
    >
      {children}
    </div>
  );
}

export function ThemedText({ children, className = "" }) {
  return (
    <span
      className={className}
      style={{
        color: 'var(--theme-primary)',
      }}
    >
      {children}
    </span>
  );
}
