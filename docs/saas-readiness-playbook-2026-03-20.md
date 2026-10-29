# SaaS Readiness Playbook
Data: 20 marzo 2026
Progetto: `project2026` (Budget Tracker + Portfolio Intelligence)

## 1) Executive Summary
L'app ha potenziale per diventare una micro-SaaS, ma non come "budget app generica".
Il posizionamento con maggiore probabilita' di traction e':

- Portfolio intelligence per investitori ETF retail (Italia/EU)
- Focus su insight azionabili: confronto strategie, esposizioni aggregate, andamento storico, rischio/rendimento

Valutazione sintetica:

- Potenziale prodotto: Buono
- Potenziale tecnico: Buono
- Potenziale commerciale (stato attuale): Medio
- Rischio principale: go-to-market + affidabilita' sorgenti dati esterne

## 2) Cosa e' gia' buono oggi
### 2.1 Prodotto
- Feature ad alto valore percepito:
  - Confronto portafogli
  - Scatter rischio/rendimento
  - Ripartizione geografica e settoriale
  - Curva storica portafoglio statico
  - Modale multi-grafico e overlay curve
- UX gia' orientata all'analisi (non solo CRUD)
- Workflow utente abbastanza chiaro per chi investe in ETF

### 2.2 Tecnologia
- Monorepo ordinato (`apps/frontend`, `apps/backend`, `packages/shared`)
- Stack moderno e coerente:
  - Frontend: React 18 + Vite + Tailwind + React Query
  - Backend: Fastify + Prisma + PostgreSQL
  - Shared contracts: Zod + TypeScript shared package
- API e tipi condivisi: buona base per ridurre regressioni
- Deploy gia' attivabile su Railway

### 2.3 Architettura applicativa
- Separazione chiara FE/BE
- Persistenza DB gia' presente
- Route e servizi portfolio gia' strutturati
- Possibilita' di estensione progressiva senza replatform immediato

## 3) Cosa manca per una SaaS credibile
### 3.1 Posizionamento e packaging
- Mancano piano Free/Pro e value ladder chiara
- Mancano pagine marketing dedicate al caso d'uso principale
- "Perche' pagare" non ancora esplicito in prodotto

### 3.2 Onboarding e activation
- Manca onboarding guidato con "time-to-first-value" < 10 minuti
- Manca import semplificato (CSV broker, import guided)
- Manca set di portafogli demo pre-caricati orientati alla conversione

### 3.3 Data reliability
- Forte dipendenza da provider/scraping esterno
- Mancano policy formalizzate di:
  - cache
  - timeout/retry/circuit breaker
  - fallback data source
  - monitor freshness dati

### 3.4 SaaS foundations
- Mancano:
  - billing/subscription
  - piani e limiti uso
  - audit trail amministrativo
  - dashboard operativa con metriche prodotto
- Probabilmente manca policy chiara su retention/export dati

### 3.5 Compliance e trust
- Per ambito finanza servono:
  - disclaimer robusto (non consulenza finanziaria)
  - privacy + cookie + terms in forma "production-grade"
  - gestione consenso esplicita per newsletter
- Da verificare confine regolatorio (consiglio personalizzato vs analytics)

## 4) Ipotesi di posizionamento consigliata
Proposta:

- "ETF Portfolio Intelligence per investitori retail"

Messaggio:

- "Capisci in pochi minuti rischio, esposizione e confronto storico dei tuoi portafogli ETF"

ICP (ideal customer profile) iniziale:

- Investitore retail con portafoglio ETF da 20k a 500k
- Usa gia' Excel/portfolio tracker base ma vuole insight migliori
- Frequenza d'uso: settimanale o mensile

## 5) Feature set MVP per test mercato (senza overbuilding)
Tenere:

- Portfolio investito + laboratorio strategico
- Confronta + Confronta Rendimenti + Curve Sovrapposte
- Esposizione geo/settoriale
- Performance storica con filtri periodali e range custom

Aggiungere subito (essenziale):

- Onboarding iniziale guidato (2-3 step)
- Portafogli demo con dati reali plausibili
- Export PNG/PDF del report sintetico
- Feedback in-app (micro form)
- Event tracking base

Posticipare (fase 2):

- Ribilanciamento automatico con suggerimenti quantitativi
- Alert avanzati e notifiche
- Integrazioni dirette broker

## 6) Ipotesi economiche e costi operativi
## 6.1 Scenario beta (20-30 utenti totali, uso moderato)
- Railway + DB: tipicamente sostenibile
- AI opzionale (copilot testuale): costo contenuto se modello mini + caching prompt
- Range indicativo complessivo: basso-doppia cifra/mese fino a bassa tripla cifra, in funzione del traffico

Nota: il costo variabile principale non e' il frontend, ma:

- chiamate analitiche frequenti
- eventuale AI usage
- possibili picchi da sorgenti dati esterne

### 6.2 Scenario crescita iniziale (100-300 utenti)
Servono prima:

- caching aggressivo per ISIN/serie
- queue per job pesanti
- rate limiting endpoint costosi
- monitor p95/p99 e error budget

## 7) Roadmap pratica 90 giorni
### Fase 1 (settimane 1-2): Demo market-ready
- Landing page semplice con proposition chiara
- Demo mode e portafogli esempio
- Pulsanti CTA chiari: "Prova demo", "Join waitlist"
- Telemetria base (funnel)

### Fase 2 (settimane 3-6): Validation loop
- Newsletter/waitlist con segmentazione sorgente
- Interviste utenti (10-15)
- Iterazioni UX su onboarding e comprensione insight
- Introduzione "fake door" piano Pro

### Fase 3 (settimane 7-12): Monetization readiness
- Definizione piani Free/Pro
- Implementazione billing
- Hardening compliance (privacy, terms, disclaimer)
- Miglioramento robustezza dati e monitoraggio

## 8) KPI per decidere se il mercato risponde
KPI activation:

- Visit -> signup
- Signup -> primo portafoglio valido
- Primo portafoglio -> primo insight (confronto o overlay)

KPI engagement:

- WAU/MAU
- utenti che tornano entro 7 giorni
- n. analisi completate per utente

KPI monetization proxy:

- click su "upgrade"
- conversione waitlist Pro
- disponibilita' a pagare dichiarata

Soglie minime utili (early signal):

- >= 30% signup crea almeno un portafoglio valido
- >= 20% utenti torna entro 7 giorni
- >= 10% manifesta interesse piano Pro

## 9) Architettura target evolutiva (senza riscrivere tutto)
Stato attuale e' adatto per partire. Evoluzione consigliata:

### 9.1 Breve termine
- Introduzione cache applicativa su endpoint portfolio
- Job asincroni per calcoli pesanti
- Standardizzazione logging strutturato

### 9.2 Medio termine
- Materialized snapshots per performance
- storage risultati pre-calcolati per timeframe comuni
- circuit breaker su provider esterni

### 9.3 Lungo termine
- Multi-tenant governance piu' forte
- separazione dominio "analytics engine" dal resto
- eventuale data provider premium/ibrido

## 10) AI Agent: ruolo e impatto (futuro)
Ruolo consigliato iniziale:

- Portfolio Copilot (explainability)

Cosa fa:

- Spiega differenze tra portafogli
- Interpreta metriche e trade-off
- Risponde a domande contestuali usando dati gia' calcolati

Vincoli:

- no raccomandazioni vincolanti/personal advice
- output con disclaimer chiaro
- grounding su dati reali disponibili nell'app

## 11) Newsletter: utilita' per market test
Si, da introdurre presto.

Benefici:

- valida interesse reale
- crea canale owned prima del pricing
- supporta beta feedback loop

Minimo necessario:

- endpoint subscribe
- double opt-in
- tracciamento source/campaign
- policy GDPR chiara

## 12) Rischi principali e mitigazioni
Rischio 1: Bassa differenziazione rispetto ad altri tracker
- Mitigazione: posizionamento verticale ETF + insight distintivi

Rischio 2: Dati esterni instabili
- Mitigazione: cache + fallback + monitoring + provider strategy

Rischio 3: Bassa retention
- Mitigazione: onboarding, routine mensile, alert valore

Rischio 4: Scope creep tecnico
- Mitigazione: roadmap per milestone e feature gate

## 13) Decision framework (go / no-go)
Dopo 8-12 settimane di test:

Go (continuare a investire) se:
- segnali chiari su activation + retention + interesse Pro

No-go o pivot se:
- utenti non percepiscono valore unico
- retention troppo bassa anche dopo iterazioni UX

## 14) Backlog consigliato (priorita')
P0:
- onboarding guidato
- analytics funnel
- waitlist/newsletter
- hardening dati (cache + timeout + retry)

P1:
- piani Free/Pro + fake door
- report export
- improvement explainability metriche in UI

P2:
- copilot AI contestuale
- integrazioni import broker/CSV evolute

---
Questo documento e' pensato come base operativa per decidere rapidamente:

- se e come lanciare una beta pubblica
- come validare il mercato con budget ridotto
- quando passare da prototipo a SaaS vera
