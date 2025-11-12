export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogEntry = {
  id: string;
  ts: string; // ISO
  level: LogLevel;
  message: string;
  meta?: any;
};

function uid(prefix = 'log') { return `${prefix}_${Math.random().toString(36).slice(2,10)}`; }

const STORAGE_KEY = 'mapmaker-lite-logs';
const MAX_ENTRIES = 2000; // circular buffer max

class Logger {
  private buffer: LogEntry[] = [];

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.buffer = JSON.parse(raw) as LogEntry[];
    } catch (e) {
      this.buffer = [];
    }
  }

  private push(entry: LogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length > MAX_ENTRIES) this.buffer = this.buffer.slice(this.buffer.length - MAX_ENTRIES);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buffer)); } catch (e) {}
    // always mirror to console
    const meta = entry.meta;
    const line = `[${entry.level.toUpperCase()}] ${entry.ts} ${entry.message}`;
    if (entry.level === 'error') console.error(line, meta);
    else if (entry.level === 'warn') console.warn(line, meta);
    else if (entry.level === 'debug') console.debug(line, meta);
    else console.log(line, meta);

    // forward to main via IPC if available for file logging
    try {
      const api: any = (window as any).logAPI;
      if (api && typeof api.log === 'function') {
        api.log(entry.level, entry.message, entry.meta);
      }
    } catch {}
  }

  log(level: LogLevel, message: string, meta?: any) {
    const e: LogEntry = { id: uid(), ts: new Date().toISOString(), level, message, meta };
    this.push(e);
  }
  debug(m: string, meta?: any) { this.log('debug', m, meta); }
  info(m: string, meta?: any) { this.log('info', m, meta); }
  warn(m: string, meta?: any) { this.log('warn', m, meta); }
  error(m: string, meta?: any) { this.log('error', m, meta); }

  clear() {
    this.buffer = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  getAll() { return [...this.buffer]; }

  download(filename = `mapmaker-lite-logs-${new Date().toISOString()}.json`) {
    try {
      const blob = new Blob([JSON.stringify(this.buffer, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      console.error('Failed to download logs', e);
    }
  }
}

export const logger = new Logger();

// helper to capture global errors
export function initGlobalErrorHandlers() {
  window.addEventListener('error', (ev) => {
    try {
      const err = ev.error || { message: ev.message, filename: ev.filename, lineno: (ev as any).lineno, colno: (ev as any).colno };
      logger.error('Uncaught error', { message: err.message || String(err), stack: err.stack || null, file: err.filename || null, lineno: (ev as any).lineno, colno: (ev as any).colno });
    } catch (e) {}
  });
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      const reason = (ev as any).reason;
      logger.error('Unhandled promise rejection', { reason });
    } catch (e) {}
  });
}
