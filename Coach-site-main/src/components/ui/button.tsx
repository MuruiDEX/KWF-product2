"use client"

import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "default" | "secondary" | "ghost" | "outline"
  size?: "default" | "lg" | "sm"
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/60 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99]",
          size === "default" && "h-14 px-7 text-base",
          size === "lg" && "h-16 px-10 text-lg",
          size === "sm" && "h-9 px-4 text-sm",
          (variant === "primary" || variant === "default") &&
            "bg-dark-blue text-white hover:bg-primary-blue hover:-translate-y-0.5 rounded-lg shadow-sm hover:shadow-lg dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37] dark:shadow-gold/20",
          variant === "secondary" &&
            "bg-white text-dark-blue border-2 border-dark-blue hover:bg-dark-blue hover:text-white hover:-translate-y-0.5 rounded-lg dark:bg-transparent dark:text-white dark:border-white/25 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-white/40",
          variant === "ghost" &&
            "bg-transparent text-dark-blue hover:bg-dark-blue hover:text-white hover:-translate-y-0.5 rounded-lg dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white",
          variant === "outline" &&
            "bg-white text-dark-blue border border-border hover:border-primary-blue/40 hover:bg-light-gray rounded-lg dark:bg-white/5 dark:text-white dark:border-white/15 dark:hover:border-white/30 dark:hover:bg-white/10",
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
