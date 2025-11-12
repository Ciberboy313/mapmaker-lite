# Miglioramenti pianificati

Questo file tiene traccia delle idee e delle migliorie da implementare per il progetto "mapmaker-lite".
Organizza le task per priorità e fornisce brevi note sull'impatto e la stima di complessità.

Formato suggerito per ogni voce:

- Titolo (Priorità) — Breve descrizione. Impatto / Stima (Low/Med/High)

## Priorità Alta

- Revoca di ObjectURL dopo l'uso (Alta) — Chiamare `URL.revokeObjectURL` per evitare leak di memoria quando si caricano molte immagini. Impatto: memoria. Stima: 0.5 giorno.
- Limitazione dimensione canvas di esportazione / streaming (Alta) — Gestire l'export per mappe molto grandi (tiling o downscale) per evitare crash/mancanza memoria. Impatto: stabilità. Stima: 1-2 giorni.
- Persistenza stato (Alta) — Salvare `folders`, `assets`, `sprites` sul localStorage o backend per mantenere lo stato tra sessioni. Impatto: usabilità. Stima: 1 giorno.

## Priorità Media

- Lazy-load preview / thumbnails (Media) — Generare thumbnail a bassa risoluzione per la lista assets per ridurre memoria e time-to-paint. Impatto: performance UI. Stima: 1-2 giorni.
- Undo/Redo (Media) — Implementare stack di operazioni per annullare/ripristinare modifiche su sprite e folder. Impatto: UX avanzata. Stima: 2-3 giorni.
- Drag reorder layers nella colonna Layers (Media) — Permettere reorder con drag per cambiare Z-order facilmente. Impatto: UX. Stima: 1 giorno.
- Migliorare la UI del context menu (Media) — Aggiungere icone, shortcut, sottomenù, accessibilità e navigazione da tastiera. Impatto: UX/accessibilità. Stima: 1 giorno.

## Priorità Bassa

- Supporto cartelle annidate (Bassa) — Implementare gerarchia di cartelle per assets. Impatto: organizzazione. Stima: 2-3 giorni.
- Ottimizzazioni WebGL (Bassa) — Valutare passaggio a WebGL per grandi scene (rendering più veloce). Impatto: performance su scene complesse. Stima: ricerca + PoC.
- Modalità offline / sincronizzazione con cloud (Bassa) — Serializzare e sincronizzare stato via backend. Impatto: funzionalità. Stima: variabile.

## Note generali

- Ogni voce dovrebbe avere una issue/PR dedicata con criteri di accettazione e test.
- Prioritizzare prima le ottimizzazioni che risolvono potenziali crash o leak (revoca URL, export memoria).
- Documentare i tradeoff di UX vs complessità per le funzioni ad alto impatto.

---

Aggiorna questo file man mano che emergono nuove idee o cambiano priorità.
