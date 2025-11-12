# Punti deboli & potenziali rallentamenti

Questo file elenca i possibili punti deboli noti che possono causare rallentamenti, leak o instabilità. Per ogni voce: descrizione, gravità, sintomi e possibili contromisure.

- ObjectURL non revocati (Alta)
  - Descrizione: si usano `URL.createObjectURL` per preview di immagini senza chiamare sistematicamente `URL.revokeObjectURL`.
  - Sintomi: aumento dell'uso di memoria nel browser se si caricano molte immagini.
  - Contromisure: revocare l'URL dopo che l'immagine è caricata e non più necessaria (o quando l'asset è eliminato).

- Esportazione PNG per mappe grandi (Alta)
  - Descrizione: l'export crea un canvas con dimensioni pari a `mapSize` e può consumare molta memoria quando la mappa è molto grande (es. 4096x3072 o più).
  - Sintomi: crash del tab, errore OOM, lento tempo di export.
  - Contromisure: implementare esportazione a tiles o downscaling progressivo; mostrare warning se le dimensioni superano una soglia.

- Caricamento massivo di immagini (Media)
  - Descrizione: caricamenti multipli contemporanei possono saturare memoria e DOM se si tengono tutte le immagini in memoria.
  - Sintomi: rallentamenti UI, GC frequente.
  - Contromisure: generare thumbnails, limitare dimensione massima, decodifica off-main-thread (createImageBitmap), lazy-load.

- Re-rendering frequente del canvas (Media)
  - Descrizione: il canvas viene ridisegnato in RAF per ogni frame; con molte operazioni pesanti può causare CPU load.
  - Sintomi: alta CPU, scatti nell'interfaccia.
  - Contromisure: evitare il ridisegno completo quando non necessario, culling degli sprite non visibili, usare layering o WebGL.

- Mancanza di undo/redo (Bassa ma UX importante)
  - Descrizione: azioni irreversibili (cancellazione asset/sprite) non hanno undo.
  - Sintomi: frustrante per l'utente.
  - Contromisure: implementare un command stack con snapshot minimali (operazioni differenziali).

- Electron packaging / install nel container (Bassa)
  - Descrizione: Electron non si installa/avvia correttamente in questo ambiente container/CI.
  - Sintomi: impossibilità di testare build desktop nel container.
  - Contromisure: eseguire build/test Electron su macchine o runner con GUI o usare test headless su runner dedicati.

- LocalStorage limits & race conditions (Bassa)
  - Descrizione: salvataggi grandi possono fallire; accessi concorrenti a localStorage non sono atomici.
  - Sintomi: perdita di dati o eccezioni.
  - Contromisure: usare IndexedDB per payload più grandi e code serializzate per scritture.

- Sicurezza: immagini esterne potenzialmente malevole (Bassa)
  - Descrizione: se si permette il caricamento di immagini remote, potrebbero esserci problemi di CORS o risorse malevole.
  - Contromisure: validare tipi MIME, limitare fonti esterne e considerare sanitizzazione.

---
Aggiorna questa lista con severity, link alla issue e piano di rimedio quando apri le PR per risolverle.
