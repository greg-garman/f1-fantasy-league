import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/my-team', label: 'My Team' },
  { to: '/picks', label: 'Picks' },
  { to: '/standings', label: 'Standings' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/transfers', label: 'Transfers' },
];

const BOTTOM_TABS = [
  { to: '/', label: 'Home', icon: '\u2302' },
  { to: '/my-team', label: 'My Team', icon: '\uD83C\uDFCE' },
  { to: '/picks', label: 'Picks', icon: '\u2714' },
  { to: '/standings', label: 'Standings', icon: '\uD83C\uDFC6' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* ---- Top Nav ---- */}
      <nav className="top-nav">
        <div className="top-nav__brand">
          <span>F1</span>
          <span className="top-nav__brand-gold">FANTASY</span>
        </div>

        {/* Desktop links */}
        <div className="top-nav__links">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `top-nav__link ${isActive ? 'top-nav__link--active' : ''}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {user?.is_admin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `top-nav__link ${isActive ? 'top-nav__link--active' : ''}`
              }
            >
              Admin
            </NavLink>
          )}
        </div>

        <div className="top-nav__user">
          <span className="top-nav__user-name">{user?.display_name}</span>
          <button className="top-nav__logout" onClick={handleLogout}>
            Logout
          </button>
          <button
            className="top-nav__hamburger hide-desktop"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? '\u2715' : '\u2630'}
          </button>
        </div>
      </nav>

      {/* ---- Mobile Menu ---- */}
      {menuOpen && (
        <div className="mobile-menu hide-desktop">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `mobile-menu__link ${isActive ? 'mobile-menu__link--active' : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
          {user?.is_admin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `mobile-menu__link ${isActive ? 'mobile-menu__link--active' : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              Admin
            </NavLink>
          )}
        </div>
      )}

      {/* ---- Main Content ---- */}
      <main className="app-content">
        <Outlet />
      </main>

      {/* ---- Bottom Nav (mobile) ---- */}
      <nav className="bottom-nav hide-desktop">
        {BOTTOM_TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`
            }
          >
            <span className="bottom-nav__icon">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
