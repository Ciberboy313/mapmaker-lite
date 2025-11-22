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
- [x] Aggiungere `src/types.ts` (Sprite/Asset/Folder) e usare i tipi condivisi
- [x] Estrarre `MapCanvas` in `src/components/MapCanvas.tsx` (senza cambiare API)
- [x] Estrarre `Inspector` (pannello destro) in `src/components/Inspector.tsx` e integrarlo in App

Step 2 — Layout base modulare
- [x] Aggiungere `TopStatus` sottile (zoom canvas, dimensione mappa, stato asset)
- [x] Aggiungere `ToolsBar` verticale (select/move/rotate/scale/delete)
- [x] Riorganizzare area centrale con `ToolsBar | MapCanvas` e status overlay
- [x] Rifinitura layout 3 colonne e compattazione padding/margini

Step 3 — Assets panel
- [x] Estrarre `AssetsPanel.tsx` (griglia con cartelle)
- [x] Aggiungere ricerca e slider dimensione anteprime asset
- [x] DnD su cartelle (sposta asset), context menu (asset/folder), azione "Carica qui"

Step 4 — Tools bar
- [x] `ToolsBar.tsx` con strumenti verticali (select/move/rotate/scale/delete) e stato attivo
- [x] Integrazione tool nel canvas: pan con tool Pan; Rotate/Scale via wheel senza mod; Delete a click
- [x] Estendere interazioni (drag per scala/rotazione, feedback cursore e hover)

Step 5 — QA e rifiniture
- [x] Verifica drag&drop asset su canvas, z‑order, delete/undo/redo
- [x] Allineare menù contestuali e scorciatoie; rimuovere comportamenti obsoleti
- [x] Pulsante help con scorciatoie nel top bar

## QA checklist
- Canvas
  - [ ] Pan (tool Pan, middle, Shift+left)
  - [ ] Rotate/Scale: drag orizzontale e rotella su sprite selezionato (batch undo)
  - [ ] Cursore contestuale per tool e hover
  - [ ] Export PNG in varie scale (downscale 75/50/25)
- Assets
  - [ ] Ricerca e slider anteprime
  - [ ] Drag asset → canvas crea sprite
  - [ ] Drag asset → cartella sposta `folderId`
  - [ ] Context menu: asset/folder (rinomina, elimina, carica qui, set background)
- Layers/Inspector
  - [ ] Z‑order: su/giù, porta in alto/basso da UI e scorciatoie
  - [ ] Lock/Unlock e visibilità, delete con conferma
  - [ ] Undo/Redo per move/rotate/scale/opacity/lock

## Backlog tecnico
- [x] Revoca `URL.revokeObjectURL` su rimozione/replace/background
- [ ] Export sicuro per mappe enormi (downscale/tiled export)
- [ ] Persistenza in IndexedDB (auto‑save + recenti)
- [ ] Performance rendering: disegno “dirty” e culling offscreen

## Note
- Mantenere la compatibilità con il menu nativo e l’IPC.
- Non introdurre zoom dell’UI: solo zoom del canvas/asset.
- Ogni step deve essere piccolo e verificabile.

---

## Aggiornamenti recenti (2025-11-15)

- Export unificato con utility condivisa; undo/redo limitato (100).
- Interazioni: pan/drag separati, wheel su sprite selezionato solo per quello.
- Modale "Crea mappa": Enter/Escape, chiusura su conferma, fix caricamento background selezionato.
- Layout: nessuno scroll pagina; workspace adattivo; fondo canvas nero.

## Prossime azioni

- Migrare il linking sprite→asset da `name` a `assetId` (robustezza anteprime layer e salvataggi).
- Rifinire hit-test per sprite piccoli/ruotati; cursori contestuali coerenti.
- Unificare completamente export modale sulla utility (alpha/background) ed estendere QA export.
- Compattare ulteriormente top/header/overlay per massimizzare l'altezza utile.
- Aggiungere preview del background selezionato nel modale prima della creazione.

## QA Focus

- Popup "Crea mappa": Enter/Escape, conferma chiude sempre, applica dimensioni e background.
- Wheel: con selezione attiva non zooma il canvas; Ctrl/Cmd + wheel = zoom; wheel senza selezione = pan.
- Anteprime in Livelli: `sprite.img.src` con fallback `asset.img.src`/`asset.url`.
