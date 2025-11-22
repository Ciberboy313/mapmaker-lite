#!/usr/bin/env node
import net from 'node:net';
import { spawn } from 'node:child_process';
import http from 'node:http';

const tryPorts = [5173, 5174, 5175, 5176];

function checkPort(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port }, () => {
      // connection succeeded => port IN USE
      try { sock.destroy(); } catch {}
      resolve(false);
    });
    sock.on('error', (err) => {
      // ECONNREFUSED => nothing is listening => port FREE
      if (err && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND')) resolve(true);
      else resolve(true); // treat unknown as free to keep moving
    });
    // safety timeout
    setTimeout(() => { try { sock.destroy(); } catch {}; resolve(true); }, 500);
  });
}

// Start Vite without strict port; we'll discover the actual port by probing
const viteArgs = ["vite"];
let url = null;

const viteBin = process.platform === 'win32' ? '.\\node_modules\\.bin\\vite.cmd' : './node_modules/.bin/vite';
const electronBin = process.platform === 'win32' ? '.\\node_modules\\.bin\\electron.cmd' : './node_modules/.bin/electron';

const vite = spawn(viteBin, viteArgs.slice(1), { stdio: 'inherit', shell: true });

function waitForServer(u, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(u, (res) => {
        res.resume(); resolve(true);
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('Dev server not reachable'));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

async function waitForAnyServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const p of tryPorts) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${p}`, (res) => { res.resume(); resolve(true); });
          req.on('error', reject);
          setTimeout(() => reject(new Error('timeout')), 400);
        });
        return `http://localhost:${p}`;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('Dev server not reachable on candidate ports');
}

waitForAnyServer().then((foundUrl) => {
  url = foundUrl;
  const env = { ...process.env, VITE_DEV_SERVER_URL: url };
  const ele = spawn(electronBin, ['.'], { stdio: 'inherit', shell: true, env });
  const shutdown = () => { try { ele.kill(); } catch {} try { vite.kill(); } catch {} };
  ele.on('exit', () => { try { vite.kill(); } catch {} process.exit(0); });
  vite.on('exit', (code) => { try { ele.kill(); } catch {} process.exit(code ?? 0); });
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}).catch((e)=> {
  console.error('[dev-smart] Failed to reach dev server:', e?.message || e);
  try { vite.kill(); } catch {}
  process.exit(1);
});
