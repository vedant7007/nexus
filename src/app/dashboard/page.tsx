import type { Metadata } from 'next';

import { AuthProvider } from '@/components/AuthProvider';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { RequireAuth } from '@/components/RequireAuth';

export const metadata: Metadata = {
  title: 'Command Center',
  description: 'Live stadium operations: crowd density, gate load, AI briefings and decisions.',
};

export default function DashboardPage() {
  return (
    <AuthProvider>
      <RequireAuth>
        <DashboardView />
      </RequireAuth>
    </AuthProvider>
  );
}
