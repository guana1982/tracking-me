# Calendario e attività

Base funzionale introdotta il 15 agosto 2026. Il modulo è indipendente dal budget e dal Diario,
ma usa la stessa autenticazione, lo stesso database user-scoped e gli stessi pattern API/UI.

## Funzionalità disponibili

- attività pianificate per una giornata;
- attività assegnate a una settimana ISO (lunedì-domenica);
- scadenze con data e orario opzionale;
- priorità bassa, media, alta e urgente;
- stati da fare, in corso e completata;
- note libere;
- tipologie personalizzabili e disattivabili, separate tra attività e scadenze;
- set di tipologie suggerite installabile su richiesta;
- riepilogo giornaliero, settimanale e delle scadenze arretrate;
- calendario mensile responsive;
- layout workspace con editor sempre visibile, lista centrale ordinata per priorità e strumenti laterali;
- modifica inline: la matita carica il task direttamente nell’editor, senza modali;
- lista centrale con tutte le attività aperte e filtri per giornaliere, settimanali e scadenze.

## Semantica dei dati

- `Activity.kind`: distingue un task (`TASK`) da una scadenza (`DEADLINE`).
- `Activity.scope`: un task appartiene a un giorno (`DAY`) o a una settimana (`WEEK`).
- `scheduledFor`: per `DAY` è il giorno scelto; per `WEEK` viene normalizzato al lunedì.
- `dueDate` e `dueTime`: limite opzionale per i task; `dueDate` è obbligatoria per le scadenze.
- `completedAt`: viene valorizzato quando lo stato passa a `DONE` e cancellato se il task viene riaperto.
- `ActivityType`: catalogo dell’utente; la cancellazione non elimina le attività collegate.

Tutte le query Prisma filtrano per `userId`. Le date di calendario sono memorizzate come PostgreSQL
`DATE`; l’orario è una stringa locale `HH:mm`, evitando conversioni indesiderate di fuso orario.

## API

- `GET /api/activities/overview?date=YYYY-MM-DD`
- `POST /api/activities`
- `PUT /api/activities/:id`
- `DELETE /api/activities/:id`
- `GET /api/activities/types`
- `POST /api/activities/types/defaults`
- `POST /api/activities/types`
- `PUT /api/activities/types/:key`
- `DELETE /api/activities/types/:key`

## Evoluzioni previste, non ancora implementate

- ricorrenze e generazione delle occorrenze;
- notifiche e promemoria;
- indicatori di carico e attività direttamente nelle celle del calendario;
- drag-and-drop tra giorni e riordinamento manuale;
- backlog e ricerca/filtri;
- ordinamento manuale persistente;
- allegati e collegamenti tra attività;
- esportazione calendario (ICS) e integrazioni esterne;
- collegamenti opzionali con Diario, spese e appuntamenti terapeutici.
