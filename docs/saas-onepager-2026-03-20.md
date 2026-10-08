# SaaS One Pager
Data: 20 marzo 2026
Prodotto: ETF Portfolio Intelligence (working name)

## Problema
Molti investitori ETF retail gestiscono il portafoglio con Excel, app broker o tracker generici che:

- mostrano il "cosa", ma poco il "perche'"
- non confrontano bene strategie alternative
- non danno una vista unica su rischio, rendimento ed esposizioni aggregate

Risultato: decisioni lente, poco strutturate, spesso senza visibilita' sui trade-off.

## Soluzione
Una web app che rende semplice analizzare e confrontare portafogli ETF:

- confronto multi-portafoglio
- curve storiche a pesi statici
- scatter rischio/rendimento
- esposizione geografica e settoriale aggregata
- vista overlay curve per confronto immediato

Focus: insight operativi e leggibili, non solo data dump.

## Per chi
ICP iniziale:

- investitori ETF retail Italia/EU
- portafogli da 20k a 500k
- utenti che cercano analisi periodica (settimanale/mensile)

## Perche' ora
- Crescente interesse retail per ETF e investimento passivo
- Offerta frammentata tra strumenti troppo semplici o troppo complessi
- Domanda di strumenti "decision support" con UX chiara

## Vantaggio prodotto (oggi)
- Motore di confronto gia' funzionante
- UX orientata all'analisi, non solo all'inserimento dati
- Stack full TypeScript con contratti condivisi FE/BE
- Deployabile rapidamente su Railway

## Modello business ipotizzato
Freemium SaaS:

- Free: numero limitato di portafogli e analisi base
- Pro: analisi avanzate, export report, confronto esteso, funzionalita' premium

Possibili pricing test:

- Pro individuale: 9-19 EUR/mese
- Annuale scontato: 89-149 EUR/anno

## Go-to-market iniziale
Strategia low-cost, rapida:

- beta chiusa con 20-30 utenti target
- landing page + demo mode + waitlist
- feedback loop settimanale con utenti attivi
- newsletter tecnica/prodotto per retention early-stage

## KPI di validazione (8-12 settimane)
- Activation:
  - signup -> primo portafoglio valido >= 30%
- Engagement:
  - ritorno entro 7 giorni >= 20%
- Monetization proxy:
  - interesse Pro (click/lead) >= 10%

Se i KPI sono sotto soglia dopo iterazioni UX, pivot su proposta valore o target.

## Rischi principali
- Dipendenza da dati esterni (qualita', stabilita', latenza)
- Differenziazione insufficiente rispetto a tracker esistenti
- Retention bassa senza routine d'uso chiara

Mitigazioni:

- cache e fallback dati
- onboarding guidato + portafogli demo
- roadmap orientata a "momenti decisionali" dell'investitore

## Stato tecnologico (snapshot)
- Frontend: React + Vite + Tailwind + Recharts
- Backend: Fastify + Prisma + PostgreSQL
- Shared contracts: Zod + TypeScript package condiviso
- Infra: Railway-ready

Il codice attuale e' adatto a un test mercato serio senza replatform.

## Prossimi 30 giorni (priorita')
1. Onboarding guidato + demo dataset
2. Event tracking funnel e telemetry base
3. Waitlist/newsletter + feedback in-app
4. Hardening endpoint portfolio (cache/timeout/retry)
5. Definizione piano Free/Pro (fake door test)

---
Decisione attesa:

- Obiettivo non e' "scalare subito", ma validare rapidamente:
  - valore percepito
  - ritorno utenti
  - disponibilita' a pagare
