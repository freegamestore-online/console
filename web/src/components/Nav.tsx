import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme, type ThemePref } from '../lib/theme';

type NavView = 'games' | 'profile';

const THEME_ICON: Record<ThemePref, string> = { dark: '☽', light: '☀︎', system: '◑' };

export function Nav({
  active,
  onNavigate,
  showOnMobile,
}: {
  active: NavView;
  onNavigate: (v: NavView) => void;
  /** Hide the bar on mobile when a full-viewport view (chat) needs the space. */
  showOnMobile: boolean;
}) {
  const { user, signOut } = useAuth();
  const { pref, cycle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <header
      className={showOnMobile ? 'flex' : 'hidden md:flex'}
      style={{
        background: 'var(--panel)',
        borderBottom: '1px solid var(--line)',
        padding: '0 1rem',
        height: 44,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <button
        onClick={() => onNavigate('games')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink-strong)' }}
      >
        Free<span style={{ color: 'var(--accent)' }}>GameStore</span>
      </button>

      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('games')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: active === 'games' ? 700 : 500, color: active === 'games' ? 'var(--ink)' : 'var(--muted)', fontFamily: 'var(--font-body)' }}
        >
          My Games
        </button>
        <a href="https://freegamestore.online" style={{ fontSize: '0.82rem', color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
          Store
        </a>
        <button
          onClick={cycle}
          title={`Theme: ${pref}`}
          aria-label={`Theme: ${pref}`}
          style={{ width: 30, height: 30, borderRadius: '999px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink)', cursor: 'pointer', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <span aria-hidden>{THEME_ICON[pref]}</span>
        </button>

        {/* Avatar + dropdown menu */}
        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <img src={user.avatar} alt={user.name} width={28} height={28} style={{ borderRadius: '50%', border: `2px solid ${menuOpen ? 'var(--accent)' : 'var(--line)'}` }} />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, marginTop: 8, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '0.75rem', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 200, zIndex: 100, padding: '0.4rem 0', overflow: 'hidden' }}>
                <div style={{ padding: '0.5rem 0.85rem', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); onNavigate('profile'); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.85rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--ink)', fontFamily: 'var(--font-body)' }}
                >
                  Profile
                </button>
                <div style={{ borderTop: '1px solid var(--line)', margin: '0.25rem 0' }} />
                <button
                  onClick={() => { setMenuOpen(false); signOut(); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.85rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--error)', fontFamily: 'var(--font-body)' }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
