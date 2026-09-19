import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
  {
    variants: {
      variant: {
        neutral: 'bg-border/40 text-secondary border-border',
        primary: 'bg-primary/15 text-primary-ink border-primary/30',
        'accent-emerald': 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30',
        'accent-amber': 'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
        danger: 'bg-danger/15 text-danger border-danger/30',
        outline: 'border-border-2 text-secondary',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}