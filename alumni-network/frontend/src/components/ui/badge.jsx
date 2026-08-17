import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// Cotelligent's badges are all soft tints (bg-{color}-50 text-{color}-700), not
// solid fills — .badge-blue/.badge-green/.badge-red/.badge-yellow in index.css.
// default reuses --accent/--accent-foreground since those are already set to
// primary-50/primary-700 (the exact badge-blue formula); success/destructive/
// warning use the literal 50/700 HSL pairs computed from Cotelligent's ramps
// since no other component needs a standalone token for them.
const badgeVariants = cva('inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2', {
  variants: {
    variant: {
      default: 'bg-accent text-accent-foreground hover:bg-accent/80',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      destructive: 'bg-[hsl(0,86%,97%)] text-[hsl(0,74%,42%)] hover:bg-[hsl(0,86%,94%)]',
      success: 'bg-[hsl(152,81%,96%)] text-[hsl(163,94%,24%)] ring-1 ring-[hsl(149,80%,90%)] hover:bg-[hsl(152,81%,92%)]',
      warning: 'bg-[hsl(48,100%,96%)] text-[hsl(26,90%,37%)] hover:bg-[hsl(48,100%,92%)]',
      outline: 'text-foreground border-border'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});
function Badge({
  className,
  variant,
  ...props
}) {
  return <div className={cn(badgeVariants({
    variant
  }), className)} {...props} />;
}
export { Badge, badgeVariants };
