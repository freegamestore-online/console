import { useState } from 'react';
import { Markdown } from './Markdown';

const STYLES: Record<string, React.CSSProperties> = {
  user: { alignSelf: 'flex-end', background: 'var(--accent)', color: 'white', borderBottomRightRadius: '0.15rem' },
  assistant: { alignSelf: 'flex-start', background: 'var(--panel)', border: '1px solid var(--line)', borderBottomLeftRadius: '0.15rem' },
  tool: { alignSelf: 'flex-start', fontSize: '0.72rem', fontFamily: 'monospace', background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--muted)', padding: '0.25rem 0.5rem', borderRadius: '0.35rem' },
  system: { alignSelf: 'center', fontSize: '0.78rem', color: 'var(--muted)', background: 'none' },
};

export function ChatMessage({ role, content }: { role: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const useMarkdown = role === 'assistant';
  const showCopy = (role === 'user' || role === 'assistant') && content.trim().length > 0;
  const onAccent = role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const bubble: React.CSSProperties = {
    maxWidth: '88%',
    padding: '0.55rem 0.75rem',
    borderRadius: '0.75rem',
    fontSize: '0.86rem',
    lineHeight: 1.5,
    wordBreak: 'break-word',
    ...(!useMarkdown ? { whiteSpace: 'pre-wrap' } : {}),
    ...STYLES[role],
  };

  const actionColor = onAccent ? 'rgba(255,255,255,0.75)' : 'var(--muted)';

  return (
    <div style={bubble}>
      {useMarkdown ? <Markdown text={content} /> : content}
      {showCopy && (
        <div className="flex gap-0.5 mt-1" style={{ marginLeft: -4, opacity: 0.85 }}>
          <button
            type="button"
            onClick={copy}
            title="Copy"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: copied ? (onAccent ? 'white' : 'var(--success)') : actionColor,
              fontSize: '0.8rem',
              lineHeight: 1,
              padding: '0.25rem',
              minWidth: 28,
              minHeight: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.25rem',
            }}
          >
            <span aria-hidden>{copied ? '\u2713' : '\u29C9'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
