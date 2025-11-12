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
