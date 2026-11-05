import type { Metadata } from 'next';
import { PlayerHistory } from '@/components/players/player-history';

export const metadata: Metadata = { title: 'Player history' };

export default function PlayerHistoryPage() {
  return <PlayerHistory />;
}
