import { Suspense } from 'react';
import { Dashboard } from '@/components/dashboard/dashboard';

export default function SidelinePage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
