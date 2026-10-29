# Feature: Diario Alimentare

## Contesto

Questa app è una piattaforma personale che oggi gestisce il patrimonio finanziario. Questa specifica aggiunge un secondo modulo, completamente indipendente a livello di dominio: un diario alimentare per annotare tutti i pasti quotidiani.

**Vincolo architetturale chiave:** il modulo deve riusare l'infrastruttura esistente (autenticazione, persistenza, routing, deploy) ma restare isolato come dominio — tabelle proprie, route proprie, componenti propri. L'app deve risultare "una piattaforma con due moduli", non un ibrido. Segui i pattern e le convenzioni già presenti nel codebase (struttura dei servizi, gestione stato, stile dei componenti).

**Vincolo di prodotto:** nessuna dipendenza esterna, nessuna chiamata ad API di terze parti (niente LLM, niente database nutrizionali). L'app registra dati grezzi; l'analisi avviene fuori dall'app, a valle, tramite export CSV.

## Obiettivo

Costruire una base dati completa e continuativa di tutto ciò che l'utente mangia, con il minimo attrito possibile in fase di inserimento. La metrica di successo è la costanza d'uso: l'inserimento di un pasto tipico deve richiedere meno di 15 secondi.

Non è un contatore di calorie. Niente calcolo di macro, calorie o valori nutrizionali in fase di inserimento: complicherebbe l'input e ucciderebbe la rapidità. Conta la completezza del dato, non la precisione al grammo.

## Modello dati

### Tabella `meals` (pasto)

| Campo | Tipo | Note |
|---|---|---|
| `id` | PK | |
| `user_id` | FK | coerente con il sistema auth esistente |
| `date` | date | giorno del pasto |
| `meal_type` | enum | `colazione` \| `pranzo` \| `cena` \| `spuntino` |
| `notes` | text, nullable | note libere |
| `photo_url` | string, nullable | riferimento alla foto allegata (vedi sotto) |
| `created_at` | timestamp | |

### Tabella `meal_items` (voce del pasto)

| Campo | Tipo | Note |
|---|---|---|
| `id` | PK | |
| `meal_id` | FK → meals | |
| `food_name` | string | testo libero, es. "pasta al pomodoro" |
| `quantity` | decimal, nullable | |
| `unit` | enum, nullable | `g` \| `ml` \| `pezzi` \| `porzione` \| `cucchiai` \| `tazza` |

Un pasto ha N voci. Quantità e unità sono opzionali: meglio un pasto annotato senza quantità che un pasto non annotato.

### Tabella `quick_logs` (diario rapido)

| Campo | Tipo | Note |
|---|---|---|
| `id` | PK | |
| `user_id` | FK | |
| `logged_at` | timestamp | momento dell'inserimento |
| `text` | text | testo libero grezzo, non parsato |
| `meal_id` | FK → meals, nullable | agganciato automaticamente all'ultimo pasto (vedi feature 7) |
| `derived_category` | enum, nullable | `allenamento` \| `sonno` \| `sensazione` — calcolato automaticamente (vedi feature 8) |
| `derived_valence` | enum, nullable | `positiva` \| `negativa` \| `neutra` — calcolato automaticamente (vedi feature 8) |

**Principio fondamentale:** il testo NON viene strutturato *dall'utente*. I campi `derived_*` sono calcolati dall'app dopo il salvataggio tramite dizionari di parole chiave (feature 8), sono ricalcolabili in qualsiasi momento e correggibili a posteriori: il testo grezzo resta l'unica fonte di verità. L'analisi semantica profonda resta comunque a valle, quando il CSV viene analizzato da un LLM esterno.

## Funzionalità v1

### 1. Inserimento pasto

Form rapido con: data (default oggi), tipo pasto (default intelligente in base all'ora: prima delle 11 → colazione, 11–15 → pranzo, dopo le 18 → cena, altrimenti spuntino), lista di voci con alimento + quantità + unità, note opzionali.

- Aggiunta voce dopo voce senza ricaricare, con possibilità di rimuovere una riga.
- Il campo alimento è il fulcro: vedi autocomplete sotto.
- Il salvataggio deve essere possibile anche con la sola descrizione dell'alimento (quantità vuote).

### 2. Autocomplete dallo storico

Il campo `food_name` suggerisce mentre si digita, pescando **dallo storico dei `meal_items` dell'utente stesso**, ordinato per frequenza d'uso e recency. Match case-insensitive e parziale (digitando "pom" propone "pasta al pomodoro"). Se una voce viene selezionata dal suggerimento, precompilare anche quantità e unità usate l'ultima volta per quell'alimento.

Nessun database alimenti esterno: il vocabolario si costruisce da solo con l'uso.

### 3. Ripeti pasto

Due scorciatoie, entrambe a un tap:

- **"Ripeti ieri"**: copia tutte le voci del pasto dello stesso tipo del giorno precedente nel form corrente (modificabili prima del salvataggio).
- **"Pasti frequenti"**: lista dei 5–10 pasti più ricorrenti (raggruppati per insieme identico di voci), selezionabili come base precompilata.

Questa è la feature che abbatte più attrito: la dieta reale è ripetitiva.

### 4. Foto allegata (opzionale)

Possibilità di allegare una foto al pasto tramite `<input type="file" accept="image/*" capture="environment">`, che su mobile apre direttamente la fotocamera. La foto viene **solo salvata** come allegato — nessuna analisi, nessun riconoscimento. Usare lo storage già disponibile nell'infrastruttura esistente; se non c'è uno storage file, valutare il salvataggio ridimensionato (max ~1280px lato lungo, compressione JPEG) per contenere lo spazio.

### 5. Vista diario

Vista principale del modulo: elenco cronologico per giorno, con i pasti raggruppati per tipo. Ogni pasto mostra le voci, l'eventuale miniatura foto e le note. Azioni: modifica, elimina, duplica. Navigazione per giorno/settimana.

### 6. Export CSV

Bottone di export che genera un CSV **una riga per `meal_item`**, formato pensato per essere dato in pasto a un LLM per l'analisi:

```csv
date,meal_type,food_name,quantity,unit,notes
2026-07-16,pranzo,pasta al pomodoro,90,g,
2026-07-16,pranzo,parmigiano,10,g,
2026-07-16,pranzo,insalata mista,1,porzione,con olio evo
```

- Separatore virgola, encoding UTF-8, header incluso.
- Filtro per intervallo di date (default: tutto lo storico).
- Le note del pasto vanno ripetute su ogni riga del pasto (o solo sulla prima, purché coerente e documentato).

L'export deve includere anche i quick log, intercalati in ordine cronologico, distinguibili tramite una colonna `record_type`:

```csv
record_type,datetime,meal_type,food_name,quantity,unit,text,linked_meal
meal_item,2026-07-16 13:10,pranzo,pasta al pomodoro,90,g,,
meal_item,2026-07-16 13:10,pranzo,insalata mista,1,porzione,,
quick_log,2026-07-16 14:40,,,,,"sonnolento e fiacco",2026-07-16 pranzo
quick_log,2026-07-16 19:20,,,,,"corsa 40 min gambe pesanti testa ok",
quick_log,2026-07-16 23:05,,,,,"a letto presto stanco morto",
```

La colonna `linked_meal` (data + tipo del pasto agganciato) permette al modello a valle di correlare sensazioni e pasti senza ambiguità.

### 7. Quick log (diario rapido)

Un unico campo di testo libero, raggiungibile con un tap da qualsiasi punto del modulo (bottone flottante o entry fissa accanto a "+ pasto"). L'utente scrive in modo grezzo — sensazioni post-pasto, allenamento fatto e come è andato, qualità del sonno, qualsiasi cosa — e invia. Nessun form, nessun menu a tendina, nessuna categoria da scegliere, nessun campo oltre al testo.

Esempi d'uso reali:

- "fiacco e sonnolento"
- "corsa 40 min, gambe pesanti ma testa lucida"
- "dormito male, a letto a mezzanotte e mezza, sveglio alle 3"
- "allenamento pesi ok, tanta forza"

Comportamento al salvataggio:

- L'app registra il timestamp corrente (modificabile solo se l'utente lo richiede esplicitamente, non proposto nel flusso).
- **Aggancio automatico all'ultimo pasto:** se esiste un pasto dell'utente nelle 4 ore precedenti, `meal_id` viene valorizzato con quel pasto. Altrimenti resta null. L'aggancio è silenzioso: l'utente non deve confermare nulla.
- Feedback immediato (toast/snackbar) e campo svuotato, pronto per un eventuale altro inserimento.

Il campo deve funzionare bene con la dettatura vocale nativa della tastiera mobile (è il metodo di inserimento atteso più frequente): niente autocorrezioni aggressive, niente validazioni sul contenuto, accetta qualsiasi testo non vuoto.

I quick log compaiono nella vista diario, intercalati cronologicamente tra i pasti del giorno, visivamente distinti (es. stile "nota"). Azioni: modifica testo, elimina.

### 8. Classificazione derivata dei quick log (keyword-based, no LLM)

Al salvataggio di un quick log (e al ricalcolo su modifica del testo), l'app valorizza `derived_category` e `derived_valence` tramite matching case-insensitive su dizionari di parole chiave in italiano, definiti in un file di configurazione facilmente estendibile:

- **Categoria** — `allenamento`: corsa, corso, pesi, palestra, allenamento, allenato, bici, nuoto, km, workout, esercizi... — `sonno`: dormito, sonno, letto, notte, sveglio, svegliato, insonnia, riposato... — `integratore`: integratore, iniziato, smesso, magnesio, creatina, omega, vitamina, proteine, mg, compressa... — default: `sensazione`.
- **Valenza** — `positiva`: bene, ok, lucido, forza, energia, carico, riposato, leggero... — `negativa`: fiacco, stanco, male, ko, pesante, sonnolento, gonfio, spossato, nervoso... — se match in entrambe o in nessuna: `neutra`.

Regole:

- La classificazione è invisibile in fase di inserimento: nessuna conferma richiesta, nessun rallentamento del flusso.
- Dalla vista diario l'utente può correggere categoria/valenza di un log con un tap (chip), se l'euristica ha sbagliato. La correzione manuale prevale sul ricalcolo automatico.
- I dizionari sono dati di configurazione, non hardcoded sparsi nel codice: devono essere estendibili in un unico punto.
- Nessuna pretesa di NLP: è un'euristica dichiaratamente semplice, sufficiente per i grafici di andamento. L'analisi fine resta all'LLM esterno sul testo grezzo.

### 9. Dashboard di andamento e correlazioni

Sezione di analisi in-app basata sui dati strutturati (pasti) e sui campi derivati dei quick log. Libreria grafici: Chart.js o Recharts, coerente con eventuali librerie già presenti nel progetto.

**Obiettivo di prodotto:** rendere visibile la relazione input → output dello stile di vita. Input: alimentazione, sonno, allenamento, integratori. Output: come sta l'utente (benessere, umore, energia). L'utente deve poter vedere pattern del tipo "quando mangio così / dormo così / mi alleno così / prendo questo integratore, sto così".

**Concetto centrale — "stato del giorno":** un punteggio sintetico giornaliero calcolato aggregando le valenze dei quick log del giorno (media semplice delle valenze: positiva = +1, neutra = 0, negativa = −1; il sonno annotato la sera o la mattina va attribuito alla giornata su cui influisce). Giorni senza quick log = stato non disponibile (non zero). La formula deve stare in un unico punto del codice, facilmente modificabile.

**Concetto — "periodi integratore":** i quick log con categoria `integratore` definiscono periodi: un log che contiene il nome di un integratore apre un periodo, un log successivo con lo stesso nome e parole di chiusura (smesso, finito, stop) lo chiude; in assenza di chiusura il periodo è considerato in corso. I periodi sono visualizzati come bande e utilizzabili come condizioni nei confronti.

Viste, in ordine di priorità di implementazione:

1. **Calendario mensile a semaforo.** Griglia del mese; per ogni giorno indicatori compatti: alimentazione registrata (sì/no), allenamento (presente + valenza), sonno (valenza), stato del giorno (colore). Obiettivo: costanza e andamento a colpo d'occhio.
2. **Linea dello stato nel tempo con eventi sovrapposti.** La vista principale di correlazione: linea dello stato del giorno su 30/90 giorni, con sopra marcatori per allenamenti, cene dopo le 21:00, e bande orizzontali per i periodi integratore. I pattern devono emergere visivamente senza calcoli.
3. **Confronto condizionato.** L'utente sceglie una condizione e l'app confronta lo stato medio (e le valenze medie di sonno/sensazioni) tra i giorni che la soddisfano e quelli che non la soddisfano. Condizioni minime da supportare: allenamento sì/no; cena prima/dopo le 21:00; presenza di un dato alimento nel giorno; dentro/fuori un periodo integratore. Output: barre affiancate con la numerosità di ciascun gruppo sempre visibile (es. "14 giorni vs 22 giorni").
4. **Alimenti associati alle sensazioni post-pasto.** Per i quick log di categoria `sensazione` agganciati a un pasto: due classifiche degli alimenti più ricorrenti nei pasti che precedono valenze negative e positive. Mostrare il conteggio delle occorrenze, non percentuali (con pochi dati le percentuali ingannano).
5. **Andamento settimanale/mensile.** Numero pasti registrati per giorno; orario medio di pranzo e cena; frequenza allenamenti; rapporto valenze positive/negative per sonno e sensazioni.
6. **Top alimenti.** Classifica per frequenza (da `meal_items.food_name`, matching esatto case-insensitive) negli ultimi 30/90 giorni.
7. **Confronto tra periodi.** Selezione di due intervalli di date arbitrari; tutte le metriche principali affiancate (stato medio, valenze sonno, frequenza allenamenti, top alimenti).

**Onestà statistica (requisito, non opzione):**

- Ogni confronto mostra sempre la numerosità dei gruppi.
- Sotto una soglia minima di dati (es. gruppi con meno di 7 giorni) il confronto è mostrato con un avviso esplicito di scarsa affidabilità.
- Linguaggio delle etichette: "associato a", "nei giorni con", mai "causa" o "effetto". La dashboard mostra correlazioni; l'analisi approfondita multi-variabile resta all'LLM esterno sul CSV.

Note:

- La dashboard legge i dati, non li modifica. Se i dizionari della feature 8 vengono aggiornati, prevedere un'azione di ricalcolo dei campi derivati sullo storico.
- Con pochi dati (prime settimane) le viste devono degradare con grazia: messaggi tipo "servono almeno N giorni di dati" invece di grafici vuoti o fuorvianti.

## UX / Note di design

- Mobile-first: l'inserimento avverrà quasi sempre da telefono.
- Il percorso critico (apri → inserisci → salva) deve essere il più corto possibile: valutare una entry-point diretta "+ pasto" visibile ovunque nel modulo.
- Feedback immediato al salvataggio, senza redirect pesanti.
- Coerenza visiva con il resto dell'app.

## Fuori scope (esplicitamente)

- Calcolo di calorie, macro o valori nutrizionali.
- Chiamate ad API LLM o servizi esterni di food recognition.
- Database alimenti precaricati.
- Obiettivi, target, gamification.
- Strutturazione dell'input da parte dell'utente (niente form, tag o categorie da scegliere in fase di inserimento dei quick log). La classificazione esiste solo come campo derivato automatico (feature 8).
- NLP avanzato, sentiment analysis con modelli ML, estrazione di entità: la classificazione derivata è e deve restare un semplice matching su dizionari.

## Estensioni future (non implementare ora, ma non precludere)

- Parsing in linguaggio naturale e riconoscimento foto tramite proxy backend verso un'API LLM: le voci risultanti finirebbero nella stessa tabella `meal_items`, quindi il modello dati attuale è già compatibile. Non serve alcuna predisposizione oltre a mantenere pulita la separazione form → servizio di salvataggio.
- Bottone "analizza" che invia il CSV a un LLM con prompt fisso.

## Criteri di accettazione

1. Inserire un pasto di 3 voci già presenti nello storico richiede meno di 15 secondi da mobile.
2. "Ripeti ieri" precompila correttamente il form e le voci sono modificabili prima del salvataggio.
3. L'export CSV si apre correttamente in Excel e contiene una riga per voce con l'header specificato.
4. Un pasto può essere salvato con la sola descrizione testuale delle voci, senza quantità.
5. Il modulo non introduce alcuna dipendenza da servizi esterni.
6. Inserire un quick log richiede meno di 5 secondi da mobile: un tap per aprire, testo (digitato o dettato), invio. Nessun altro campo o scelta richiesta.
7. Un quick log inserito entro 4 ore da un pasto risulta agganciato a quel pasto nell'export CSV (colonna `linked_meal` valorizzata).
8. L'export CSV contiene pasti e quick log intercalati cronologicamente, distinti da `record_type`.
9. Scrivendo "corsa 40 min gambe pesanti" il log risulta classificato `allenamento` / `negativa` senza alcuna azione dell'utente; la classificazione è correggibile dal diario con un tap.
10. Il calendario mensile mostra correttamente i giorni con/senza registrazioni e le valenze di sonno e allenamento.
11. Con meno di 7 giorni di dati la dashboard mostra messaggi informativi, non grafici vuoti.
12. La linea dello stato del giorno mostra correttamente i marcatori allenamento e le bande dei periodi integratore.
13. Il confronto condizionato "allenamento sì/no" produce due valori medi con le rispettive numerosità sempre visibili.
14. Un quick log "iniziato magnesio" seguito giorni dopo da "smesso magnesio" produce un periodo integratore visibile sulla linea dello stato e selezionabile come condizione di confronto.
