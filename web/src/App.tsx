import { useState, useEffect, useCallback } from 'react';
import GameDetail from './GameDetail';

const AUTH_URL = 'https://auth.freegamestore.online';
const ADMIN_URL = 'https://admin.freegamestore.online';

interface User {
  id: string;
  name: string;
  avatar: string;
}

interface GameInfo {
  id: string;
  name: string;
  domain: string;
  org: string;
  cfProject: string;
}

interface QualityScore {
  id: string;
  score: number;
  loadTimeMs: number;
}

type View = 'dashboard' | 'game-detail' | 'settings';

function parseRoute(): { view: View; gameId: string | null } {
  const path = location.pathname;
  const m = path.match(/^\/games\/([^/]+)/);
  if (m) return { view: 'game-detail', gameId: m[1]! };
  if (path === '/settings') return { view: 'settings', gameId: null };
  return { view: 'dashboard', gameId: null };
}

function navigate(view: View, gameId?: string) {
  let path = '/';
  if (view === 'game-detail' && gameId) path = `/games/${gameId}`;
  else if (view === 'settings') path = '/settings';
  history.pushState(null, '', path);
  _setRoute?.(parseRoute());
}

let _setRoute: ((r: { view: View; gameId: string | null }) => void) | null = null;

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(parseRoute);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [quality, setQuality] = useState<Map<string, QualityScore>>(new Map());
  const [theme, setTheme] = useState(
    () => localStorage.getItem('stores-theme') ?? 'system',
  );

  _setRoute = setRoute;

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Auth
  useEffect(() => {
    fetch(`${AUTH_URL}/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((u: User | null) => setUser(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch games + quality
  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`${ADMIN_URL}/api/status`, { credentials: 'include' }).then((r) =>
        r.ok ? r.json() : [],
      ),
      fetch(`${ADMIN_URL}/api/quality`, { credentials: 'include' }).then(
        (r) => {
          if (r.ok && r.status !== 204)
            return r.json() as Promise<{ games: QualityScore[] }>;
          return null;
        },
      ),
    ])
      .then(([g, q]: [GameInfo[], { games: QualityScore[] } | null]) => {
        setGames(g);
        if (q?.games) {
          const m = new Map<string, QualityScore>();
          for (const s of q.games) m.set(s.id, s);
          setQuality(m);
        }
      })
      .catch(() => {});
  }, [user]);

  const signIn = useCallback(() => {
    window.location.href = `${AUTH_URL}/login?redirect=${encodeURIComponent(window.location.href)}`;
  }, []);

  const signOut = useCallback(() => {
    fetch(`${AUTH_URL}/logout`, { method: 'POST', credentials: 'include' })
      .catch(() => {})
      .finally(() => {
        setUser(null);
        window.location.reload();
      });
  }, []);

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('stores-theme', t);
    const isDark =
      t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = isDark ? 'dark' : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100svh' }}>
        <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Loading…</p>
      </div>
    );
  }

  // Landing — not signed in
  if (!user) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-6"
        style={{ minHeight: '100svh', background: 'var(--paper)' }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            color: 'var(--ink-strong)',
          }}
        >
          Creator Console
        </h1>
        <p style={{ color: 'var(--muted)', maxWidth: 400, textAlign: 'center' }}>
          Manage your games on FreeGameStore. View deploy status, quality scores,
          leaderboards, and more.
        </p>
        <button
          onClick={signIn}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Sign in with Google
        </button>
        <a
          href="https://freegamestore.online"
          style={{ fontSize: '0.85rem', color: 'var(--muted)' }}
        >
          ← Back to store
        </a>
      </div>
    );
  }

  // Authenticated shell
  return (
    <div style={{ minHeight: '100svh', background: 'var(--paper)' }}>
      {/* Header */}
      <header
        style={{
          background: 'var(--panel)',
          borderBottom: '1px solid var(--line)',
          padding: '0 1.5rem',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('dashboard')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontSize: '1.1rem',
              fontWeight: 800,
              color: 'var(--ink-strong)',
              padding: 0,
            }}
          >
            Console
          </button>
          <span style={{ color: 'var(--line-strong)' }}>·</span>
          <a
            href="https://freegamestore.online"
            style={{ fontSize: '0.8rem', color: 'var(--muted)' }}
          >
            Store
          </a>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('settings')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: 'var(--muted)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Settings
          </button>
          <img
            src={user.avatar}
            alt=""
            width={28}
            height={28}
            style={{ borderRadius: '50%' }}
          />
          <button
            onClick={signOut}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: 'var(--muted)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {route.view === 'dashboard' && (
          <Dashboard
            user={user}
            games={games}
            quality={quality}
            onGameClick={(id) => navigate('game-detail', id)}
          />
        )}
        {route.view === 'game-detail' && route.gameId && (
          <GameDetail
            gameId={route.gameId}
            games={games}
            quality={quality}
            onBack={() => navigate('dashboard')}
          />
        )}
        {route.view === 'settings' && (
          <Settings theme={theme} onThemeChange={applyTheme} />
        )}
      </main>
    </div>
  );
}

function Dashboard({
  user,
  games,
  quality,
  onGameClick,
}: {
  user: User;
  games: GameInfo[];
  quality: Map<string, QualityScore>;
  onGameClick: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3" style={{ marginBottom: '2rem' }}>
        <img
          src={user.avatar}
          alt=""
          width={48}
          height={48}
          style={{ borderRadius: '50%' }}
        />
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              color: 'var(--ink-strong)',
              lineHeight: 1.2,
            }}
          >
            Welcome, {user.name.split(' ')[0]}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {games.length} game{games.length !== 1 ? 's' : ''} on the platform
          </p>
        </div>
      </div>

      {games.length === 0 ? (
        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
            No games yet. Publish your first game to see it here.
          </p>
          <a
            href="https://freegamestore.online/get-started.html"
            style={{
              display: 'inline-block',
              background: 'var(--accent)',
              color: '#fff',
              padding: '0.5rem 1.5rem',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Get started
          </a>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {games.map((g) => {
            const q = quality.get(g.id);
            return (
              <button
                key={g.id}
                onClick={() => onGameClick(g.id)}
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem 1.25rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-card)',
                  fontFamily: 'var(--font-body)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    'var(--accent)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    'var(--line)')
                }
              >
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: '0.35rem' }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: 'var(--ink-strong)',
                    }}
                  >
                    {g.name}
                  </span>
                  {q && (
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color:
                          q.score >= 95
                            ? 'var(--success)'
                            : q.score >= 60
                              ? 'var(--warning)'
                              : 'var(--error)',
                      }}
                    >
                      {q.score}
                    </span>
                  )}
                </div>
                <p
                  style={{
                    color: 'var(--muted)',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {g.domain}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function Settings({
  theme,
  onThemeChange,
}: {
  theme: string;
  onThemeChange: (t: string) => void;
}) {
  return (
    <>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          color: 'var(--ink-strong)',
          marginBottom: '1.5rem',
        }}
      >
        Settings
      </h1>
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: '1.25rem',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Theme</p>
        <div className="flex gap-2">
          {['system', 'light', 'dark'].map((t) => (
            <button
              key={t}
              onClick={() => onThemeChange(t)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: `1px solid ${theme === t ? 'var(--accent)' : 'var(--line)'}`,
                background: theme === t ? 'var(--accent)' : 'var(--panel)',
                color: theme === t ? '#fff' : 'var(--ink)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export { formatTimeAgo, type GameInfo, type QualityScore };
