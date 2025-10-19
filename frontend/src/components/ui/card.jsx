import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
    {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    style={{ 
      padding: 'calc(1.5rem * var(--layout-density))', 
      ...style 
    }}
    {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, style, noPaddingTop, ...props }, ref) => {
  const paddingStyle = noPaddingTop !== undefined 
    ? {
        padding: 'calc(1.5rem * var(--layout-density))',
        paddingTop: noPaddingTop ? 0 : 'calc(1.5rem * var(--layout-density))',
        ...style
      }
    : {
        padding: 'calc(1.5rem * var(--layout-density))',
        ...style
      };
  
  return (
    <div 
      ref={ref} 
      className={cn(className)} 
      style={paddingStyle}
      {...props} 
    />
  );
})
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-0", className)}
    style={{ 
      padding: 'calc(1.5rem * var(--layout-density))',
      paddingTop: 0,
      ...style 
    }}
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
