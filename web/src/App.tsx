import { useState, useEffect, useCallback, useRef } from 'react';
import GameDetail from './GameDetail';
import { Create } from './Create';
import { getKey, saveKey, PROVIDERS, type ProviderConfig } from './lib/ai-keys';

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

type View = 'dashboard' | 'game-detail' | 'vibecode' | 'chat' | 'profile';

const TABS: { key: View; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'vibecode', label: 'VibeCode' },
  { key: 'profile', label: 'Profile' },
];

function parseRoute(): { view: View; id: string | null } {
  const path = location.pathname;
  const gameMatch = path.match(/^\/games\/([^/]+)/);
  if (gameMatch) return { view: 'game-detail', id: gameMatch[1]! };
  const chatMatch = path.match(/^\/create\/([^/]+)/);
  if (chatMatch) return { view: 'chat', id: chatMatch[1]! };
  if (path === '/create') return { view: 'vibecode', id: null };
  if (path === '/profile') return { view: 'profile', id: null };
  return { view: 'dashboard', id: null };
}

const routeSetterRef: { current: ((r: { view: View; id: string | null }) => void) | null } = { current: null };

function navigate(view: View, id?: string) {
  let path = '/';
  if (view === 'game-detail' && id) path = `/games/${id}`;
  else if (view === 'chat' && id) path = `/create/${id}`;
  else if (view === 'vibecode') path = '/create';
  else if (view === 'profile') path = '/profile';
  history.pushState(null, '', path);
  routeSetterRef.current?.(parseRoute());
}

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
  const [theme, setTheme] = useState(() => localStorage.getItem('stores-theme') ?? 'system');
  const [vibeCodeGameId, setVibeCodeGameId] = useState<string | null>(null);
  const loadGamesRef = useRef<() => void>(() => {});

  useEffect(() => {
    routeSetterRef.current = setRoute;
  }, []);

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
  const loadGames = useCallback(() => {
    if (!user) return;
    Promise.all([
      fetch(`${ADMIN_URL}/api/status`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${ADMIN_URL}/api/quality`, { credentials: 'include' }).then((r) => {
        if (r.ok && r.status !== 204) return r.json() as Promise<{ games: QualityScore[] }>;
        return null;
      }),
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

  loadGamesRef.current = loadGames;

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Re-fetch games when navigating to dashboard (catches VibeCode deploys)
  const { view, id } = route;
  useEffect(() => {
    if (view === 'dashboard') loadGamesRef.current();
  }, [view]);

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
    const isDark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = isDark ? 'dark' : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100svh' }}>
        <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-6" style={{ minHeight: '100svh', background: 'var(--paper)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--ink-strong)' }}>Creator Console</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 420, textAlign: 'center' }}>
          Build, deploy, and manage your games on FreeGameStore. Includes VibeCode — describe a game and AI builds it for you.
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
        <a href="https://freegamestore.online" style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          &#8592; Back to store
        </a>
      </div>
    );
  }

  const showTabs = view !== 'chat';
  const activeTab = view === 'game-detail' ? 'dashboard' : view === 'chat' ? 'vibecode' : view;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: view === 'chat' ? '100dvh' : undefined, minHeight: view === 'chat' ? undefined : '100dvh', overflow: view === 'chat' ? 'hidden' : undefined, background: 'var(--paper)' }}>
      {/* Brand bar — hidden on mobile when in chat (chat toolbar has back + settings) */}
      <header
        className={view === 'chat' ? 'hidden md:flex' : 'flex'}
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('dashboard')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              fontWeight: 800,
              color: 'var(--ink-strong)',
              padding: 0,
            }}
          >
            Console
          </button>
          <span style={{ color: 'var(--line-strong)' }}>&#183;</span>
          <a href="https://freegamestore.online" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Store
          </a>
        </div>
        <div className="flex items-center gap-3">
          <img src={user.avatar} alt="" width={24} height={24} style={{ borderRadius: '50%' }} />
          <button
            onClick={signOut}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'var(--font-body)' }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      {showTabs && (
        <nav style={{ borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0 }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', gap: 0, padding: '0 1rem' }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                style={{
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === tab.key ? 'var(--ink)' : 'var(--muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  minHeight: 40,
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Content */}
      {view === 'vibecode' || view === 'chat' ? (
        <Create
          sessionId={view === 'chat' ? id : null}
          initialGameId={vibeCodeGameId}
          onNavigate={(sid) => { setVibeCodeGameId(null); navigate('chat', sid); }}
          onBack={() => navigate('vibecode')}
          onProfile={() => navigate('profile')}
        />
      ) : (
        <main style={{ flex: 1, maxWidth: 960, margin: '0 auto', padding: '1.5rem 1rem', width: '100%' }}>
          {view === 'dashboard' && <Dashboard user={user} games={games} quality={quality} onGameClick={(gid) => navigate('game-detail', gid)} />}
          {view === 'game-detail' && id && (
            <GameDetail gameId={id} games={games} quality={quality} onBack={() => navigate('dashboard')} onGameUpdated={loadGames} onVibeCode={() => { setVibeCodeGameId(id!); history.replaceState(null, '', '/create'); routeSetterRef.current?.({ view: 'vibecode', id: null }); }} />
          )}
          {view === 'profile' && <Profile theme={theme} onThemeChange={applyTheme} />}
        </main>
      )}
    </div>
  );
}

// ── Dashboard ──

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
        <img src={user.avatar} alt="" width={48} height={48} style={{ borderRadius: '50%' }} />
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--ink-strong)', lineHeight: 1.2 }}>
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
          <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>No published games yet. Build one with VibeCode or the CLI.</p>
          <button
            onClick={() => navigate('vibecode')}
            style={{
              display: 'inline-block',
              background: 'var(--accent)',
              color: '#fff',
              padding: '0.5rem 1.5rem',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: '0.9rem',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Open VibeCode
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '1rem' }}>
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
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--line)')}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink-strong)' }}>{g.name}</span>
                  {q && (
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: q.score >= 95 ? 'var(--success)' : q.score >= 60 ? 'var(--warning)' : 'var(--error)',
                      }}
                    >
                      {q.score}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{g.domain}</p>
                <DeployBadge gameId={g.id} />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Profile ──

function Profile({ theme, onThemeChange }: { theme: string; onThemeChange: (t: string) => void }) {
  return (
    <>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--ink-strong)', marginBottom: '1.5rem' }}>Profile</h1>

      {/* AI Keys */}
      <SectionCard title="AI Provider Keys">
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Add your API key for any provider to use VibeCode. Keys are stored locally in your browser.
        </p>
        <div className="flex flex-col gap-3">
          {PROVIDERS.map((p) => (
            <ProviderKeyCard key={p.type} provider={p} />
          ))}
        </div>
      </SectionCard>

      {/* Theme */}
      <SectionCard title="Theme">
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
                textTransform: 'capitalize' as const,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        marginBottom: '1.25rem',
      }}
    >
      <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink-strong)', marginBottom: '0.75rem' }}>{title}</h2>
      {children}
    </div>
  );
}

function ProviderKeyCard({ provider }: { provider: ProviderConfig }) {
  const [keyValue, setKeyValue] = useState('');
  const [saved, setSaved] = useState(() => !!getKey(provider.type));

  const handleSave = () => {
    if (keyValue.trim()) {
      saveKey(provider.type, keyValue.trim());
      setSaved(true);
      setKeyValue('');
    }
  };

  const handleDelete = () => {
    if (!confirm(`Remove ${provider.name} key?`)) return;
    saveKey(provider.type, '');
    setSaved(false);
  };

  return (
    <div style={{ padding: '0.75rem', border: '1px solid var(--line)', borderRadius: '0.5rem', background: 'var(--paper)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '0.35rem' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink-strong)' }}>{provider.name}</span>
          {saved && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>&#9679; Key set</span>}
        </div>
        <a href={provider.docsUrl} target="_blank" rel="noopener" style={{ fontSize: '0.75rem', color: 'var(--accent)', padding: '0.25rem 0', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          Get key &#8594;
        </a>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{provider.description}</p>
      {saved ? (
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--muted)' }}>&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</span>
          <button onClick={handleDelete} style={{ fontSize: '0.78rem', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0', minHeight: 44 }}>
            Remove
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder={provider.keyPlaceholder}
            type="password"
            style={{
              flex: 1,
              padding: '0.5rem 0.6rem',
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '0.375rem',
              color: 'var(--ink)',
              fontFamily: 'monospace',
              fontSize: '1rem',
              minHeight: 44,
            }}
          />
          <button
            onClick={handleSave}
            disabled={!keyValue.trim()}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: keyValue.trim() ? 1 : 0.5,
              minHeight: 44,
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ── Deploy badge ──

function DeployBadge({ gameId }: { gameId: string }) {
  const [status, setStatus] = useState<{ conclusion: string; updatedAt: string } | null>(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/freegamestore-online/${gameId}/actions/runs?per_page=1&status=completed`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const run = data?.workflow_runs?.[0];
        if (run) setStatus({ conclusion: run.conclusion, updatedAt: run.updated_at });
      })
      .catch(() => {});
  }, [gameId]);

  if (!status) return null;
  const isSuccess = status.conclusion === 'success';
  return (
    <div className="flex items-center gap-1.5" style={{ marginTop: '0.35rem' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          padding: '0.15rem 0.4rem',
          borderRadius: '999px',
          background: isSuccess ? 'var(--success)' : 'var(--error)',
          color: 'white',
        }}
      >
        {isSuccess ? 'Live' : 'Failed'}
      </span>
      <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{formatTimeAgo(status.updatedAt)}</span>
    </div>
  );
}

export { formatTimeAgo, type GameInfo, type QualityScore };
