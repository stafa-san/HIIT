import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
  {
    variants: {
      tone: {
        alert: 'bg-alert text-alert-foreground',
        'alert-soft': 'bg-alert-soft text-alert',
        watch: 'bg-watch-soft text-watch-foreground',
        ok: 'bg-ok-soft text-ok-foreground',
        neutral: 'bg-muted text-muted-foreground',
        success: 'bg-success-soft text-success',
        info: 'bg-info-soft text-info',
        offline: 'bg-muted text-muted-foreground',
      },
      casing: {
        upper: '',
        normal: 'normal-case tracking-normal text-xs font-semibold',
      },
    },
    defaultVariants: { tone: 'neutral', casing: 'upper' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, casing, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, casing }), className)} {...props} />;
}
