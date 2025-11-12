# Piano di lavoro

Questo file traccia attività, stato e note per implementare le priorità.

## 1) Nuova mappa: modale iniziale + validazioni (In coda)
- Modale/wizard "Nuova mappa" con: larghezza, altezza, griglia (on/size), background.
- Rimuovere vincoli HTML rigidi (min/step) sui campi; validare lato JS e mostrare alert visivi.
- Pulsante “Nuovo progetto” e salvataggio impostazioni iniziali.

Note: dimensioni accettano input libero; clamp e messaggi inline in caso di valori estremi.

## 2) Revoca ObjectURL (Da fare)
- Tracciare URL creati per ogni asset.
- Revocare `URL.revokeObjectURL` su rimozione/replace/clear.
- Verificare cambio background rilasci anche risorse.

## 3) Export sicuro mappe grandi (Da fare)
- Warning se pixel totali superano soglia (es. > 20M px).
- Opzione downscale per export “safe”.
- (Futuro) Tiling per export ad alta risoluzione.

## 4) Persistenza (MVP) (Da fare)
- Salvare folders/assets metadata/sprites/mappa in IndexedDB.
- Prompt avvio: caricare progetto esistente o crearne uno nuovo.

## 5) Performance rendering (Da fare)
- Flag “dirty” per evitare ridisegno continuo se nessun cambiamento.
- Culling sprite fuori viewport.

## Log cambiamenti
- 2025-11-12: Creato PLAN.md e concordate priorità con maintainer.

