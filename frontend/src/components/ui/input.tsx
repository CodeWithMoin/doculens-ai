import * as React from 'react';

import { cn } from '../../lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));

Input.displayName = 'Input';
