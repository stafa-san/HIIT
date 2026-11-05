import type { Metadata } from 'next';
import { SensorManagement } from '@/components/sensors/sensor-management';

export const metadata: Metadata = { title: 'Sensor management' };

export default function SensorsPage() {
  return <SensorManagement />;
}
