'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
// Matches Cotelligent's .label { text-sm font-medium text-gray-700 } — reusing
// --secondary-foreground since that token is already set to gray-700 above.
const labelVariants = cva('text-sm font-medium text-secondary-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70');
const Label = React.forwardRef(({
  className,
  ...props
}, ref) => <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />);
Label.displayName = LabelPrimitive.Root.displayName;
export { Label };
