# Architettura e Mappa del Codice

Questa guida descrive l’architettura di MapMaker Lite, i principali moduli, i flussi di dati e le aree critiche note. Serve come riferimento per lo sviluppo e per il debugging.

## Struttura Progetto (src/)

- `App.tsx` – orchestratore UI e stato applicativo. Gestisce:
  - Stato principale: `assets`, `folders`, `sprites`, selezioni, griglia/snap, `mapSize`, pan/zoom.
  - Undo/Redo per `sprites` (stack in memoria), shortcut globali, salvataggio/caricamento progetto (JSON).
  - Export PNG (modale e pulsanti rapidi nella toolbar) e logging.
  - Integrazione pannelli: `AssetsPanel`, `Inspector`, `ToolsBar`, `TopStatus`, `MapCanvas`.
- `components/MapCanvas.tsx` – rendering canvas della mappa:
  - Disegna background e sprite ordinati per `z`.
  - Gestisce interazioni di selezione e strumenti (pan, rotate, scale, delete) su canvas.
- `components/AssetsPanel.tsx` – gestione assets e cartelle:
  - Ricerca, slider anteprime, drag & drop su canvas e tra cartelle.
  - Context menu (rinomina, elimina, set background, carica qui).
- `components/Inspector.tsx` – pannello proprietà:
  - Mostra e modifica le proprietà dello sprite selezionato (posizione, rotazione, scala, opacità, visibilità, lock, z-order).
- `components/ToolsBar.tsx` – strumenti verticali.
- `components/TopStatus.tsx` – status bar (zoom, pan, dimensioni mappa, asset in caricamento).
- `model/project.ts` – serializzazione progetto: tipizza e valida il payload JSON.
- `types.ts` – tipi condivisi: `Sprite`, `Asset`, `Folder`.
- `logger.ts` – logging con download logs.

## Modello Dati Principale

- `Asset { id, name, url, img?, w?, h?, folderId?, _objectUrl? }`
  - `url`: sorgente immagine (può essere `blob:` in sessione). `_objectUrl` è gestito per revoca.
- `Sprite { id, name, img, x, y, scale, rotation, opacity, visible, locked, z }`
  - `name` corrisponde a `Asset.name` per il linking alla deserializzazione.
  - Miglioria prevista: collegamento per `assetId` per robustezza (anteprime layer, migrazioni).
- `Folder { id, name }` e relazione `Asset.folderId` opzionale.

## Flussi Chiave

- Import Assets:
  - Da file input o drag&drop su `AssetsPanel` → si crea `URL.createObjectURL(file)` → si istanzia `Image()` → su `onload` si valorizzano `img,w,h` e si revoca l’ObjectURL.
- Drag Asset → Canvas:
  - `MapCanvas` crea uno `Sprite` con `img` dall’asset, posizione iniziale e `z` massimo+1.
- Undo/Redo:
  - Stack di snapshot degli array `sprites` (commit su mouseup). Shortcut: Ctrl/Cmd+Z, Ctrl+Y.
- Export PNG:
  - Utility condivisa `renderToCanvas` (toolbar e modale con fallback) + `canvasToBlobPNG`.

## Scorciatoie/Interazioni

- G/S: toggle griglia/snap. Q/E: rotazione; +/-: scala; ,/. : opacità; Frecce (Shift=10px); Del: elimina.
- Toolbar export: genera un canvas out con scala scelta e disegna background + sprite ordinati.

## Build/Run

- Web: `pnpm dev` (Vite). Desktop: `pnpm dev` (Vite + Electron). Build desktop: `pnpm build:desktop`.

## Aree Critiche e Allineamento con Known Issues

1) Export duplicato in due percorsi
   - `exportPng` (modale) e i pulsanti export nella toolbar implementano logiche quasi duplicate.
   - Rischio divergenza (es. alpha/trasparenza, fallback background, z-order, scale). Conviene centralizzare in una utility condivisa.

2) Undo/Redo non limitato
   - Stack di snapshot completo degli array `sprites`. Su sessioni lunghe o con molte operazioni può crescere in RAM.
   - Azione suggerita: limite circolare (es. 100 step) e grouping operazioni con timer.

3) Canvas grande: memoria e tempi export
   - Il modale export usa un canvas `mapSize.w × mapSize.h`. Per mappe enormi può causare OOM/tab crash.
   - La toolbar offre downscale, ma il modale potrebbe armonizzarsi con le stesse opzioni (percentuali) o offrire tiled export (PoC).

4) Lifecycle immagini / revoca ObjectURL
   - Gestita: revoca su `onload`, su delete asset, e cleanup on unmount in `App.tsx`.
   - Restare vigili su ricarichi/replace e background switch.

5) Performance di rendering
   - `MapCanvas` ridisegna al cambiamento di stato. Per scene dense si può valutare: dirty rectangles, culling offscreen, o WebGL.

6) Persistenza stato
   - Attualmente locale (in memoria) e salvataggio manuale JSON. Per UX migliore: IndexedDB per autosave e lista recenti.

7) Accessibilità e input
   - Context menu mouse-first, scorciatoie ok. Da migliorare: focus management, ARIA sui menu, e navigazione tastiera.

## Raccomandazioni Operative

- Estrarre una utility `renderToCanvas({sprites, assets, mapSize, scale, transparent})` usata sia dal modale che dalla toolbar.
- Aggiungere cap agli stack undo/redo e batching.
- Integrare downscale nel modale export e warning con soglia configurabile.
- Introdurre persistenza IndexedDB (assets metadata + sprites + folders) con salvataggio debounced.
- Preparare test unit per `model/project` e per la utility di export.
 - Collegare gli sprite agli asset per `assetId` e rimuovere accoppiamento per nome.
