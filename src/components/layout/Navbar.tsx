'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SITE_NAME } from '@/brand';
import { logout } from '@/lib/auth/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { WORKFLOW_STATUS } from '@/types';
import { isItemPending } from '@/utils/items';

export function Navbar() {
  const { user } = useAuth();
  const { items } = useInventory();
  const pathname = usePathname();

  const draftCount = items.filter(i => i.workflowStatus === WORKFLOW_STATUS.Draft).length;
  const pendingCount = items.filter(isItemPending).length;

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand" aria-label={SITE_NAME}>
        <BrandLogo variant="nav" decorative />
        <BrandWordmark />
      </Link>

      {user && (
        <div className="navbar-links">
          <Link href="/manage" className={`nav-link${pathname === '/manage' ? ' active' : ''}`}>
            Manage
            {draftCount > 0 && (
              <span className={`nav-badge ${pendingCount > 0 ? 'nav-badge--pending' : 'nav-badge--ready'}`}>
                {pendingCount > 0 ? pendingCount : draftCount}
              </span>
            )}
          </Link>
          <Link href="/upload" className={`nav-link${pathname === '/upload' ? ' active' : ''}`}>
            Upload
          </Link>
          <Link href="/settings" className={`nav-link${pathname === '/settings' ? ' active' : ''}`}>
            Settings
          </Link>
        </div>
      )}

      {user ? (
        <div className="navbar-user">
          <span className="navbar-user-name">{user.name}</span>
          <button className="btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      ) : (
        <div className="navbar-user">
          <Link href="/login" className="btn-ghost btn-sm">Sign in</Link>
          <Link href="/register" className="btn-primary btn-sm">Register</Link>
        </div>
      )}
    </nav>
  );
}
