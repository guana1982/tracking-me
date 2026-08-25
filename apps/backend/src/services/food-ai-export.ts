import { strToU8, zipSync } from 'fflate';

const FIELD_DICTIONARY_HEADER = 'field,type,applies_to,description,allowed_values';

const FIELD_DICTIONARY_ROWS = [
  ['record_type', 'string', 'all', 'Tipo della registrazione; determina il significato delle altre colonne', 'meal_item;day_note;quick_log;mood_log;intake;checkin;rating;event;side_effect;habit;activity;weight;treatment;dose_change;milestone;attachment;day_summary'],
  ['date', 'date', 'all', 'Data locale della registrazione in formato ISO 8601', 'YYYY-MM-DD'],
  ['time', 'time', 'all', 'Ora locale; 00:00 indica spesso un dato riferito al giorno e non un orario effettivo', 'HH:mm'],
  ['category', 'string', 'quick_log;mood_log;intake;checkin;rating;event;side_effect;habit;activity;weight;treatment;dose_change;milestone;attachment', 'Categoria del commento oppure nome di terapia scala evento effetto collaterale abitudine tipologia di attivita misurazione tipo di scadenza o tipo della data a cui e allegato un referto; interpretare sempre tramite record_type; su day_note e sempre vuoto', ''],
  ['valence', 'string', 'quick_log;mood_log;checkin;event;activity;treatment;milestone', 'Valenza del commento; direzione della scala; innesco dell evento; priorita dell attivita; stato della terapia o della scadenza a seconda di record_type; su day_note e sempre vuoto', ''],
  ['meal_type', 'string', 'meal_item;intake;treatment', 'Tipo di pasto oppure momento pianificato dell assunzione', 'Valore personalizzabile dall utente'],
  ['food_name', 'string', 'meal_item;treatment', 'Nome dell alimento; per treatment contiene invece il tipo di trattamento', ''],
  ['quantity', 'decimal_or_text', 'meal_item;weight;habit;treatment;attachment', 'Quantita registrata; per treatment puo contenere una dose testuale; per habit e quanto e stato fatto quando l abitudine e misurata; per attachment e la dimensione del file', ''],
  ['unit', 'string', 'meal_item;weight;habit;treatment;attachment', 'Unita della quantita', 'Valore personalizzabile per gli alimenti e per le abitudini; kB per attachment'],
  ['text', 'string', 'all', 'Testo libero o descrittivo: nota pasto commento dose descrizione scala o dettagli; per day_note contiene il commento integrale scritto dall utente sulla giornata', ''],
  ['linked_meal', 'string', 'day_note;quick_log;mood_log', 'Pasto associato al commento nel formato data e tipo pasto; indica solo vicinanza temporale', 'YYYY-MM-DD tipo_pasto'],
  ['body_state', 'decimal', 'day_summary', 'Media giornaliera delle valenze fisiche in intervallo da -1 a +1; vuoto significa non rilevato', '-1..1'],
  ['mood_state', 'decimal', 'day_summary', 'Media giornaliera delle valenze dell umore in intervallo da -1 a +1; vuoto significa non rilevato', '-1..1'],
  ['scale_value', 'integer', 'checkin;rating;event;side_effect', 'Valore numerico registrato sulla scala', '0..scale_max'],
  ['scale_max', 'integer', 'checkin;rating;event;side_effect', 'Valore massimo della scala usata', 'Intero positivo'],
  ['intake_status', 'string', 'intake;dose_change;habit;activity', 'Esito dell assunzione; stato di applicazione del cambio dose; esito dell abitudine; stato dell attivita', 'preso;non preso;preso in ritardo;applicata;programmata;fatto;non fatto;da fare;in corso;completata'],
];

const RECORD_TYPE_HEADER = 'record_type,meaning,important_rules';

const RECORD_TYPE_ROWS = [
  ['meal_item', 'Singolo alimento appartenente a un pasto', 'Le righe con stessa data ora e meal_type possono appartenere allo stesso pasto; text e la nota comune del pasto'],
  ['day_note', 'Commento libero scritto dall utente sulla propria giornata', 'E la testimonianza diretta dell utente e va usata come chiave di lettura degli altri record dello stesso giorno; non ha categoria ne valenza e non entra in nessun punteggio calcolato; possono essercene piu di uno nello stesso giorno e vanno letti tutti insieme'],
  ['quick_log', 'Commento rapido relativo al corpo o alle abitudini', 'category e valence possono essere vuoti; linked_meal indica un associazione temporale non una causalita'],
  ['mood_log', 'Commento rapido appartenente alla dimensione psicologica', 'Tenere distinto dal tracciato fisico; linked_meal indica un associazione temporale non una causalita'],
  ['intake', 'Registrazione di una assunzione prevista', 'E la prova operativa dello stato preso o non preso; non confondere con treatment'],
  ['checkin', 'Risposta a una scala del check-in', 'Se category e nota la riga contiene solo la nota generale; altrimenti se valence e negativo valori bassi sono migliori e se positivo valori alti sono migliori'],
  ['rating', 'Valutazione libera registrata nel diario', 'Valori alti sono migliori; possono esistere piu valutazioni della stessa caratteristica nello stesso giorno'],
  ['event', 'Episodio registrato nel momento in cui e avvenuto', 'category e il tipo; valence contiene l innesco; scale_value e l intensita quando presente'],
  ['side_effect', 'Effetto collaterale della terapia registrato quando si manifesta', 'category e il nome; scale_value e l intensita su scale_max; l assenza non viene mai registrata quindi una riga significa che e accaduto'],
  ['habit', 'Abitudine risposta per la giornata', 'category e il nome; intake_status dice fatto o non fatto; quantity e unit indicano quanto quando l abitudine e misurata'],
  ['activity', 'Attivita pianificata o scadenza riferita a quel giorno', 'category e la tipologia; valence e la priorita; meal_type distingue giornata settimana e scadenza; intake_status e lo stato; una riga non completata con data passata indica qualcosa di slittato'],
  ['weight', 'Misurazione del peso riferita alla giornata', 'quantity e espresso in kg; 00:00 non rappresenta necessariamente l ora della pesata'],
  ['treatment', 'Definizione della terapia pianificata', 'Descrive lo stato ma non dimostra una assunzione; date e la data iniziale o il primo giorno dell intervallo se la terapia era gia iniziata'],
  ['dose_change', 'Cambio di dose pianificato o applicato', 'Leggere la nuova dose in text e lo stato in intake_status'],
  ['milestone', 'Esame appuntamento o altra scadenza', 'valence indica fatto o da fare; text contiene titolo valori condizioni e note'],
  ['attachment', 'Referto o documento allegato a una data dello scadenziario', 'text contiene il percorso del file dentro questo archivio seguito dal titolo della data a cui appartiene; aprire il file e leggerne i valori mettendoli in relazione con i record dello stesso periodo; compaiono solo i file che l utente ha scelto di includere in questo export'],
  ['day_summary', 'Riepilogo calcolato del giorno', 'body_state e mood_state sono indipendenti; valori vuoti non sono zero; text riporta il numero di pasti'],
];

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildDictionary(header: string, rows: string[][]): string {
  return '\uFEFF' + [header, ...rows.map((row) => row.map(csvCell).join(','))].join('\n') + '\n';
}

function formatUtcOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function buildReadme(
  from: string | undefined,
  to: string | undefined,
  tzOffset: number,
  attachments: FoodAiAttachment[]
): string {
  const range =
    from || to
      ? `${from ?? 'inizio storico'} - ${to ?? 'fine storico'}`
      : 'intero storico disponibile';

  const reports =
    attachments.length === 0
      ? ''
      : `- \`referti/\`: ${attachments.length} ${
          attachments.length === 1 ? 'referto allegato' : 'referti allegati'
        } alle date dello scadenziario. Ogni file e nominato con la data a cui appartiene ed e citato da una riga \`attachment\` del CSV, che ne riporta il percorso esatto.
`;

  return `# Export Diario per analisi AI

## Contenuto

- \`diario-alimentare.csv\`: dati cronologici, una riga per registrazione.
- \`dizionario-campi.csv\`: significato, tipo e dominio delle colonne.
- \`tipi-record.csv\`: semantica di ogni valore di \`record_type\`.
- \`prompt-analisi.txt\`: prompt di partenza da fornire al modello insieme agli altri file.
${reports}
Estrai lo ZIP e allega tutti i file alla conversazione con il modello${
    attachments.length === 0 ? '' : ', referti compresi'
  }. Se il servizio usato
supporta direttamente gli archivi ZIP, chiedigli comunque di leggere prima \`LEGGIMI.md\`,
\`dizionario-campi.csv\` e \`tipi-record.csv\`.

## Contesto dell'esportazione

- Intervallo richiesto: ${range}
- Fuso orario usato per date e orari: ${formatUtcOffset(tzOffset)}
- Codifica: UTF-8 con BOM
- Separatore CSV: virgola
- Date: \`YYYY-MM-DD\`
- Orari: \`HH:mm\`
- Decimali: punto

## Regole di interpretazione

1. Leggere sempre \`record_type\` prima delle altre colonne: alcune colonne sono polimorfiche e cambiano significato tra tipi di record.
2. Una cella vuota significa dato non registrato o non applicabile, mai zero.
3. \`day_note\` e il commento libero scritto dall'utente sulla giornata: leggerlo prima degli altri record dello stesso giorno e usarlo come chiave di interpretazione. Non e classificato, non ha valenza e non entra in nessun punteggio calcolato; possono essercene piu di uno nello stesso giorno.
4. \`attachment\` indica un referto allegato a una data: il percorso in \`text\` punta a un file dentro questo archivio. Aprirlo, leggerne i valori e metterli in relazione con i giorni vicini. Sono presenti solo i referti che l'utente ha scelto di includere: l'assenza di un file non significa che l'esame non sia stato fatto.
5. \`treatment\` descrive una terapia pianificata; solo \`intake\` descrive lo stato di una specifica assunzione.
6. \`linked_meal\` e la vicinanza temporale mostrano un collegamento, non dimostrano un rapporto causale.
7. \`day_summary\` e calcolato: \`body_state\` e \`mood_state\` sono medie indipendenti tra -1 e +1, e non tengono conto di \`day_note\`.
8. Piu righe \`meal_item\` con la stessa data, ora e tipo di pasto possono appartenere allo stesso pasto.
9. I valori \`rating\` possono essere ripetuti nello stesso giorno e devono restare osservazioni separate.
10. Testi, sensazioni ed eventi sono registrazioni soggettive dell'utente.
11. Non formulare diagnosi, non modificare terapie e non trasformare correlazioni in causalita.
12. Per associazioni quantitative robuste usare almeno 21 osservazioni abbinate; con meno dati presentare solo segnali esplorativi e dichiarare il campione.
`;
}

const ANALYSIS_PROMPT = `Analizza i file allegati del diario personale.

Prima di analizzare i dati:
1. Leggi LEGGIMI.md.
2. Usa dizionario-campi.csv per interpretare le colonne.
3. Usa tipi-record.csv per interpretare ogni record_type.
4. Non dedurre il significato di una cella ignorando record_type.

Per ogni giorno leggi per prime le righe day_note: sono le parole dell'utente sulla
giornata e sono la chiave con cui interpretare i dati numerici dello stesso giorno.
Non sono classificate e non entrano in nessun punteggio: usale per spiegare, non per
misurare, e citale quando sostengono o contraddicono un dato registrato.

Se l'archivio contiene una cartella referti, apri ogni file citato dalle righe attachment ed
estraine i valori: vanno letti insieme al diario del periodo attorno alla loro data, non come
un documento a se stante.

Obiettivi:
- riassumere alimentazione, terapia, assunzioni, sonno, umore, benessere fisico ed eventi;
- mettere in relazione i commenti liberi dell'utente (day_note) con i dati registrati nello stesso giorno, segnalando conferme e contraddizioni;
- confrontare i valori dei referti allegati con quanto registrato nel diario nei giorni e nelle settimane vicine alla data dell'esame;
- distinguere sempre terapia pianificata, cambio dose e assunzione effettivamente registrata;
- cercare associazioni temporali tra pasti, alimenti, assunzioni, sonno, umore, benessere ed eventi;
- evidenziare dati mancanti, incoerenze e possibili duplicati;
- citare date, orari e dati rilevanti a supporto di ogni osservazione.

Regole:
- una cella vuota e un dato assente o non applicabile, non uno zero;
- non presentare associazioni o correlazioni come rapporti causali;
- indica il numero di osservazioni abbinate usate per ogni associazione;
- considera robuste le associazioni quantitative solo con almeno 21 osservazioni abbinate;
- sotto 21 osservazioni descrivi esclusivamente un segnale esplorativo;
- non assegnare giudizi giornalieri, punteggi morali o serie positive/negative;
- non formulare diagnosi mediche e non suggerire modifiche autonome alla terapia;
- se i dati non bastano, dichiaralo esplicitamente.

Produci:
1. Sintesi del periodo.
2. Andamento separato per alimentazione, corpo, umore, sonno e terapia.
3. Aderenza osservata, distinguendo dosi pianificate e registrazioni intake.
4. Associazioni osservate con numerosita del campione e livello di incertezza.
5. Eventi o cambiamenti temporali degni di attenzione.
6. Qualita, copertura e limiti dei dati.
7. Domande utili da approfondire con il medico o un altro professionista.
`;

export interface FoodAiExportMetadata {
  from?: string;
  to?: string;
  tzOffset: number;
}

export interface FoodAiAttachment {
  /** Path inside the archive; the same string the CSV row points at */
  path: string;
  bytes: Uint8Array;
}

/** Builds a self-describing archive while preserving the canonical CSV byte-for-byte. */
export function buildFoodAiPackage(
  csv: string,
  metadata: FoodAiExportMetadata,
  attachments: FoodAiAttachment[] = []
): Uint8Array {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    'diario-alimentare.csv': strToU8(csv),
    'LEGGIMI.md': strToU8(
      buildReadme(metadata.from, metadata.to, metadata.tzOffset, attachments)
    ),
    'dizionario-campi.csv': strToU8(buildDictionary(FIELD_DICTIONARY_HEADER, FIELD_DICTIONARY_ROWS)),
    'tipi-record.csv': strToU8(buildDictionary(RECORD_TYPE_HEADER, RECORD_TYPE_ROWS)),
    'prompt-analisi.txt': strToU8(ANALYSIS_PROMPT),
  };
  for (const attachment of attachments) {
    // Stored, not deflated: a PDF and a JPEG are already compressed, so the
    // pass costs time and gives back nothing
    files[attachment.path] = [attachment.bytes, { level: 0 }];
  }
  return zipSync(files, { level: 6 });
}
