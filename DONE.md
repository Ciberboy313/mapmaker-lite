# Cose completate

Qui registriamo tutte le modifiche importanti già implementate nel progetto.

- Sistemati warning/linter legati a Tailwind in `src/index.css` (direttive @tailwind sostituite o resettate per evitare falsi positivi).
- Risolto errore di sintassi TSX in `src/App.tsx` che bloccava la build (escape/parse di `parseInt`/stringhe).
- Build di produzione (Vite) eseguibile con successo (dist generata).
- Dev server web (Vite) funzionante per sviluppo iterativo.
- Electron verificato localmente (Node 20 LTS). In ambienti headless/CI potrebbe non avviarsi.
- Implementati Assets e Folders:
  - Creazione cartelle inline con pulsante "Aggiungi" e supporto Enter/Escape.
  - Visualizzazione liste cartelle e lista "Senza folder".
- Implementato drag & drop:
  - Drag assets -> canvas per creare sprites.
  - Drag assets -> folder per spostarli.
  - Folder come drop target (header e lista cartelle).
- Evidenziazione drop target durante drag & drop implementata (highlight visivo della cartella sotto il cursore).
- Reso l'azione "click su asset" non più creativa di sprite (ora il click seleziona solo nell'UI).
- Aggiunte sezioni collapsible per le cartelle (apri/chiudi come in VS Code).
- Aggiunto context menu (logica e UI):
  - Stato del menu contestuale, apertura in posizione clientX/clientY.
  - Azioni: rinomina, elimina, imposta come background, carica in cartella.
  - Input file nascosto collegato al context menu per il flusso "Carica in cartella".
- Aggiunto sistema base per impostare background della mappa tramite asset selezionato.
- Implementato esportazione PNG (raster) dell'intera mappa con sfondo e sprite.
- Implementato zoom/rotate per singoli sprite tramite mouse/combinatori:
  - Shift + rotellina = scala (zoom) del singolo sprite quando selezionato.
  - Alt + rotellina = ruota lo sprite selezionato.
  - Alt + click + drag orizzontale = rotazione interattiva con il mouse.

- Implementato Undo/Redo per sprite:
  - Stack storico con scorciatoie Ctrl/Cmd+Z, Ctrl+Y o Ctrl+Shift+Z.

---
Aggiorna questo file man mano che completi nuove attività (aggiungi data e riferimento PR/commit).

- 2025-11-13 — Revoca automatica ObjectURL per immagini caricate
  - Alla decodifica delle immagini caricate da file (blob:), viene chiamato URL.revokeObjectURL e il riferimento interno viene azzerato per evitare leak.
  - Revoca confermata anche su delete asset e cleanup all'unmount del componente principale.

- 2025-11-15 — Export unificato e undo limitato
  - Utility renderToCanvas + canvasToBlobPNG per export coerente (toolbar e modale).
  - Toolbar export (100/75/50/25) usa la utility condivisa.
  - Undo/Redo limitato a 100 snapshot per contenere memoria.

- 2025-11-15 — Gestione ObjectURL e anteprime
  - Revoca URL.revokeObjectURL su onload/delete/unmount.
  - Anteprime: Assets e Livelli usano img.src con fallback a url.

- 2025-11-15 — Interazioni canvas
  - Pan vs drag: click su sprite → drag sprite; vuoto → pan.
  - Wheel su sprite selezionato: scala/ruota solo sprite.

- 2025-11-15 - Dev UX
  - Rimosso menu "Nuova mappa veloce" (presets nel modale).
  - Disabilitata cache Electron in dev per ridurre errori.
  - Script dev-smart.mjs per gestire porta Vite e VITE_DEV_SERVER_URL.

- 2025-11-15 - Modale "Crea nuova mappa"
  - Conferma via Enter (submit del form) ed Escape per chiudere.
  - Chiusura garantita alla conferma; reset dello stato bozza.
  - Fix background: forzato il load dell'immagine selezionata/caricata se non ancora decodificata.

- 2025-11-15 - Layout e workspace
  - Nessuno scroll della pagina: l'app si adatta alla finestra (overflow hidden su html/body/#root).
  - Il contenitore principale riempie l'altezza disponibile.
  - Area fuori mappa nel canvas resa nera (#000) per una base uniforme.
