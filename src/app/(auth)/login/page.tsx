import type { Metadata } from 'next';

import { AuthProvider } from '@/components/AuthProvider';
import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the NEXUS stadium operations command center.',
};

export default function LoginPage() {
  return (
    <AuthProvider>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <main id="main" className="flex min-h-dvh items-center justify-center px-6 py-16">
        <LoginForm />
      </main>
    </AuthProvider>
  );
}
