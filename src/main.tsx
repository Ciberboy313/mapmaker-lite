import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorInfo } from 'react'
import { logger, initGlobalErrorHandlers } from './logger'

class Boundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_error: any) {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: ErrorInfo) {
    console.error('[ErrorBoundary] componentDidCatch', error, info);
    try { logger.error('ErrorBoundary', { message: String(error?.message||error), stack: error?.stack, componentStack: info?.componentStack }); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { style: { padding: 16, color: '#fecaca' } }, 'Si è verificato un errore. Controlla i log in electron/logs/renderer-*.log');
    }
    return this.props.children as any;
  }
}

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return React.createElement(Boundary, null, children as any);
}

try {
  console.log('[Bootstrap] Renderer bootstrap start');
  initGlobalErrorHandlers();
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[Bootstrap] #root element not found');
  } else {
    console.log('[Bootstrap] React root render');
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    )
  }
} catch (e) {
  console.error('[Bootstrap] Fatal error during render', e);
  try { logger.error('Bootstrap fatal', { error: String(e), stack: (e as any)?.stack }); } catch {}
}
