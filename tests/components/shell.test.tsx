import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { toLoginMessage } from '@/components/LoginForm';
import { NavBar } from '@/components/NavBar';
import { RequireAuth } from '@/components/RequireAuth';

const usePathname = vi.hoisted(() => vi.fn(() => '/dashboard'));
const replace = vi.hoisted(() => vi.fn());
const useAuth = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname,
  useRouter: () => ({ replace }),
}));
vi.mock('@/components/AuthProvider', () => ({ useAuth }));

/** Narrows vitest-axe's loose result before asserting. */
async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

beforeEach(() => {
  replace.mockReset();
  useAuth.mockReset();
  usePathname.mockReturnValue('/dashboard');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NavBar', () => {
  it('links to the three operator surfaces', () => {
    render(<NavBar />);

    expect(screen.getByRole('link', { name: 'Command Center' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Incidents' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Methodology' })).toBeInTheDocument();
  });

  it('marks the active page for assistive tech, not just with colour', () => {
    render(<NavBar />);
    expect(screen.getByRole('link', { name: 'Command Center' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks only the active page', () => {
    usePathname.mockReturnValue('/incidents');
    render(<NavBar />);

    expect(screen.getByRole('link', { name: 'Incidents' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Command Center' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('is a labelled navigation landmark', () => {
    render(<NavBar />);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<NavBar />);
    await expectNoAxeViolations(container);
  });
});

describe('RequireAuth', () => {
  it('renders children for a signed-in user', () => {
    useAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false, configured: true });
    render(
      <RequireAuth>
        <p>Secret</p>
      </RequireAuth>,
    );

    expect(screen.getByText('Secret')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows a status while the session resolves, not a blank page', () => {
    useAuth.mockReturnValue({ user: null, loading: true, configured: true });
    render(
      <RequireAuth>
        <p>Secret</p>
      </RequireAuth>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/Checking your session/);
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('redirects a signed-out user and renders nothing sensitive', () => {
    useAuth.mockReturnValue({ user: null, loading: false, configured: true });
    render(
      <RequireAuth>
        <p>Secret</p>
      </RequireAuth>,
    );

    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('does not gate local development, where there is no sign-in to perform', () => {
    useAuth.mockReturnValue({ user: null, loading: false, configured: false });
    render(
      <RequireAuth>
        <p>Secret</p>
      </RequireAuth>,
    );

    expect(screen.getByText('Secret')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('toLoginMessage', () => {
  /** Account enumeration is the reason these two collapse to one message. */
  it('gives the same message for a wrong password and an unknown user', () => {
    expect(toLoginMessage({ code: 'auth/wrong-password' })).toBe(
      toLoginMessage({ code: 'auth/user-not-found' }),
    );
  });

  it('explains a rate limit', () => {
    expect(toLoginMessage({ code: 'auth/too-many-requests' })).toMatch(/Too many attempts/);
  });

  it('falls back to a generic message for an unknown code', () => {
    expect(toLoginMessage({ code: 'auth/internal-kid-mismatch' })).toBe(
      'Could not sign in. Please try again.',
    );
  });

  it('tolerates a thrown value that is not an error object', () => {
    expect(toLoginMessage('boom')).toBe('Could not sign in. Please try again.');
    expect(toLoginMessage(null)).toBe('Could not sign in. Please try again.');
    expect(toLoginMessage(undefined)).toBe('Could not sign in. Please try again.');
  });
});
