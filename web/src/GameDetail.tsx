import { useState, useEffect, useCallback } from 'react';
import { formatTimeAgo, type GameInfo, type QualityScore } from './App';

const ORG = 'freegamestore-online';
const ADMIN_URL = 'https://admin.freegamestore.online';

interface DeployRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  head_commit?: { message: string };
  name: string;
}

export default function GameDetail({
  gameId,
  games,
  quality,
  onBack,
  onGameUpdated,
}: {
  gameId: string;
  games: GameInfo[];
  quality: Map<string, QualityScore>;
  onBack: () => void;
  onGameUpdated?: () => void;
}) {
  const game = games.find((g) => g.id === gameId);
  const q = quality.get(gameId);
  const [deploys, setDeploys] = useState<DeployRun[]>([]);
  const [deploysLoading, setDeploysLoading] = useState(true);

  useEffect(() => {
    fetch(
      `https://api.github.com/repos/${ORG}/${gameId}/actions/runs?per_page=5`,
    )
      .then((r) => (r.ok ? r.json() : { workflow_runs: [] }))
      .then((d: { workflow_runs: DeployRun[] }) =>
        setDeploys(d.workflow_runs ?? []),
      )
      .catch(() => {})
      .finally(() => setDeploysLoading(false));
  }, [gameId]);

  if (!game) {
    return (
      <div>
        <button onClick={onBack} style={backStyle}>
          ← Back
        </button>
        <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>
          Game "{gameId}" not found.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} style={backStyle}>
        ← Back
      </button>

      {/* Hero */}
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          marginTop: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            color: 'var(--ink-strong)',
            marginBottom: '0.25rem',
          }}
        >
          {game.name}
        </h1>
        <p
          style={{
            color: 'var(--muted)',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            marginBottom: '1rem',
          }}
        >
          {game.domain}
        </p>
        <div className="flex gap-2 flex-wrap">
          <a href={`https://${game.domain}`} target="_blank" rel="noreferrer" style={linkBtnStyle}>
            Open game
          </a>
          <a
            href={`https://github.com/${ORG}/${gameId}`}
            target="_blank"
            rel="noreferrer"
            style={{ ...linkBtnStyle, background: 'var(--panel-hover)' }}
          >
            Source
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <StatCard
          label="Quality"
          value={q ? String(q.score) : '—'}
          color={
            q
              ? q.score >= 95
                ? 'var(--success)'
                : q.score >= 60
                  ? 'var(--warning)'
                  : 'var(--error)'
              : 'var(--muted)'
          }
        />
        <StatCard
          label="Load time"
          value={q ? `${q.loadTimeMs}ms` : '—'}
          color="var(--ink)"
        />
        <StatCard
          label="Deploys"
          value={deploysLoading ? '…' : String(deploys.length)}
          color="var(--ink)"
        />
      </div>

      {/* Recent deploys */}
      <Section title="Recent deploys">
        {deploysLoading ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading…</p>
        ) : deploys.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            No deployments yet. Push to main to trigger one.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {deploys.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--line)',
                  fontSize: '0.85rem',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        d.conclusion === 'success'
                          ? 'var(--success)'
                          : d.conclusion === 'failure'
                            ? 'var(--error)'
                            : 'var(--warning)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: 'var(--ink)' }}>
                    {d.name}
                  </span>
                  {d.head_commit?.message && (
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                      — {d.head_commit.message.slice(0, 60)}
                    </span>
                  )}
                </div>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {formatTimeAgo(d.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Info */}
      <Section title="Info">
        <InfoRow label="Subdomain" value={game.domain} />
        <InfoRow
          label="Source"
          value={`github.com/${ORG}/${gameId}`}
          href={`https://github.com/${ORG}/${gameId}`}
        />
        <InfoRow label="Deploy" value="Push to main → GitHub Actions → R2" />
        <InfoRow label="Hosting" value="R2 via host worker" />
        <InfoRow label="License" value="MIT" />
        <InfoRow label="Price" value="Free forever" />
      </Section>

      {/* Game settings */}
      <GameSettings gameId={gameId} game={game} onUpdated={onGameUpdated} />

      {/* Quick links */}
      <Section title="Quick links">
        <div className="flex gap-2 flex-wrap">
          <a
            href="https://freegamestore.online/docs/"
            target="_blank"
            rel="noreferrer"
            style={linkBtnStyle}
          >
            Docs
          </a>
          <a
            href="https://freegamestore.online/workflow.html"
            target="_blank"
            rel="noreferrer"
            style={linkBtnStyle}
          >
            Workflow
          </a>
          <a
            href="https://freegamestore.online/guidelines.html"
            target="_blank"
            rel="noreferrer"
            style={linkBtnStyle}
          >
            Guidelines
          </a>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
      <h2
        style={{
          fontWeight: 700,
          fontSize: '0.95rem',
          color: 'var(--ink-strong)',
          marginBottom: '0.75rem',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        padding: '1rem',
      }}
    >
      <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
        {label}
      </p>
      <p style={{ fontWeight: 700, fontSize: '1.5rem', color }}>{value}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div
      className="flex justify-between"
      style={{
        padding: '0.35rem 0',
        borderBottom: '1px solid var(--line)',
        fontSize: '0.85rem',
      }}
    >
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <span style={{ color: 'var(--ink)' }}>{value}</span>
      )}
    </div>
  );
}

const CATEGORIES = [
  'arcade', 'puzzle', 'board', 'card', 'strategy', 'action',
  'racing', 'sports', 'trivia', 'simulation', 'educational', 'casual',
  'brain-training', 'multiplayer',
];

function GameSettings({ gameId, game, onUpdated }: {
  gameId: string;
  game: { name: string; domain: string };
  onUpdated?: () => void;
}) {
  const [name, setName] = useState(game.name);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load current metadata from registry via admin
  useEffect(() => {
    fetch(`${ADMIN_URL}/api/status`)
      .then(r => r.ok ? r.json() : [])
      .then((games: Array<Record<string, string>>) => {
        const g = games.find(x => x.id === gameId);
        if (g) {
          if (g.description) setDescription(g.description as string);
          if (g.category) setCategory(g.category as string);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [gameId]);

  const save = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${ADMIN_URL}/api/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description, category }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      setStatus(data);
      if (data.ok && onUpdated) onUpdated();
    } catch (e) {
      setStatus({ error: String(e) });
    }
    setSaving(false);
  }, [gameId, name, description, category, onUpdated]);

  if (!loaded) return null;

  return (
    <Section title="Settings">
      <div className="flex flex-col gap-3">
        <label style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Display name</span>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Description</span>
          <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} placeholder="Short description" />
        </label>
        <label style={{ fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Category</span>
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} style={{ ...linkBtnStyle, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {status?.ok && <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Saved</span>}
          {status?.error && <span style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{status.error}</span>}
        </div>
      </div>
    </Section>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: '0.5rem',
  color: 'var(--ink)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
};

const backStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--accent)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  padding: 0,
};

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.45rem 1rem',
  borderRadius: '0.5rem',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 600,
  fontFamily: 'var(--font-body)',
  textDecoration: 'none',
};
