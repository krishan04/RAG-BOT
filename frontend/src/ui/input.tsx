import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-lg border border-border bg-surface-card px-3 text-sm text-primary placeholder:text-faint transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full resize-none rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-primary placeholder:text-faint transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'