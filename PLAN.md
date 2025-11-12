# Piano di lavoro (refactor UI + sviluppo)

Questo piano guida il refactoring dell'interfaccia (stile Inkarnate/DungeonDraft) e le prossime feature. Verrà aggiornato man mano che procediamo.

## Stato attuale (FATTO)
- Save/Load progetto (JSON) + loader immagini con contatore
- Export PNG con opzione trasparenza e avviso per mappe grandi
- Menu nativo Electron + IPC sicuro (preload) tra Menu → Renderer
- Logging persistente su file: `electron/logs/main-*.log`, `renderer-*.log`
- Pannello Proprietà: controlli scala (1–200%), rotazione (±360°), opacità (0–100%) con slider + input numerico
- Scorciatoie stile DD: Q/E rotazione, +/= e − scala %, ,/. opacità %, frecce (shift=10px), Del/Backspace elimina
- Zoom bloccato per l’UI (solo canvas/asset zoomano); rimosse fasce inutili; pulita sezione Assets (niente controlli BG nelle card)

## Obiettivo macro
Allineare il layout e l’UX agli editor di mappe moderni (Inkarnate/DungeonDraft): layout modulare 3 colonne, strumenti verticali, inspector chiaro, assets panel con ricerca e anteprime scalabili. Nessuno zoom dell’UI, solo del canvas.

## Refactor UI – Roadmap dettagliata

Step 1 — Componentizzazione minima (Inizio subito)
- [ ] Aggiungere `src/types.ts` (Sprite/Asset/Folder) e usare i tipi condivisi
- [ ] Estrarre `MapCanvas` in `src/components/MapCanvas.tsx` (senza cambiare API)
- [ ] Estrarre `Inspector` (pannello destro) in `src/components/Inspector.tsx`

Step 2 — Layout base modulare
- [ ] Riorganizzare `App` con layout 3 colonne: `ToolsBar | MapCanvas | Inspector`
- [ ] Aggiungere `TopStatus` sottile (zoom canvas, dimensione mappa, stato asset)
- [ ] Compattare padding/margini per massimizzare spazio canvas

Step 3 — Assets panel
- [ ] Estrarre `AssetsPanel.tsx` (griglia con cartelle)
- [ ] Aggiungere ricerca e slider dimensione anteprime asset

Step 4 — Tools bar
- [ ] `ToolsBar.tsx` con strumenti verticali (select/move/rotate/scale/delete) e stato attivo

Step 5 — QA e rifiniture
- [ ] Verifica drag&drop asset su canvas, z‑order, delete/undo/redo
- [ ] Allineare menù contestuali e scorciatoie; rimuovere comportamenti obsoleti

## Backlog tecnico
- [ ] Revoca `URL.revokeObjectURL` su rimozione/replace/background
- [ ] Export sicuro per mappe enormi (downscale/tiled export)
- [ ] Persistenza in IndexedDB (auto‑save + recenti)
- [ ] Performance rendering: disegno “dirty” e culling offscreen

## Note
- Mantenere la compatibilità con il menu nativo e l’IPC.
- Non introdurre zoom dell’UI: solo zoom del canvas/asset.
- Ogni step deve essere piccolo e verificabile.

