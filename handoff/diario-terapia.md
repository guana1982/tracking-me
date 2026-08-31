# Handoff — Diario: umore, terapia, valutazioni, piano

**Stato al 30/07/2026.** Branch `develop`, working tree pulito, tutto committato
(ultimo commit rilevante `13db18c`). Verifiche al momento della consegna:
`tsc --noEmit` pulito su backend e frontend, build Vite ok, **30/30 test**.

Questo documento serve a riprendere il lavoro a freddo. Contiene le decisioni e
i *perché*, che sono la parte che non si ricava leggendo il codice.

---

## 1. Contesto

App personale di finanza + diario alimentare, monorepo pnpm.

| | |
|---|---|
| Root | `C:\track-me\tracking-me` |
| Frontend | `apps/frontend` — React 18, Vite, TanStack Query, Tailwind, Recharts, lucide-react, date-fns |
| Backend | `apps/backend` — Fastify, Prisma 5.22, Zod, Swagger (`/docs`) |
| Shared | `packages/shared` — tipi + Zod + dizionari, build con tsup |
| DB | PostgreSQL |
| Deploy | Railway — `zesty-unity-production.up.railway.app` |
| Auth | Google OAuth, dati isolati per `userId` con cascade su tutte le tabelle |

**Trappola numero uno:** `@budget/shared` si risolve via `dist`. Dopo qualsiasi
modifica ai tipi condivisi va **ricompilato**, altrimenti backend e frontend non
vedono i nuovi export:

```bash
cd packages/shared && npm run build
cd apps/backend && npx prisma generate     # dopo ogni modifica allo schema
```

---

## 2. La specifica vincolante

`docs/feature-monitoraggio-terapia.md` — specifica funzionale scritta
dall'utente. Il §2 elenca principi che chiama **vincolanti**, e il documento ne
dà il razionale: in un utente con tratti ossessivi uno strumento di
auto-monitoraggio può diventare un rituale di controllo. Non ribaltarli per
"migliorare la UX":

1. **Un solo inserimento valutativo al giorno** per il check-in — modifica sì,
   duplicato no. Garantito da `@@unique([userId, date])` su `CheckInEntry`, non
   da convenzione UI.
2. **Nessun grafico nel diario.** Le curve vivono in `/food/trends`.
3. **Nessuna valutazione del singolo giorno**: mai "oggi meglio di ieri", mai
   frecce verdi/rosse su base giornaliera.
4. **Nessuna streak, badge, punteggio.** Una dose saltata non produce segnali
   negativi: è un fatto da registrare, non un fallimento da segnalare.
5. **Tutte le scale del check-in misurano l'intensità di un sintomo**
   (0 = assente, max = al peggio) così che *una curva che scende significa
   sempre miglioramento*. L'unica eccezione è etichettata (`isPositive`).
6. **Le letture sono settimanali, mai giornaliere.** Il grano giornaliero
   serve alla raccolta, quello settimanale alla lettura.
7. **Niente correlazioni sotto 21 osservazioni**
   (`MIN_OBSERVATIONS_FOR_CORRELATION`), e ogni cifra viaggia con la sua
   numerosità. Nessun "insight" generato in forma assertiva.

---

## 3. I quattro pezzi costruiti

Tutto è **innestato nel diario**, non in una sezione a parte: era la richiesta
esplicita dell'utente ("non deve essere una funzionalità separata").

### 3.1 Aderenza (assunzioni)
Catalogo di ciò che si assume (`TreatmentDefinition`) + risposta per slot/giorno
(`TreatmentIntake`: preso / in ritardo / non preso).

Il meccanismo che lo innesta: **gli slot sono le chiavi dei tipi pasto
dell'utente** + lo pseudo-slot `bedtime`. Così le dosi previste per un momento
compaiono *dentro il modale di quel pasto*, e rinominare un tipo pasto non
rompe nulla.

### 3.2 Check-in serale
`CheckInScale` (catalogo configurabile) + `CheckInEntry` (una al giorno).
Vive **dentro il modale Umore**, sotto lo stesso pulsante di salvataggio.
Slider precompilati dall'ultima risposta; ogni valore mostra la sua dicitura
(`4 — presente ma gestibile`); le scale con `levelLabels` diventano passi
nominati invece di numeri (le compulsioni non vanno contate: il conteggio
esatto è esso stesso un rituale).

### 3.3 Valutazioni ed episodi
Un unico catalogo `RatingDefinition` con due `kind`:

- **`SCALE`** — riga di caselle 1..max, in cima al diario. La riga è **solo un
  mezzo di inserimento e non ricorda nulla**: dopo il voto si svuota, così
  votare di nuovo la sera crea un secondo record invece di correggere il primo.
- **`EVENT`** — chip da toccare ("È appena successo"). Un tap registra
  l'episodio senza chiedere niente; **innesco e intensità si aggiungono dopo,
  dal recap in timeline**.

**L'innesco (`RatingEntry.trigger`) è il campo più prezioso del modulo** (lo
dice la specifica): testo libero con autocomplete dalla propria storia, e nel
tempo produce la classifica degli inneschi reali.

Ogni voto/episodio compare come **recap nella timeline all'orario in cui è
stato dato**, interlacciato con i pasti. Il recap è anche l'unico posto dove si
corregge: voto, nota, innesco e stati d'umore collegati si modificano **inline**,
senza aprire modali.

### 3.4 Piano terapeutico
- **Titolazione** (`TitrationStep`): cambi di dose programmati, dentro la
  gestione farmaci. Applicarli è un atto esplicito.
- **Scadenzario** (`Milestone`): esami, controlli, con i valori da controllare e
  le **avvertenze condizionali** (72 h senza pesi, creatina sospesa) che rendono
  valido un esame.
- **Peso** (`WeightEntry`): settimanale, una riga silenziosa nel diario.
- **Effetti collaterali**: sono scale del check-in non-core con passi nominati
  (`assente/lieve/moderato/forte`), proposte in base ai farmaci attivi.

---

## 4. Modello dati

Migration aggiunte da questo lavoro, in ordine:

| Migration | Contenuto |
|---|---|
| `20260727010000_add_quick_log_mood_category` | enum value `MOOD` su `QuickLogCategory` |
| `20260727020000_add_mood_definitions` | `mood_definitions` |
| `20260728000000_add_therapy_tracking` | `treatment_definitions`, `treatment_intakes`, `check_in_scales`, `check_in_entries` + enum `TreatmentKind`, `IntakeStatus` |
| `20260729000000_add_daily_ratings` | `rating_definitions`, `rating_entries`, `users.ratingsSeededAt` + enum `RatingLinkedForm` |
| `20260729010000_ratings_allow_repeat` | droppa l'unique per giorno sui voti (la riga è un input, non uno stato) |
| `20260729020000_add_therapy_plan` | `titration_steps`, `milestones`, `weight_entries` + enum `RatingKind`, `MilestoneKind` + colonne `kind`/`trigger`/`isSideEffect` |
| `20260729030000_add_day_track` | enum `DayTrack` + colonna `track` su valutazioni e scale, con UPDATE di allineamento |

> ⚠️ **Verifica lo stato applicato prima di toccare il DB**:
> `cd apps/backend && npx prisma migrate status`.
> Deploy: `npx prisma migrate deploy`. In locale: `npx prisma migrate dev`.

### Invariante da rispettare sempre: snapshot, non riferimento

Ogni record storico porta con sé **copia** di ciò che descriveva:

- `TreatmentIntake.treatmentName` / `.doseLabel`
- `CheckInEntry.valuesJson[].name/maxValue/isPositive`
- `RatingEntry.ratingName` / `.kind` / `.maxValue`

Così rinominare, archiviare o cancellare una voce di catalogo **non riscrive mai
il passato**. Le FK verso il catalogo sono nullable con `SetNull`. Chi aggiunge
entità nuove deve seguire la stessa regola.

### `DayTrack` — perché esiste

`BODY | MOOD | NONE`, presente su `RatingDefinition` e `CheckInScale`.
Dice a quale delle due curve dello "stato del giorno" contribuisce una risposta.
**L'app non deve mai dedurlo dal nome**: cosa è "fisico" e cosa "psicologico" è
una scelta dell'utente, ed è ciò che tiene generico il collegamento al grafico.
`NONE` esclude qualcosa dal punteggio.

---

## 5. API

Tutte sotto `/api`, tag Swagger fra parentesi.

**`/treatments`** *(Intakes)* — `GET|POST /`, `PUT|DELETE /:key`,
`GET|POST /day`

**`/check-in`** *(Check-in)* — `GET /scales`, `POST /scales/defaults`,
`POST /scales`, `PUT|DELETE /scales/:key`,
`GET /side-effects/suggested`, `POST /side-effects`,
`GET|POST /day`, `DELETE /day/:date`

**`/ratings`** *(Ratings)* — `GET|POST /`, `PUT|DELETE /:key`,
`POST /events/defaults`, `GET /triggers`,
`GET /entries`, `POST /entries`, `PUT|DELETE /entries/:id`

**`/therapy-plan`** *(Therapy plan)* — `GET|POST /titration`,
`POST /titration/:id/apply`, `DELETE /titration/:id`,
`GET|POST /milestones`, `GET /milestones/advisories`,
`PUT|DELETE /milestones/:id`, `GET /schedule`,
`GET|POST /weight`, `DELETE /weight/:id`, `GET /trends`

---

## 6. Mappa file

### Shared — `packages/shared/src/`
`therapy-dictionaries.ts` (vocabolario generico, `describeScaleValue`) ·
`therapy-types.ts` · `therapy-schemas.ts` · `rating-types.ts` ·
`rating-schemas.ts` · `therapy-plan-types.ts` · `therapy-plan-schemas.ts`
Modificati: `index.ts`, `food-types.ts` (marcatori su `FoodDayOverviewDTO`).

### Backend — `apps/backend/src/`
- `services/treatment.service.ts` — aderenza, slot = tipi pasto
- `services/check-in.service.ts` — scale, effetti collaterali, entry giornaliera
- `services/rating.service.ts` — voti, episodi, inneschi, seed una tantum
- `services/therapy-plan.service.ts` — titolazione, scadenze, peso, schedule
- `services/therapy-trends.service.ts` — lettura settimanale (§4.4)
- `services/food-dashboard.service.ts` — **la formula dello stato del giorno**
- `services/food-export.service.ts` — **il CSV**
- `lib/therapy-config.ts` + `config/therapy-config.json` — vocabolario esterno
- `routes/{treatment,check-in,rating,therapy-plan}.routes.ts`
- `services/food-classification.test.ts` — 30 test, unica suite

### Frontend — `apps/frontend/src/`
- `lib/{therapyApi,ratingApi,therapyPlanApi}.ts`
- `hooks/{useTherapyQueries,useRatingQueries,useTherapyPlanQueries}.ts`
- `components/therapy/` — `TreatmentManager`, `IntakeChecklist`,
  `DailyIntakeCard`, `CheckInScaleManager`, `CheckInSection`,
  `SideEffectPicker`, `TitrationPlanner`, `MilestoneManager`, `ScheduleLine`,
  `WeightLine`, `TherapyTrendsPanel`
- `components/food/` — `RatingRow`, `RatingNote`, `RatingManager`
  (esporta anche `TrackPicker`), `DailyRatingsCard`, `EventChips`,
  `MoodPickerModal`, `MoodManager`
- `pages/FoodDiary.tsx`, `pages/FoodTrends.tsx`, `components/food/StateTimeline.tsx`

**Chiavi React Query:** tutte prefissate `food*`, così una sola sweep a
predicato invalida l'intero dominio diario. Se aggiungi una query al diario,
mantieni il prefisso.

### Ordine dei blocchi in `FoodDiary`
navigazione data → striscia settimana → `ScheduleLine` → `DailyRatingsCard`
→ `DailyIntakeCard` → `WeightLine` → timeline del giorno → barra quick log.

---

## 7. Il CSV di export

`GET /api/food-dashboard/export.csv?from&to&tzOffset` →
`services/food-export.service.ts`. **È l'obiettivo dichiarato del diario**:
va dato in pasto a un LLM per l'analisi, quindi *tutto* ciò che l'utente
inserisce deve arrivarci. Header a 16 colonne, commento in testa al file che
documenta ogni `record_type`.

| `record_type` | cosa |
|---|---|
| `treatment` | la terapia in corso (stato, non evento) — ordinata **prima** del suo giorno |
| `day_summary` | apre il giorno, con i due punteggi |
| `weight` | pesata settimanale (`quantity` = kg) |
| `dose_change` | cambio dose, `intake_status` = programmata/applicata |
| `milestone` | esame/controllo, con valori e condizioni nella stessa riga |
| `meal_item` | un alimento (note del pasto in `text`) |
| `quick_log` / `mood_log` | nota fisica / nota d'umore |
| `intake` | una dose, momento in `meal_type` |
| `checkin` | **una riga per scala** + riga `nota` |
| `rating` | un voto (`scale_value`/`scale_max`) |
| `event` | un episodio, **innesco in `valence`** |

Regole non ovvie, da non rompere:
- Le righe sono ordinate per `sortKey = "<data> <ora> <suffisso>"`. Suffissi:
  `-1` terapia, `0` riepilogo/giorno, `1` eventi cronologici, `2` nota check-in.
- **Nessun filtro scarta righe.** Se aggiungi una sorgente, esportala tutta.
- Il check-in emette una riga per scala perché il numero di scale è definito
  dall'utente: una colonna fissa per scala si romperebbe al primo cambio.
- Gli stati d'umore scelti da una riga valutazione compaiono **due volte** ed è
  volontario: dentro `text` del `rating` (per leggerlo come un blocco unico) e
  come `mood_log` autonomo (perché la traccia umore alimenta dashboard e
  confronti). L'header lo dichiara così che l'LLM non conti due episodi.
- Unica cosa non esportabile: le **foto dei pasti**.

---

## 8. La formula dello stato del giorno

Vive in **un posto solo**: `food-dashboard.service.ts`, in testa al file, con il
commento che la descrive. Due tracce indipendenti, mai mescolate. Tutto
normalizzato su `[-1, +1]` prima della media:

- quick log → valenza (+1 / 0 / −1)
- voti (1..max) → `scoreFromVote`: 1 → −1, max → +1
- episodi → negativi per natura; l'intensità dice quanto, **senza intensità
  pesano −1 pieno** ("è successo" è il fatto)
- check-in → `scoreFromScale`: intensità sintomo invertita (0 → +1, max → −1),
  le scale `isPositive` lette al contrario

`scoreFromVote` e `scoreFromScale` sono esportate e coperte da test: sono la
logica con le convenzioni di segno, cioè quella dove un errore è invisibile a
occhio e devastante nella lettura.

**Peso e aderenza sono deliberatamente fuori dalle curve**: un chilogrammo non
ha una valenza, e "ho preso la pastiglia" non è un modo di sentirsi — sommarli
sporcherebbe il segnale. Viaggiano come **marcatori** su
`FoodDayOverviewDTO`: `eventCount`, `skippedIntakes`, `doseChanges`, `weightKg`,
resi in `StateTimeline` come ★ episodi, ✕ dosi saltate, ┆ cambio dose e peso nel
tooltip.

---

## 9. Configurazione esterna (§7 della specifica)

`apps/backend/config/therapy-config.json`, letto e cachato da
`src/lib/therapy-config.ts`.

- `sideEffects.byIngredient` — la chiave viene cercata (minuscola, senza
  accenti) dentro nome + principio attivo + forma dei farmaci **attivi**
- `sideEffects.common` — proposti sempre, se c'è almeno un farmaco attivo
- `examAdvisories` — le avvertenze condizionali offerte creando un esame

Sta in un file perché la specifica lo chiede: cambia con la terapia e non deve
richiedere un deploy di logica. Se il file manca o è rotto si degrada a liste
vuote — **verifica che `apps/backend/config/` finisca nel deploy Railway**.

---

## 10. Decisioni da non ribaltare per distrazione

Ognuna ha un motivo che non si vede dal codice.

1. **Le assunzioni non sono mai pre-spuntate.** Sarebbe più rapido, ma
   scriverebbe "preso" per dosi non prese, su un dato di aderenza che finisce
   dal medico.
2. **Il check-in si scrive solo se una scala è stata davvero mossa**
   (`checkInTouched`): un form intatto non deve inventare la risposta di un
   giorno.
3. **La riga del voto non ricorda il voto.** È un input. Il tocco sulla casella
   è il "salva" della riga e porta con sé nota e stati in attesa.
   Conseguenza accettata: **una nota scritta senza votare non viene salvata**, e
   l'app lo dice a schermo mentre scrivi.
4. **Modificare non sposta l'orario.** Correggere un voto non deve riordinare la
   timeline sotto il dito di chi sta correggendo.
5. **La scala controllata in modifica è quella dell'entry, non quella attuale**:
   un voto dato su 10 resta correggibile su 10 anche dopo un rescale.
6. **Applicare un cambio di dose è esplicito.** L'app non può sostenere che una
   dose è cambiata nella realtà solo perché è passata una data.
7. **Il modale Umore è raggiungibile anche senza la riga Umore.** Contiene il
   check-in serale: se l'unica porta fosse il chip della riga, cancellare quella
   riga lo renderebbe irraggiungibile in silenzio. `DailyRatingsCard` mostra un
   fallback quando nessuna caratteristica ha `linkedForm: 'MOOD'`.
8. **Il pulsante Umore in alto è stato rimosso** (header, FAB mobile, stato
   vuoto): era la stessa porta ripetuta tre volte.
9. **Niente di precaricato tranne una cosa.** Farmaci, scale ed episodi si
   installano solo su richiesta esplicita. Le uniche seminate d'ufficio sono le
   tre valutazioni (Umore / Benessere fisico / Allenamento), **una volta sola**,
   con `users.ratingsSeededAt` come guardia: cancellarle le lascia cancellate.

---

## 11. Limiti noti (audit di genericità)

Un altro utente può usare il modulo per qualcosa di completamente diverso senza
toccare codice. Quello che **non** può fare da solo:

1. **Cambiare i suggerimenti.** `therapy-config.json` è del deploy, non
   dell'utente, e il vocabolario è tarato su una terapia psichiatrica
   (sertralina, valproato, aloperidolo, litio, quetiapina, creatina). Per
   renderlo per-utente va spostato su tabella con una UI.
2. **Tracciare misure diverse dal peso.** `WeightEntry` è dedicata, non esiste
   un catalogo di misure periodiche (pressione, circonferenza, glicemia). È il
   gap più facile da chiudere e l'unico punto dove ho fatto una cosa specifica
   invece che generica.
3. **Collegare popup diversi da quello dell'umore.** `RatingLinkedForm` accetta
   `NONE | MOOD`; l'enum è pronto, servono altri selettori in codice.
4. **Rinominare o unire un innesco.** La lista è derivata da ciò che è stato
   scritto: `"rientro a casa"` e `"rientro casa"` restano due voci distinte
   nella classifica per sempre. Su un campo che la specifica chiama il più
   prezioso è una fragilità concreta — serve un piccolo gestore con rinomina di
   massa e unione.
5. **Convertire una caratteristica da Voto a Episodio.** L'API accetta già
   `kind` in update, manca il selettore nel form di modifica.

Costanti fissate: peso 7 giorni · inneschi 30 giorni · scadenzario 14 giorni ·
grafico terapia 12 settimane · soglia 21 osservazioni (quest'ultima è un
principio, non un parametro).

Dettaglio tecnico: **l'asse Y del grafico terapia è fisso 0–10**. Le scale con
passi nominati sono escluse dalle curve, quindi oggi non si vede; una scala
sintomo con massimo 5 resterebbe schiacciata in basso. Si risolve normalizzando
in percentuale del massimo.

Tutto è in italiano, cablato. Nessun i18n.

---

## 12. Cosa resta fuori dalla specifica

- **Notifiche (§5).** Il pezzo più costoso e il meno sotto controllo: è una web
  app, servono service worker, Web Push, chiavi VAPID e uno scheduler lato
  server, e su iOS funzionano solo con la PWA aggiunta alla home. È l'unica voce
  che può fallire per motivi che non dipendono dal codice.
- **Report medico (§4.5).** Legge tutto il resto, quindi va per ultimo. Nel
  frattempo è **surrogabile**: il CSV contiene già terapia, dosi, cambi,
  aderenza, check-in, voti, episodi, inneschi, effetti collaterali, peso ed
  esami — basta passarlo a un LLM.

---

## 13. Come verificare

```bash
cd packages/shared   && npm run build
cd ../../apps/backend && npx prisma generate && npx tsc --noEmit && npx vitest run
cd ../frontend        && npx tsc --noEmit && npx vite build
```

Atteso: nessun output da `tsc`, **30/30 test**, build Vite ok (l'avviso sul
chunk > 500 kB è preesistente e non correlato).

---

## 14. Vincoli di lavoro con questo utente

- **Non fare commit né push.** Suggerire messaggio e comandi, e lasciare fare a
  lui. (Fin qui ha committato sempre di persona.)
- **Nessuna attribuzione a strumenti di AI** nei repo: né trailer, né autori,
  né commenti, né file.
- Parla italiano, ma i commenti nel codice sono in inglese: mantieni la
  convenzione.
- Vuole sapere quando una scelta va contro la sua richiesta, con il perché — non
  gradisce che la si esegua in silenzio né che la si aggiri.

---

## 15. Domande aperte

1. **Le curve nel diario.** Ha chiesto che "tutto sia gestibile dentro la stessa
   pagina"; la gestione lo è, ma i grafici li ho tenuti in `/food/trends` perché
   il §2 della sua specifica vieta i grafici in home, e ne dà il motivo. Ha
   accettato implicitamente, ma la proposta di spostarli resta aperta.
2. **Nota senza voto.** Oggi non viene salvata (decisione 3 sopra). Gli è stato
   offerto di cambiarla; non ha risposto.
3. **Peso e aderenza nelle curve.** Oggi solo marcatori. Gli è stato chiesto con
   quale direzione dovrebbero pesare, se li volesse dentro; non ha risposto.
4. **Gestore degli inneschi** (limite 4). Offerto, non ancora richiesto.
