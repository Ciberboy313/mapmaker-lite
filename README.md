# MapMaker Lite

Editor leggero per mappe fantasy (worldbuilding) con PNG trasparenti.

## Stato del Progetto

Il progetto è in fase di sviluppo attivo. Per un elenco dettagliato delle funzionalità completate, consultare il file [DONE.md](DONE.md). Per le funzionalità pianificate e i miglioramenti futuri, vedere [IMPROVEMENTS.md](IMPROVEMENTS.md) e il [PLAN.md](PLAN.md).

## Funzionalità Principali

- **Editor Basato su Canvas:** Sposta, ruota, scala e regola l'opacità degli sprite.
- **Gestione degli Asset:** Organizza gli asset (PNG, WebP, JPG) in cartelle, con ricerca e anteprime.
- **Drag & Drop:** Trascina gli asset sulla tela per creare sprite e tra le cartelle per organizzarli.
- **Layer e Ordinamento:** Gestisci l'ordine degli sprite (z-index), bloccali e nascondili.
- **Griglia e Snap:** Attiva/disattiva una griglia e l'aggancio degli oggetti per un posizionamento preciso.
- **Undo/Redo:** Annulla e ripristina le modifiche agli sprite.
- **Esportazione in PNG:** Esporta la tua mappa come immagine PNG, con opzioni di ridimensionamento.
- **Salva/Carica Progetto:** Salva il tuo lavoro in un file JSON e ricaricalo in seguito.
- **Scorciatoie da Tastiera:** Un set completo di scorciatoie per un flusso di lavoro più rapido.
- **Applicazione Desktop:** Disponibile come applicazione desktop multipiattaforma grazie a Electron.

## Tech Stack

- **Framework:** React
- **Linguaggio:** TypeScript
- **Desktop:** Electron
- **Build Tool:** Vite
- **Styling:** Tailwind CSS

## Prerequisiti
- Node.js LTS (consigliato v20.x) con nvm o nvm-windows.
- Un gestore pacchetti: `pnpm` (consigliato) o `npm`.

Installazione rapida su Windows con nvm-windows:
1. Scarica l'installer: https://github.com/coreybutler/nvm-windows/releases
2. `nvm install 20 && nvm use 20`
3. Verifica: `node -v` e `npm -v`
4. Installa pnpm (opzionale): `npm i -g pnpm`

## Avvio (Sviluppo)

**Applicazione Web:**
```bash
# Con pnpm
pnpm install
pnpm dev

# Con npm
npm install
npm run dev
```
Apri l'URL mostrato nel terminale (di solito http://localhost:5173).

**Applicazione Desktop (Electron):**
Lo script `dev` avvia sia il server di sviluppo Vite che l'applicazione Electron.
```bash
# Con pnpm
pnpm install
pnpm dev

# Con npm
npm install
npm run dev
```

## Build

**Build Web:**
```bash
pnpm build:web
```
I file di produzione saranno nella cartella `dist`.

**Build Desktop:**
```bash
pnpm build:desktop
```
L'eseguibile per il tuo sistema operativo sarà nella cartella `dist`.

## Script di setup rapido (Windows)
Esegui lo script PowerShell che installa/attiva Node (via nvm), installa le dipendenze e avvia il server di sviluppo:
```powershell
pwsh -File scripts/setup-and-run.ps1
```

## Scorciatoie principali
- **G**: attiva/disattiva griglia
- **S**: attiva/disattiva snap
- **Ctrl/Cmd + ]**: porta in alto lo sprite selezionato
- **Ctrl/Cmd + [**: sposta su di un livello
- **Ctrl/Cmd + Alt + ]**: porta in alto (alias)
- **Ctrl/Cmd + Alt + [**: porta in basso (z min)
- **Q/E**: ruota sprite selezionato
- **+/-**: scala sprite selezionato
- **,/.**: opacità sprite selezionato
- **Del/Backspace**: elimina sprite

## Architettura

L'architettura del progetto è documentata in [ARCHITECTURE.md](ARCHITECTURE.md). Questo file fornisce una panoramica della struttura del codice, del modello dei dati e dei flussi principali.

## Problemi Noti

Siamo a conoscenza di alcuni problemi e aree di miglioramento. Consulta il file [KNOWN_ISSUES.md](KNOWN_ISSUES.md) per maggiori dettagli.

## Contribuire

I contributi sono i benvenuti! Se vuoi contribuire, dai un'occhiata al nostro [PLAN.md](PLAN.md) per vedere la roadmap di sviluppo.