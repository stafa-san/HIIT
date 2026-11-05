import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

/** Navy sub-page header: "‹ Dashboard | Title / subtitle" + actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
  backHref = '/',
  backLabel = 'Dashboard',
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="no-print sticky top-0 z-30 bg-navy text-white shadow-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <Link href={backHref} className="flex items-center gap-1 rounded-md py-1 pr-2 text-[15px] text-white/90 hover:text-white">
          <ChevronLeft className="h-5 w-5" /> {backLabel}
        </Link>
        <div className="h-9 w-px bg-white/20" />
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-xl font-bold">{title}</h1>
          {subtitle ? <div className="text-xs text-navy-muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="ml-auto flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
