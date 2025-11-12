# MapMaker Lite

Editor leggero per mappe fantasy (worldbuilding) con PNG trasparenti.

## Prerequisiti
- Node.js LTS (18 o 20) consigliato con nvm-windows.
- Un gestore pacchetti: `pnpm` (consigliato) o `npm`.

Installazione rapida su Windows con nvm-windows:
1. Scarica l'installer: https://github.com/coreybutler/nvm-windows/releases
2. `nvm install 20.17.0 && nvm use 20.17.0`
3. Verifica: `node -v` `npm -v`
4. Installa pnpm (opzionale): `npm i -g pnpm`

## Avvio (web)
Con pnpm:
```bash
pnpm i
pnpm dev
```
Con npm:
```bash
npm install
npm run dev
```
Apri http://localhost:5173

## Build web
```bash
pnpm build
pnpm preview
```

## Desktop (Electron)
Sviluppo (apre Vite + Electron):
```bash
pnpm dev          # oppure: npm run dev
```
Build desktop (usa electron-builder):
```bash
pnpm build:desktop
```

Note:
- Gli script usano `concurrently` per avviare Vite ed Electron insieme.
- Variabile `VITE_DEV_SERVER_URL` è gestita dallo script `dev` in `package.json`.

## Script di setup rapido (Windows)
Esegui lo script PowerShell che installa/attiva Node (via nvm), installa dipendenze e avvia il dev server:
```powershell
pwsh -File scripts/setup-and-run.ps1
```
Opzioni:
- Specifica versione Node: `pwsh -File scripts/setup-and-run.ps1 -NodeVersion 20.17.0`
- Forza uso npm al posto di pnpm: `pwsh -File scripts/setup-and-run.ps1 -UseNpm`

## Funzioni
- Drag&drop asset (PNG/WebP/JPG)
- Griglia + Snap
- Layer/ordinamento, lock/visibilità
- Trasformazioni: posizione/scala/rotazione/opacità
- Esportazione PNG
