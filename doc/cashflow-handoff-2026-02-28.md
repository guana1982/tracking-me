# CashFlow Handoff - Sessione 2026-02-28

## Obiettivo della pagina
Trasferire in web app la logica del file Excel "check patrimonio" con:
- inserimento periodico di nuovi check,
- calcoli automatici (differenze e blocco azionario),
- visualizzazione trend storico e composizione patrimonio,
- UX simile a Excel (editing inline, aggiunta rapida riga, scroll/drag tabella).

## Stato attuale (implementato)
- Pagina `CashFlow` attiva su route `/cash-flow`.
- Header dedicato su cash-flow:
  - titolo `Net Worth` (al posto di `Budget`),
  - nascosti ratio `65/25/10`, selettore periodo e pulsante `Aggiungi spesa`,
  - data odierna mantenuta.
- Sezione grafico "Andamento Totale Nel Tempo":
  - accordion (default aperto),
  - linea blu `Totale` sempre visibile,
  - toggle per linee aggiuntive:
    - comparto azionario (verde),
    - BBVA (azzurra),
    - Trade Republic (arancio),
    - Webank c/c (marrone),
    - BPER (rossa).
- Grafico a torta nella stessa sezione:
  - rappresenta allocazione ultimo check,
  - label direttamente vicino agli spicchi (sigla + %),
  - tooltip su hover con dettaglio completo,
  - rimossa legenda verticale sotto al pie.
- Nuovo check:
  - non piu accordion,
  - apertura tramite bottone `Nuovo check`,
  - form in modale,
  - chiusura solo con `X` o `Submit`.
- Tabella storico:
  - ordinamento per data DESC (piu recente in testa),
  - differenze calcolate sulla riga recente rispetto alla riga immediatamente successiva (meno recente),
  - evidenza colonna `TOT ATTUALE`,
  - editing inline righe esistenti,
  - inserimento inline nuova riga (`+ Nuova riga`),
  - eliminazione riga,
  - drag-to-scroll orizzontale + verticale col mouse,
  - drag non avviabile su riga in edit inline,
  - header tabella sticky (titoli sempre visibili durante scroll verticale).

## Regole di calcolo principali
- `commissionTotal = commissionPerEtf * etfCount`
- `tasseComm = (rendimentoLordo * 26 / 100) + commissionTotal`
- `rendimentoNetto = rendimentoLordo - tasseComm`
- `azionarioNetto = etfLordo - tasseComm`
- `totAttuale = bbva + tradeRepublic + webankCc + webankObbl + azionarioNetto + bper + tricount + cartaWebank + edenred`
- `diff*` calcolati rispetto al check immediatamente precedente nel tempo (in vista DESC: la riga sotto).

## Persistenza dati attuale
Solo client-side via `localStorage`.

Chiavi:
- `budget-cashflow-checks-v2`
- `budget-cashflow-checks-v1` (legacy read)
- `budget-cashflow-settings-v1`

Nota:
- Persistenza su DB **non ancora implementata** (stimata fattibile, ma da progettare API + mapping + migrazione dati).

## File chiave
- `apps/frontend/src/pages/CashFlow.tsx`
  - logica principale pagina, modale, tabella, grafici, calcoli, localStorage.
- `apps/frontend/src/components/Layout.tsx`
  - adattamento header quando `pathname.startsWith('/cash-flow')`.
- `apps/frontend/src/App.tsx`
  - route pagina cash flow.

## Stato UX/UI richieste utente (tracking)
- Drag & drop spese dashboard: richiesto e discusso in sessioni precedenti (fuori da questo handoff).
- CashFlow:
  - [x] struttura colonne in stile Excel (input + diff + blocco azionario)
  - [x] editing inline
  - [x] aggiunta inline nuova riga
  - [x] ordinamento corretto per data
  - [x] diff sulla riga recente
  - [x] form nuovo check in modale
  - [x] grafici linea + pie integrati
  - [x] toggles multi-linea
  - [x] drag scroll orizzontale e verticale
  - [x] sticky header tabella

## Possibili prossimi step
1. Persistenza DB allineata alla dashboard:
   - endpoint CRUD cash-flow checks,
   - endpoint settings (commissione/numero ETF),
   - sync iniziale da localStorage (opzionale migrazione one-shot).
2. Test:
   - unit test calcoli (`computeStockValues`, diff, total),
   - test ordinamento/data edge-case (stessa data),
   - test integrazione UI per inline edit/add.
3. Hardening UX:
   - validazioni data/numero piu restrittive,
   - conferma su delete riga,
   - gestione errori e stato di salvataggio (quando si passa a DB).

## Comandi utili
Da root `project2026`:

```bash
pnpm --filter @budget/frontend exec tsc --noEmit
pnpm --filter @budget/frontend dev
```

## Note operative per il prossimo agente
- Evitare regressioni su:
  - ordinamento DESC e logica diff associata alla riga recente,
  - formula tasse/commissioni/azionario netto,
  - comportamento drag-to-scroll durante edit inline.
- Prima di modificare la tabella, verificare sempre:
  - sticky header funzionante,
  - colonna `TOT ATTUALE` ancora evidenziata.
