import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useItems } from '../contexts/ItemsContext';
import { getExportableItems } from '../utils/ebayMapper';
import { BrandLink } from './BrandLink';

export function Navbar() {
  const { user, logout } = useAuth();
  const { items } = useItems();
  const { pathname } = useLocation();

  const readyCount = getExportableItems(items).length;
  const pendingCount = items.filter(i => i.status === 'idle' || i.status === 'searching').length;

  return (
    <nav className="navbar">
      <BrandLink />

      {user && (
        <div className="navbar-links">
          <Link to="/dashboard" className={`nav-link${pathname === '/dashboard' ? ' active' : ''}`}>
            Dashboard
          </Link>
          <Link to="/upload" className={`nav-link${pathname === '/upload' ? ' active' : ''}`}>
            Upload
          </Link>
          <Link to="/review" className={`nav-link${pathname === '/review' ? ' active' : ''}`}>
            Review
            {items.length > 0 && (
              <span className={`nav-badge ${pendingCount > 0 ? 'nav-badge--pending' : 'nav-badge--ready'}`}>
                {pendingCount > 0 ? pendingCount : readyCount}
              </span>
            )}
          </Link>
          <Link to="/settings" className={`nav-link${pathname === '/settings' ? ' active' : ''}`}>
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
          <Link to="/login" className="btn-ghost btn-sm">Sign in</Link>
          <Link to="/register" className="btn-primary btn-sm">Register</Link>
        </div>
      )}
    </nav>
  );
}
