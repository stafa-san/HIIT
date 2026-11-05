import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { DataProvider } from '@/components/app/data-provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'H.I.T.T. · Sideline', template: '%s · H.I.T.T.' },
  description: 'Helmet-Integrated TBI Tracker — real-time impact alerts, sensor fleet and return-to-play tracking for high school football.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'H.I.T.T.', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#13284b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <DataProvider>{children}</DataProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
