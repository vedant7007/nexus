import type { Metadata } from 'next';

import { AuthProvider } from '@/components/AuthProvider';
import { IncidentsView } from '@/components/incidents/IncidentsView';
import { RequireAuth } from '@/components/RequireAuth';

export const metadata: Metadata = {
  title: 'Incident Copilot',
  description: 'Report an incident in any language and have it translated, triaged, and routed.',
};

export default function IncidentsPage() {
  return (
    <AuthProvider>
      <RequireAuth>
        <IncidentsView />
      </RequireAuth>
    </AuthProvider>
  );
}
