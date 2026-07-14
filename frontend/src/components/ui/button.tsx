import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background shadow-sm hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        accent: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        outline: 'border border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/60',
        ghost: 'hover:bg-muted/70 hover:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground shadow-subtle hover:bg-destructive/80',
        muted: 'bg-muted text-muted-foreground hover:bg-muted/80',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-11 rounded-xl px-5 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);

Button.displayName = 'Button';
