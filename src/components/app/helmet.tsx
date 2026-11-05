import { cn } from '@/lib/utils';

/**
 * Side-profile football helmet. `dot` marks the sensor mount (crown); when
 * `alert` is set the dot pulses red.
 */
export function HelmetGraphic({
  className,
  dot = true,
  alert = false,
  tone = 'light',
}: {
  className?: string;
  dot?: boolean;
  alert?: boolean;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <svg viewBox="0 0 120 100" className={cn('overflow-visible', className)} aria-hidden="true">
      <path
        d="M22 84 C 12 64, 12 40, 28 25 C 42 12, 70 8, 88 18 C 104 27, 112 44, 112 62 L 112 66 L 70 66 L 60 84 Z"
        className={dark ? 'fill-white/10 stroke-white' : 'fill-[hsl(216_60%_95%)] stroke-navy'}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M66 46 H 112 V 66 H 66 Z"
        className={dark ? 'fill-transparent stroke-white' : 'fill-card stroke-navy'}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {dot ? (
        <g transform="translate(60 13)">
          <circle r="11" className={alert ? 'fill-alert/25' : dark ? 'fill-white/20' : 'fill-navy/15'}>
            {alert ? <animate attributeName="r" values="9;14;9" dur="1.6s" repeatCount="indefinite" /> : null}
          </circle>
          <circle r="6" className={alert ? 'fill-alert' : dark ? 'fill-white' : 'fill-navy'} />
        </g>
      ) : null}
    </svg>
  );
}

/** Small outline mark used in headers. */
export function HelmetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={cn('h-7 w-8', className)} aria-hidden="true" fill="none">
      <path
        d="M22 84 C 12 64, 12 40, 28 25 C 42 12, 70 8, 88 18 C 104 27, 112 44, 112 62 L 112 66 L 70 66 L 60 84 Z"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path d="M66 46 H 112" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
