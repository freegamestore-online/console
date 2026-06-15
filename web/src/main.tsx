import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'system-ui' }}>
          <div style={{ maxWidth: 400, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Something went wrong</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
