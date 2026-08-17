import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// Variant classes below mirror Cotelligent HRMS's .btn-* classes (index.css
// @layer components) — gradient-fill primary with a colored shadow and a
// hover lift is the one strong "this means go" signal, everything else
// (secondary/outline/ghost) stays quiet by comparison. rounded-xl is fixed
// here rather than driven by --radius, matching Cotelligent's split of
// "cards get 8px, controls stay at Tailwind's 12px" — the two radii are
// deliberately decoupled tokens, not the same value at two call sites.
const buttonVariants = cva('inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      default: 'text-white shadow-md shadow-primary/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/40 bg-gradient-to-r from-primary to-[hsl(var(--primary-2))]',
      destructive: 'text-white shadow-md shadow-destructive/30 hover:-translate-y-0.5 hover:shadow-lg bg-gradient-to-r from-rose-500 to-red-600',
      outline: 'border border-primary/30 bg-transparent text-primary hover:bg-primary/5',
      secondary: 'bg-white border border-input text-secondary-foreground hover:bg-muted',
      ghost: 'bg-transparent hover:bg-muted hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline'
    },
    size: {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 px-3',
      lg: 'h-11 px-8',
      icon: 'h-10 w-10'
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'default'
  }
});
const Button = React.forwardRef(({
  className,
  variant,
  size,
  asChild = false,
  ...props
}, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({
    variant,
    size,
    className
  }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';
export { Button, buttonVariants };
