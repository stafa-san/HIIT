import type { Metadata, Viewport } from 'next';
import { CoachView } from '@/components/mobile/coach-view';

export const metadata: Metadata = { title: 'Coach alerts' };
export const viewport: Viewport = { themeColor: '#13284b' };

export default function CoachPage() {
  return <CoachView />;
}
