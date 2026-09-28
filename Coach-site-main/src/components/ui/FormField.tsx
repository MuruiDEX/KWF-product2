"use client"

import type { InputHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
  /** id связанного инпута (ассоциация label ↔ input). */
  htmlFor?: string
}

/** Фаза 0: доступная обёртка поля (label + hint + error).
 * Не меняет логику форм — только разметка поверх существующих инпутов. */
export function FormField({ label, hint, error, children, className, htmlFor }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-dark-text dark:text-slate-100"
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs leading-relaxed text-secondary-text">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-xs leading-relaxed text-error">
          {error}
        </p>
      )}
    </div>
  )
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

/** Канонический инпут: h-11 минимум, видимый фокус, error-рамка. */
export function TextInput({ invalid, className, ...props }: TextInputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-dark-text placeholder:text-secondary-text/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/60 focus-visible:border-primary-blue/60",
        invalid
          ? "border-error"
          : "border-border hover:border-primary-blue/40",
        className
      )}
      {...props}
    />
  )
}
