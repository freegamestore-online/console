import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { DeployLog } from './components/DeployLog';
import { getKey, getDefaultProvider, getDefaultModel, MODEL_OPTIONS, PROVIDERS } from './lib/ai-keys';

const AGENT_URL = 'https://agent.freegamestore.online';
const PUBLISH_URL = 'https://publish.freegamestore.online';
const GH_ORG = 'freegamestore-online';
const PROJECTS_KEY = 'fgs_projects';

interface Project {
  id: string;
  name: string;
  createdAt: string;
  gameId?: string;
  gameUrl?: string;
  deployed: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
}

interface DeployState {
  phase: string;
  steps?: { name: string; status: string }[];
  appUrl?: string;
  error?: string;
}

function loadProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

const DEFAULT_MSGS: Message[] = [{ role: 'system', content: 'Describe the game you want to build.' }];

function toolLabel(tc: { name: string; input?: Record<string, unknown> }): string {
  const i = tc.input || {};
  switch (tc.name) {
    case 'deploy':
      return `Deploying: ${i.name || i.id || 'game'}...`;
    case 'push_update':
      return `Pushing update to ${i.id}...`;
    case 'write_file':
      return `Writing ${i.path || 'file'}`;
    case 'read_file':
      return `Reading ${i.path || 'file'}`;
    case 'run_compliance_check':
      return 'Running compliance checks...';
    case 'search_files':
      return `Searching for "${i.pattern}"`;
    default:
      return tc.name;
  }
}

function restoreMessages(serverMessages: any[]): Message[] {
  const restored: Message[] = [];
  for (const m of serverMessages || []) {
    if (m.role === 'user') {
      restored.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      if (m.content) restored.push({ role: 'assistant', content: m.content });
      for (const tc of m.toolCalls || []) restored.push({ role: 'tool', content: toolLabel(tc) });
    }
  }
  return restored;
}

interface QualityScore {
  id: string;
  score: number;
  loadTimeMs: number;
}

interface CreateProps {
  sessionId: string | null;
  initialGameId?: string | null;
  quality?: Map<string, QualityScore>;
  onNavigate: (sessionId: string) => void;
  onGameDetail?: (gameId: string) => void;
  onBack: () => void;
  onProfile: () => void;
}

export function Create({ sessionId, initialGameId, quality, onNavigate, onGameDetail, onBack, onProfile }: CreateProps) {
  const [projects, setProjectsRaw] = useState<Project[]>(loadProjects);
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MSGS);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deployState, setDeployState] = useState<DeployState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');
  const [provider, setProvider] = useState(getDefaultProvider);
  const [model, setModel] = useState(getDefaultModel);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);
  const inputRef = useRef(inputValue);
  inputRef.current = inputValue;

  // Single persistence wrapper — no separate useEffect
  const setProjects = (updater: Project[] | ((prev: Project[]) => Project[])) => {
    setProjectsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistProjects(next);
      return next;
    });
  };

  // Auto-resolve initialGameId: find existing session or create one.
  // For existing games, fetch the source and inject it as context so the
  // agent knows what it's editing (it starts with a blank template otherwise).
  useEffect(() => {
    if (!initialGameId || sessionId) return;
    const existing = projects.find((p) => p.gameId === initialGameId);
    if (existing) {
      onNavigate(existing.id);
    } else {
      const id = crypto.randomUUID();
      const project: Project = { id, name: initialGameId, createdAt: new Date().toISOString(), gameId: initialGameId, gameUrl: `https://${initialGameId}.freegamestore.online`, deployed: true };
      setProjects((prev) => [project, ...prev]);
      // Fetch existing source and prime the agent session
      importGameSource(id, initialGameId);
      onNavigate(id);
    }
  }, [initialGameId]);

  useEffect(() => {
    localStorage.setItem('fgs_provider', provider);
  }, [provider]);
  useEffect(() => {
    localStorage.setItem('fgs_model', model);
  }, [model]);

  // Load conversation history when session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages(DEFAULT_MSGS);
      setDeployState(null);
      setInputValue('');
      return;
    }
    setMessages(DEFAULT_MSGS);
    setDeployState(null);
    setInputValue('');
    setMobileTab('chat');
    setIsLoadingHistory(true);

    const ctrl = new AbortController();
    fetch(`${AGENT_URL}/session/${sessionId}/history`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (ctrl.signal.aborted) return;
        if (!data?.messages?.length) return;
        const restored = restoreMessages(data.messages);
        if (restored.length > 0) setMessages(restored);
        if (data.deployStatus) setDeployState(data.deployStatus);
        if (data.appId) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === sessionId
                ? {
                    ...p,
                    gameId: data.appId,
                    gameUrl: data.deployStatus?.appUrl || `https://${data.appId}.freegamestore.online`,
                    deployed: true,
                    name: data.appName || data.appId,
                  }
                : p,
            ),
          );
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setIsLoadingHistory(false);
      });
    return () => ctrl.abort();
  }, [sessionId]);

  useEffect(() => {
    const behavior = messages.length <= 2 ? 'instant' : 'smooth';
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: behavior as ScrollBehavior }), 50);
  }, [messages]);

  async function importGameSource(sessionId: string, gameId: string) {
    try {
      // Fetch the game's App.tsx from GitHub (public repos, no auth needed)
      const res = await fetch(
        `https://api.github.com/repos/${GH_ORG}/${gameId}/contents/web/src/App.tsx`,
        { headers: { Accept: 'application/vnd.github.raw+json', 'User-Agent': 'fgs-console' } },
      );
      if (!res.ok) return;
      const source = await res.text();
      // Send it as context to the agent so it knows what game it's editing
      const apiKey = getKey(provider);
      if (!apiKey) return;
      await fetch(`${AGENT_URL}/session/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `I want to edit an existing game called "${gameId}" at ${gameId}.freegamestore.online.\n\nHere is the current web/src/App.tsx:\n\n\`\`\`tsx\n${source}\n\`\`\`\n\nUse push_update (not deploy) for any changes to this game. The game ID is "${gameId}".`,
          aiConfig: { provider, model, apiKey, temperature: 0.7, maxTokens: 16384 },
        }),
      });
      // Don't stream this — it's just context injection. The response is discarded.
    } catch {
      // Import failed — agent will start with blank template. User can paste code manually.
    }
  }

  function createProject(name?: string): string {
    const id = crypto.randomUUID();
    const project: Project = { id, name: name || 'New Game', createdAt: new Date().toISOString(), deployed: false };
    setProjects((prev) => [project, ...prev]);
    return id;
  }

  function deleteProject(id: string) {
    const project = projects.find((p) => p.id === id);
    const label = project?.name || id.slice(0, 8);
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  async function sendMessage() {
    const msg = inputRef.current.trim();
    if (!msg || isStreamingRef.current || !sessionId) return;

    const apiKey = getKey(provider);
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }

    setInputValue('');
    isStreamingRef.current = true;
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: 'user', content: msg }, { role: 'assistant', content: '' }]);

    let assistantText = '';
    const updateAssistant = (content: string) => {
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === 'assistant') {
            updated[i] = { role: 'assistant', content };
            break;
          }
        }
        return updated;
      });
    };

    try {
      const res = await fetch(`${AGENT_URL}/session/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, aiConfig: { provider, model, apiKey, temperature: 0.7, maxTokens: 16384 } }),
      });

      if (!res.ok) {
        const raw = await res.text();
        let errMsg = raw;
        try {
          const j = JSON.parse(raw);
          errMsg = j.hint || j.error || raw;
        } catch {}
        updateAssistant(`Error: ${errMsg}`);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let evt;
          try {
            evt = JSON.parse(line.slice(6).trim());
          } catch {
            continue;
          }

          switch (evt.type) {
            case 'text':
              assistantText += evt.data;
              updateAssistant(assistantText);
              break;
            case 'tool_call': {
              const tc = JSON.parse(evt.data);
              setMessages((prev) => [...prev, { role: 'tool', content: toolLabel(tc) }]);
              break;
            }
            case 'tool_result': {
              const tr = JSON.parse(evt.data);
              if (tr.tool === 'deploy') setDeployState({ phase: 'provisioning', steps: [] });
              else if (!['write_file', 'read_file', 'list_files', 'delete_file'].includes(tr.tool) && tr.result) {
                setMessages((prev) => [...prev, { role: 'tool', content: `${tr.tool}:\n${tr.result.slice(0, 400)}` }]);
              }
              break;
            }
            case 'deploy_status': {
              const ds = JSON.parse(evt.data);
              setDeployState(ds);
              if (ds.phase === 'live' && ds.appUrl && sessionId) {
                const host = ds.appUrl.replace('https://', '').split('/')[0].split('.')[0];
                setProjects((prev) =>
                  prev.map((p) => (p.id === sessionId ? { ...p, gameId: host, gameUrl: ds.appUrl, deployed: true, name: host } : p)),
                );
              }
              break;
            }
            case 'error':
              assistantText += `\nError: ${evt.data}`;
              updateAssistant(assistantText);
              break;
          }
        }
      }
      if (!assistantText) updateAssistant('(No response)');
    } catch (err) {
      const errMsg = (err as Error).message || String(err);
      const isTransient = /reset|network|Failed to fetch|aborted|ECONNRESET/i.test(errMsg);
      if (isTransient) {
        updateAssistant(`${assistantText}\n\n_Connection lost — retrying in 3s..._`);
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const retryRes = await fetch(`${AGENT_URL}/session/${sessionId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'continue where you left off', aiConfig: { provider, model, apiKey, temperature: 0.7, maxTokens: 16384 } }),
          });
          if (retryRes.ok) {
            const retryReader = retryRes.body!.getReader();
            const retryDecoder = new TextDecoder();
            let retryBuf = '';
            while (true) {
              const { done, value } = await retryReader.read();
              if (done) break;
              retryBuf += retryDecoder.decode(value, { stream: true });
              const retryLines = retryBuf.split('\n');
              retryBuf = retryLines.pop() || '';
              for (const line of retryLines) {
                if (!line.startsWith('data: ')) continue;
                let evt;
                try { evt = JSON.parse(line.slice(6).trim()); } catch { continue; }
                if (evt.type === 'text') { assistantText += evt.data; updateAssistant(assistantText); }
                else if (evt.type === 'deploy_status') {
                  const ds = JSON.parse(evt.data);
                  setDeployState(ds);
                  if (ds.phase === 'live' && ds.appUrl && sessionId) {
                    const host = ds.appUrl.replace('https://', '').split('/')[0].split('.')[0];
                    setProjects((prev) =>
                      prev.map((p) => (p.id === sessionId ? { ...p, gameId: host, gameUrl: ds.appUrl, deployed: true, name: host } : p)),
                    );
                  }
                }
                else if (evt.type === 'error') { assistantText += `\nError: ${evt.data}`; updateAssistant(assistantText); }
              }
            }
          } else {
            updateAssistant(`${assistantText}\n\nRetry failed. Say "continue" to resume.`);
          }
        } catch {
          updateAssistant(`${assistantText}\n\nConnection interrupted. Say "continue" to resume.`);
        }
      } else {
        updateAssistant(`Connection error: ${errMsg}`);
      }
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  }

  const currentProject = projects.find((p) => p.id === sessionId);
  const previewUrl =
    currentProject?.gameUrl ||
    (deployState?.phase === 'live' ? deployState.appUrl : null) ||
    (currentProject?.gameId ? `https://${currentProject.gameId}.freegamestore.online` : null);

  // ── Session list view ──
  if (!sessionId) {
    return <SessionList projects={projects} provider={provider} quality={quality} onNavigate={onNavigate} onGameDetail={onGameDetail} onCreate={() => { const id = createProject(); onNavigate(id); }} onDelete={deleteProject} onProfile={onProfile} />;
  }

  // ── Chat view ──
  const hasKey = !!getKey(provider);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2" style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0 }}>
        <button onClick={onBack} title="Back to sessions" style={iconBtnStyle}>
          &#8592;
        </button>
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.9rem',
            color: 'var(--ink)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentProject?.name || 'New Game'}
        </span>

        <button onClick={() => copyConversation(messages)} title="Copy conversation" style={{ ...iconBtnStyle, fontSize: '0.85rem' }}>
          &#9776;
        </button>

        {/* Mobile Code/Preview toggle */}
        <div className="flex md:hidden" style={{ background: 'var(--paper)', borderRadius: '0.375rem', padding: '2px', gap: 2 }}>
          {(['chat', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: mobileTab === tab ? 'var(--panel)' : 'transparent',
                color: mobileTab === tab ? 'var(--ink)' : 'var(--muted)',
                border: mobileTab === tab ? '1px solid var(--line)' : '1px solid transparent',
                cursor: 'pointer',
              }}
            >
              {tab === 'chat' ? 'Code' : previewUrl ? 'Preview \u25CF' : 'Preview'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          title="Settings"
          style={{
            ...iconBtnStyle,
            background: settingsOpen ? 'color-mix(in srgb, var(--accent) 15%, var(--panel))' : 'none',
            color: settingsOpen ? 'var(--accent)' : 'var(--ink)',
          }}
        >
          &#9881;
        </button>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0 }}>
          <div className="flex gap-2 flex-wrap">
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                const models = MODEL_OPTIONS[e.target.value];
                if (models?.length) setModel(models[0].value);
              }}
              style={selectStyle}
            >
              {PROVIDERS.map((p) => (
                <option key={p.type} value={p.type}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle}>
              {(MODEL_OPTIONS[provider] || []).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {!hasKey && (
            <p style={{ color: 'var(--warning)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              No API key for {PROVIDERS.find((p) => p.type === provider)?.name}.{' '}
              <button onClick={onProfile} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' }}>
                Add one in Profile
              </button>
            </p>
          )}
        </div>
      )}

      {/* Main: chat + preview split */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ flex: 1, minHeight: 0 }}>
        {/* Chat pane */}
        <div className={`flex flex-col overflow-hidden ${mobileTab !== 'chat' ? 'hidden md:flex' : ''}`} style={{ borderRight: '1px solid var(--line)' }}>
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
            <div style={{ flex: 1 }} />
            {isLoadingHistory && messages.length <= 1 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div
                  className="inline-block"
                  style={{ width: 20, height: 20, border: '2px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}
                />
                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Loading conversation...</p>
              </div>
            ) : (
              messages.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2" style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0 }}>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Build me a chess game..."
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid var(--line)',
                borderRadius: '0.5rem',
                padding: '0.55rem 0.7rem',
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontSize: '1rem',
                minHeight: 44,
                maxHeight: 120,
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isStreaming}
              title="Send"
              aria-label="Send"
              style={{
                minHeight: 44,
                minWidth: 44,
                padding: '0.55rem 0.9rem',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '1.1rem',
                cursor: 'pointer',
                opacity: isStreaming ? 0.5 : 1,
              }}
            >
              <span aria-hidden>&#8593;</span>
            </button>
          </div>
        </div>

        {/* Preview pane */}
        <div className={`flex flex-col overflow-hidden ${mobileTab !== 'preview' ? 'hidden md:flex' : ''}`}>
          <div
            className="flex items-center gap-2"
            style={{ padding: '0.35rem 0.75rem', borderBottom: '1px solid var(--line)', background: 'var(--panel)', fontSize: '0.78rem', flexShrink: 0 }}
          >
            {previewUrl ? (
              <>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener"
                  style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.75rem', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {previewUrl.replace('https://', '')} &#8599;
                </a>
                {currentProject?.gameId && (
                  <a
                    href={`${PUBLISH_URL}?id=${currentProject.gameId}`}
                    target="_blank"
                    rel="noopener"
                    style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '999px', background: 'var(--accent)', color: 'white', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Publish
                  </a>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>No preview yet</span>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', minHeight: 0, overflow: 'hidden' }}>
            {previewUrl ? (
              <iframe src={previewUrl} title="Preview" sandbox="allow-scripts allow-same-origin" style={{ width: '100%', height: '100%', border: 'none', background: '#0f0f0f' }} />
            ) : deployState ? (
              <DeployLog state={deployState} />
            ) : (
              <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
                <p>Your game will appear here once deployed.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function copyConversation(messages: Message[]) {
  const text = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const label = m.role === 'user' ? 'You' : m.role === 'assistant' ? 'AI' : 'Tool';
      return `${label}: ${m.content}`;
    })
    .join('\n\n');
  navigator.clipboard.writeText(text).catch(() => {});
}

function SessionList({
  projects,
  provider,
  quality,
  onNavigate,
  onGameDetail,
  onCreate,
  onDelete,
  onProfile,
}: {
  projects: Project[];
  provider: string;
  quality?: Map<string, QualityScore>;
  onNavigate: (id: string) => void;
  onGameDetail?: (gameId: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onProfile: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'name'>(() => (localStorage.getItem('fgs_session_sort') as 'newest' | 'name') || 'newest');

  useEffect(() => {
    localStorage.setItem('fgs_session_sort', sort);
  }, [sort]);

  const q = search.toLowerCase();
  const filtered = projects
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.gameId?.toLowerCase().includes(q))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

  const drafts = filtered.filter((p) => !p.deployed);
  const deployed = filtered.filter((p) => p.deployed);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem', width: '100%' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--ink-strong)' }}>My Games</h1>
        <button onClick={onCreate} style={accentBtnStyle}>
          + New Game
        </button>
      </div>

      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.5rem' }}>No games yet</p>
          <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>Describe what you want to build and the AI agent will create it for you.</p>
          <button onClick={onCreate} style={{ ...accentBtnStyle, padding: '0.75rem 2rem', fontSize: '1rem' }}>
            Build your first game
          </button>
          {!getKey(provider) && (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
              You'll need an AI provider key.{' '}
              <button onClick={onProfile} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Set one up
              </button>
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Search + sort */}
          <div className="flex gap-2" style={{ marginBottom: '1rem' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions..."
              style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid var(--line)', borderRadius: '0.5rem', background: 'var(--panel)', color: 'var(--ink)', fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'newest' | 'name')}
              aria-label="Sort sessions"
              style={selectStyle}
            >
              <option value="newest">Newest</option>
              <option value="name">Name</option>
            </select>
          </div>

          {drafts.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionLabel}>Drafts ({drafts.length})</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '0.75rem' }}>
                {drafts.map((p) => (
                  <ProjectCard key={p.id} project={p} quality={p.gameId ? quality?.get(p.gameId) : undefined} onClick={() => onNavigate(p.id)} onGameDetail={p.gameId && onGameDetail ? () => onGameDetail(p.gameId!) : undefined} onDelete={() => onDelete(p.id)} />
                ))}
              </div>
            </div>
          )}
          {deployed.length > 0 && (
            <div>
              <h2 style={sectionLabel}>Deployed ({deployed.length})</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '0.75rem' }}>
                {deployed.map((p) => (
                  <ProjectCard key={p.id} project={p} quality={p.gameId ? quality?.get(p.gameId) : undefined} onClick={() => onNavigate(p.id)} onGameDetail={p.gameId && onGameDetail ? () => onGameDetail(p.gameId!) : undefined} onDelete={() => onDelete(p.id)} />
                ))}
              </div>
            </div>
          )}
          {filtered.length === 0 && search && (
            <p style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted)', fontSize: '0.85rem' }}>No sessions matching "{search}"</p>
          )}
        </>
      )}
    </div>
  );
}

function ProjectCard({ project, quality, onClick, onGameDetail, onDelete }: {
  project: Project;
  quality?: QualityScore;
  onClick: () => void;
  onGameDetail?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '1rem', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
      onClick={onClick}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: '0.25rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink-strong)' }}>{project.name}</span>
        <div className="flex items-center gap-2">
          {quality && (
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: quality.score >= 95 ? 'var(--success)' : quality.score >= 60 ? 'var(--warning)' : 'var(--error)' }}>
              {quality.score}
            </span>
          )}
          {project.deployed && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)', padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'color-mix(in srgb, var(--success) 14%, transparent)' }}>
              Live
            </span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete session"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1rem', padding: '0.25rem', lineHeight: 1 }}>
            &#215;
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p style={{ color: 'var(--muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          {project.gameId ? `${project.gameId}.freegamestore.online` : 'Draft'}
        </p>
        {onGameDetail && (
          <button onClick={(e) => { e.stopPropagation(); onGameDetail(); }}
            style={{ fontSize: '0.7rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
            Details
          </button>
        )}
      </div>
    </div>
  );
}

const accentBtnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '0.5rem 1rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};

const iconBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: '1px solid var(--line)',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  color: 'var(--ink)',
  fontSize: '1rem',
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  color: 'var(--ink)',
  fontSize: '0.8rem',
  fontFamily: 'var(--font-body)',
};

const sectionLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--muted)',
  marginBottom: '0.75rem',
};
