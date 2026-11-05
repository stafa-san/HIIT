import type { Metadata } from 'next';
import { PlayersIndex } from '@/components/players/players-index';

export const metadata: Metadata = { title: 'Players' };

export default function PlayersPage() {
  return <PlayersIndex />;
}
