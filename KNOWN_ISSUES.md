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

- Undo/Redo da estendere (Bassa)
  - Descrizione: undo/redo è presente per gli sprite, ma può essere esteso (limiti di profondità, grouping operazioni, memoria).
  - Contromisure: configurare limiti e grouping; opzionale persistenza.

- Electron in ambienti headless/CI (Bassa)
  - Descrizione: in ambienti senza GUI (CI/headless) l'avvio/packaging Electron può fallire.
  - Sintomi: impossibilità di testare build desktop nel runner.
  - Contromisure: eseguire build/test su runner con GUI/virtual display; per sviluppo locale raccomandato Node 20 LTS per compatibilità con Electron 33.

- LocalStorage limits & race conditions (Bassa)
  - Descrizione: salvataggi grandi possono fallire; accessi concorrenti a localStorage non sono atomici.
  - Sintomi: perdita di dati o eccezioni.
  - Contromisure: usare IndexedDB per payload più grandi e code serializzate per scritture.

- Sicurezza: immagini esterne potenzialmente malevole (Bassa)
  - Descrizione: se si permette il caricamento di immagini remote, potrebbero esserci problemi di CORS o risorse malevole.
  - Contromisure: validare tipi MIME, limitare fonti esterne e considerare sanitizzazione.

---
Aggiorna questa lista con severity, link alla issue e piano di rimedio quando apri le PR per risolverle.

## Nuove osservazioni

- Export duplicato in percorsi distinti (Media)
  - Descrizione: logica export presente sia nel modale (`exportPng`) che nei pulsanti rapidi della toolbar. Le due versioni non sono completamente allineate (gestione trasparenza, fallback background, scala), rischiando divergenze e bug.
  - Sintomi: differenze visive tra export da modale e da toolbar; regressioni su uno dei due percorsi dopo modifiche.
  - Contromisure: centralizzare in una utility condivisa la pipeline di rendering/export e riusarla in entrambi i punti.

- Undo/Redo senza limite di memoria (Bassa)
  - Descrizione: lo stack contiene snapshot completi dell’array `sprites`, senza cap.
  - Sintomi: crescita RAM nelle sessioni lunghe.
  - Contromisure: introdurre cap (es. 100) e batching temporale per gruppi di operazioni.

- Export modale potenzialmente pericoloso su mappe enormi (Alta)
  - Descrizione: usa sempre canvas a `mapSize` pieno. Se molto grande, rischia OOM.
  - Sintomi: crash tab o lento `toBlob`.
  - Contromisure: unificare con la logica di downscale della toolbar e/o introdurre tiled export.

- Preview layer non sempre visibili (Media)
  - Descrizione: i thumbnail di “Livelli” a destra possono fallire se si fa affidamento su URL revocati o se lo sprite non è linkato correttamente all’asset.
  - Sintomi: riquadri vuoti per alcuni sprite.
  - Contromisure: usare `sprite.img.src` come sorgente, fallback a `asset.img.src` o `asset.url`; collegare sprite→asset per `assetId`.

- Wheel su sprite attiva zoom canvas (Media)
  - Descrizione: in alcuni casi lo zoom canvas può prevalere sulla scala/rotazione dello sprite con wheel.
  - Sintomi: la mappa zooma invece di scalare lo sprite.
  - Contromisure: hit-test sullo sprite selezionato e `preventDefault()` quando sopra lo sprite.

- Spazio verticale limitato (Bassa)
  - Descrizione: margini/header riducono l’altezza verticale utile.
  - Sintomi: canvas “schiacciato”.
  - Contromisure: ridurre topbar/header, aumentare altezza contenitore centrale, rendere opzionale l’overlay.

- Dev server porta occupata (Bassa)
  - Descrizione: conflitto porta 5173 genera errori durante l’avvio.
  - Contromisure: usare script `dev-smart.mjs` e probing porte; fixare VITE_DEV_SERVER_URL in Electron.
