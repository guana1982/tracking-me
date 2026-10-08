# Modulo: Monitoraggio Terapia Farmacologica

Specifica funzionale. Si integra con i moduli esistenti (diario alimentare, umore, sensazioni fisiche) e ne riusa i dati dove già presenti.

---

## 1. Obiettivo

Tracciare in modo rapido e costante l'andamento di una terapia farmacologica psichiatrica, per rispondere a tre domande:

1. **Sto assumendo la terapia come prescritto?** (aderenza)
2. **Sta funzionando?** (andamento dei sintomi bersaglio nel tempo)
3. **Cosa devo dire al medico al prossimo controllo?** (report sintetico esportabile)

Il modulo non deve diagnosticare né interpretare: raccoglie dati puliti e li restituisce in forma leggibile a chi di dovere.

---

## 2. Principi di design (vincolanti)

- **Check-in serale unico, sotto i 20 secondi.** Una sola schermata, slider grandi, nessuna navigazione tra tab.
- **Un solo inserimento valutativo al giorno.** L'app *non* permette di compilare il check-in più volte nella stessa giornata (modifica sì, nuovo inserimento no).
- **Nessun grafico in home.** I trend sono raggiungibili in una sezione separata, e mostrano dati **aggregati settimanalmente**, mai giornalieri.
- **Nessuna "valutazione" del singolo giorno.** L'app non deve mai dire "oggi meglio di ieri", né mostrare frecce verdi/rosse su base giornaliera.
- **Zero campi obbligatori oltre alle scale core.** Tutto il resto è opzionale ed espandibile.
- **Mobile-first, tutto offline, nessuna API esterna.**

> **Razionale dei vincoli 2, 3 e 4:** in un utente con tratti ossessivi, uno strumento di auto-monitoraggio può facilmente trasformarsi in un rituale di controllo e in materiale per la ruminazione. Il design deve rendere il monitoraggio *utile ma non ispezionabile in continuazione*. La granularità giornaliera serve alla raccolta; quella settimanale serve alla lettura.

---

## 3. Entità funzionali

### 3.1 Farmaco (configurabile dall'utente)

Ogni farmaco in terapia ha:

- Nome commerciale + principio attivo
- Forma (compressa / gocce / altro)
- Dose corrente + unità
- Momento/i di assunzione (mattina / pranzo / sera / prima di dormire)
- Note (es. "dopo colazione", "confezione rossa")
- Data di inizio
- Stato: attivo / sospeso
- **Titolazione programmata** (opzionale): una o più tappe con data e nuova dose, es. *"dal giorno 8 → 1 compressa"*. L'app avvisa il giorno del cambio e aggiorna la dose corrente.

Configurazione attuale da precaricare come esempio:

| Farmaco | Dose | Quando | Titolazione |
|---|---|---|---|
| Sertralina 50 mg | ½ cp | mattina, dopo colazione | → 1 cp dal giorno 8 |
| Depakin Chrono 500 mg | 1 cp | sera, dopo cena | — |
| Serenase 2 mg/ml gocce | 3 gtt | prima di dormire | → 6 gtt dal giorno 8 |

### 3.2 Assunzione (aderenza)

Per ogni farmaco e per ogni slot della giornata: **preso / non preso / preso in ritardo**.
Un tap per riga. Deve essere completabile in 3 secondi dalla home.

### 3.3 Check-in serale (il cuore del modulo)

Scale core, sempre visibili, **5 slider**:

| Dimensione | 0 | 10 |
|---|---|---|
| **Umore basso** | umore normale | crollo totale, giornata nera |
| **Irritabilità** | tollerante, nessuno scatto | intolleranza continua, esplosioni |
| **Tensione / agitazione interna** | calmo | agitazione costante |
| **Ruminazione** | mente libera | rimuginio martellante per ore |
| **Intensità ossessioni (DOC)** | assenti | ossessioni continue e invadenti |

**Convenzione unica e non negoziabile: tutte le scale misurano l'intensità del sintomo. 0 = assente, 10 = massimo. La curva che scende significa sempre miglioramento.** Nessuna scala invertita, per evitare errori di inserimento e grafici ambigui.

Ogni slider mostra sempre l'etichetta testuale del valore selezionato (es. `4 — presente ma gestibile`), non solo il numero.

Campi espandibili (opzionali, chiusi di default):

- **Compulsioni**: contatore rapido (nessuna / poche / molte / continue) — evitare il conteggio numerico esatto, che è esso stesso un rituale
- **Energia**: 0–10 (0 = nessuna energia, 10 = pieno di energia) — *unica scala positiva, etichettata in modo evidente*
- **Nota libera**: una riga, con autocomplete dalle note precedenti

### 3.4 Evento (log rapido, durante la giornata)

Registrazione istantanea di un episodio acuto, in due tap dalla home. Nessun campo obbligatorio oltre al tipo.

Tipi predefiniti (personalizzabili):

- Esplosione / sfogo verbale
- Picco di irritazione
- Picco compulsioni
- Crollo dell'umore
- Episodio di rimuginio

Campi opzionali dell'evento: **innesco** (menu con autocomplete dagli inneschi già usati, es. *pianto della bambina*, *pensiero al risveglio*, *vista del palazzo dal giardino*, *post-allenamento*, *rientro a casa*), intensità 1–10, orario (auto), nota breve.

> L'innesco è il campo più prezioso del modulo: nel tempo produce la classifica degli inneschi reali, che è esattamente il dato utile in visita e in terapia.

### 3.5 Effetto collaterale

Check-list a tap, con intensità (lieve / moderato / forte). Voci predefinite pertinenti ai farmaci in uso:

- Sonnolenza diurna / intontimento al risveglio
- Nausea o disturbi gastrici
- Tremore alle mani
- Aumento dell'appetito
- Sudorazione eccessiva
- Vertigini
- Effetti sulla sfera sessuale
- Altro (testo libero)

Le voci mostrate devono derivare dai farmaci attivi in configurazione, non essere una lista fissa.

### 3.6 Misure periodiche

- **Peso**: inserimento settimanale, promemoria fisso lo stesso giorno/ora. Mai giornaliero.
- **Sonno**: riusa il dato del modulo esistente; non richiederlo di nuovo.
- **Allenamento**: riusa il dato del modulo esistente (serve per la correlazione con il picco DOC post-workout).

### 3.7 Milestone / scadenzario

Elementi con data e stato (da fare / fatto):

- Cambi di dose programmati (dalla titolazione)
- Esami del sangue e strumentali richiesti, con elenco dei valori
- Appuntamenti di controllo
- Promemoria condizionali legati agli esami:
  - *"Niente allenamenti intensi nelle 72 h precedenti"* (falsa positività CPK)
  - *"Sospendere creatina 3–5 giorni prima"* (falsa positività creatinina/CPK)
  - *"Dichiarare al prelievo: integrazione con creatina, allenamento con i pesi"*

---

## 4. Flussi

### 4.1 Home
Mostra solo: le assunzioni di oggi da spuntare, il pulsante **Check-in serale** (attivo dal tardo pomeriggio), il pulsante **Log rapido evento**, e l'eventuale milestone imminente. Nient'altro.

### 4.2 Check-in serale
Una schermata, 5 slider precompilati al valore del giorno precedente (riduce i tap: si sposta solo ciò che è cambiato), sezioni opzionali collassate, un pulsante di salvataggio. Fine.

### 4.3 Log rapido
Pulsante flottante → griglia dei tipi evento → tap → salvato. L'innesco e l'intensità si aggiungono in un secondo momento se si vuole, dalla notifica di conferma.

### 4.4 Andamento (sezione separata, non in home)
- Curve **settimanali** (media dei 7 giorni) delle 5 scale core
- Frequenza settimanale degli eventi, per tipo
- Classifica degli inneschi più frequenti (ultimi 30 giorni)
- Aderenza: % di assunzioni registrate, per farmaco
- Effetti collaterali: quali, con che frequenza, e in quale fase della terapia sono comparsi
- Marcatori verticali sui grafici in corrispondenza dei cambi di dose

**Vincolo di onestà statistica:** nessuna correlazione viene mostrata con meno di 21 osservazioni, e ogni correlazione è accompagnata dalla numerosità del campione e da una nota esplicita che si tratta di associazione, non di causa. Nessun "insight" generato automaticamente in forma assertiva.

### 4.5 Report per il controllo medico
Genera un documento sintetico (max 1 pagina) sul periodo scelto, contenente:

- Terapia in corso, dosi e date dei cambi
- Aderenza in percentuale, con eventuali periodi di interruzione
- Andamento delle 5 scale core: valore medio della prima settimana vs. ultima settimana, e curva
- Numero di eventi per tipo, per settimana
- Inneschi più frequenti
- Effetti collaterali comparsi, intensità, data di comparsa
- Peso: iniziale, attuale, differenza
- Esami effettuati e da effettuare
- Spazio per le domande da porre al medico (elenco compilabile durante il periodo, così non ci si dimentica in visita)

Esportabile come testo/PDF, leggibile da telefono in visita.

---

## 5. Notifiche

Minime e non ansiogene:

- Promemoria assunzione, agli orari configurati
- Promemoria check-in serale, un solo tentativo, orario configurabile
- Avviso il giorno di un cambio di dose
- Avviso 7 giorni prima di un controllo (per preparare le domande) e 4 giorni prima degli esami (per i vincoli su allenamento e creatina)
- Promemoria peso, settimanale

Nessuna notifica motivazionale, nessuna streak, nessun badge, nessun punteggio di "aderenza perfetta". Il fallimento di un giorno non deve produrre alcun segnale negativo.

---

## 6. Fuori scope

- Qualsiasi interpretazione clinica, suggerimento di dosaggio o alert su sintomi
- Confronto con valori "normali" o di riferimento
- Condivisione dati, cloud, account
- Integrazioni con dispositivi o API esterne

---

## 7. Note per l'implementazione

- Tutti i dati restano locali, coerentemente con l'architettura esistente dell'app.
- Il modello dei farmaci deve essere generico: l'utente può aggiungere, sospendere e modificare farmaci senza che nulla sia cablato nel codice.
- Le voci degli effetti collaterali associate a ciascun farmaco vanno tenute in un file di configurazione modificabile, non nel codice applicativo.
- Le scale, le loro etichette e il numero di slider del check-in devono essere configurabili: il set attuale è quello utile oggi, ma cambierà con il cambiare della fase clinica.
