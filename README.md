# Budget Tracker 65/25/10

App per la gestione delle finanze personali con regola budget 65/25/10 (Necessità/Svago/Risparmi).

![Budget Tracker](https://via.placeholder.com/800x400/0f172a/ffffff?text=Budget+Tracker+65/25/10)

## Caratteristiche

- **Dashboard interattiva** con overview mensile (target/actual/remaining)
- **Quick Add** per inserimento spese rapido (ottimizzato per mobile)
- **Regola budget dinamica** - modifica le percentuali in qualsiasi momento
- **Riallocazione fine mese** - trasferisci l'avanzo NEEDS nei risparmi
- **Storico mensile** - naviga tra i mesi passati
- **Grafici** - visualizzazione donut della distribuzione spese
- **Responsive** - mobile-first design

## Stack Tecnologico

### Frontend
- **React 18** + TypeScript
- **Vite** - build tool
- **TanStack Query** - gestione stato server
- **React Router v6** - routing
- **Tailwind CSS** - styling
- **Recharts** - grafici
- **date-fns** - date handling

### Backend
- **Node.js** + TypeScript
- **Fastify** - web framework
- **Prisma** - ORM
- **Zod** - validazione
- **Swagger/OpenAPI** - documentazione API

### Database
- **PostgreSQL 16**

### Infrastruttura
- **pnpm** - package manager (monorepo)
- **Docker Compose** - database + pgAdmin

## Quick Start

### Prerequisiti
- Node.js >= 18
- pnpm >= 8 (`npm install -g pnpm`)
- Docker + Docker Compose

### 1. Clona e installa dipendenze

```bash
cd project2026
pnpm install
```

### 2. Avvia il database

```bash
docker compose up -d
```

Questo avvia:
- PostgreSQL su `localhost:5432`
- pgAdmin su `localhost:5050` (email: `admin@budget.local`, password: `admin123`)

### 3. Setup database

```bash
# Genera client Prisma
pnpm db:generate

# Esegui migrazioni
pnpm db:migrate

# Popola con dati demo
pnpm db:seed
```

### 4. Avvia l'app in development

```bash
# Avvia backend e frontend insieme
pnpm dev

# Oppure separatamente:
pnpm dev:backend  # Backend su http://localhost:3001
pnpm dev:frontend # Frontend su http://localhost:5173
```

### 5. Apri nel browser

- **Frontend:** http://localhost:5173
- **API Docs:** http://localhost:3001/docs
- **pgAdmin:** http://localhost:5050

## Comandi Disponibili

```bash
# Development
pnpm dev              # Avvia tutto
pnpm dev:frontend     # Solo frontend
pnpm dev:backend      # Solo backend

# Database
pnpm db:generate      # Genera Prisma client
pnpm db:migrate       # Esegui migrazioni
pnpm db:seed          # Popola dati demo
pnpm db:studio        # Apri Prisma Studio (GUI)

# Build
pnpm build            # Build di tutto
pnpm build:frontend   # Solo frontend
pnpm build:backend    # Solo backend

# Test
pnpm test             # Esegui tutti i test
```

## Struttura Progetto

```
project2026/
├── apps/
│   ├── frontend/          # React app
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── pages/
│   │   └── ...
│   └── backend/           # Fastify API
│       ├── src/
│       │   ├── lib/
│       │   ├── routes/
│       │   └── services/
│       └── prisma/
│           ├── schema.prisma
│           └── seed.ts
├── packages/
│   └── shared/            # Tipi e schemi condivisi
├── docker-compose.yml
└── package.json
```

## API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/dashboard/current` | Dashboard mese corrente |
| GET | `/api/dashboard/:periodKey` | Dashboard mese specifico |
| GET | `/api/periods` | Lista tutti i periodi |
| GET | `/api/periods/current` | Periodo corrente |
| POST | `/api/periods` | Crea nuovo periodo |
| GET | `/api/budget-rules/:periodKey` | Regola budget |
| PUT | `/api/budget-rules/:periodKey` | Aggiorna regola |
| GET | `/api/incomes/period/:periodKey` | Entrate del mese |
| POST | `/api/incomes/period/:periodKey` | Nuova entrata |
| DELETE | `/api/incomes/:id` | Elimina entrata |
| GET | `/api/expenses/period/:periodKey` | Spese del mese |
| POST | `/api/expenses/period/:periodKey` | Nuova spesa |
| PUT | `/api/expenses/:id` | Modifica spesa |
| DELETE | `/api/expenses/:id` | Elimina spesa |
| GET | `/api/reallocations/period/:periodKey/preview` | Preview riallocazione |
| POST | `/api/reallocations/period/:periodKey` | Esegui riallocazione |

📚 Documentazione API completa: http://localhost:3001/docs

## Documentazione Strategica

- SaaS readiness playbook: `docs/saas-readiness-playbook-2026-03-20.md`
- SaaS one pager (investor-ready): `docs/saas-onepager-2026-03-20.md`

## Deployment

### Opzione 1: Vercel (Frontend) + Railway/Render (Backend)

**Frontend su Vercel:**
1. Connetti il repo a Vercel
2. Imposta root directory: `apps/frontend`
3. Build command: `pnpm build`
4. Output directory: `dist`
5. Aggiungi variabile: `VITE_API_URL=https://your-backend-url.com`

**Backend su Railway/Render:**
1. Deploy il backend come Node.js app
2. Imposta variabili ambiente:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `PORT=3001`
   - `NODE_ENV=production`
3. Build command: `pnpm --filter @budget/backend build && pnpm --filter @budget/backend prisma:generate`
4. Start command: `pnpm --filter @budget/backend start`

### Opzione 2: Docker (Self-hosted)

```dockerfile
# Dockerfile per backend (da creare)
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build:backend
RUN pnpm db:generate
CMD ["pnpm", "--filter", "@budget/backend", "start"]
```

## Roadmap

- [ ] Import dati da Excel
- [ ] Multi-user con autenticazione
- [ ] Categorie personalizzabili
- [ ] Spese ricorrenti
- [ ] Budget goal tracking
- [ ] Export report PDF/Excel
- [ ] PWA con supporto offline
- [ ] Notifiche push (warning thresholds)
- [ ] Dark mode

## Scelte Architetturali

### Perché Fastify?
- 2x più veloce di Express
- TypeScript-first
- Supporto OpenAPI/Swagger nativo
- Plugin ecosystem maturo

### Perché Prisma?
- Type-safety end-to-end
- Migrazioni automatiche
- Studio GUI per debugging
- Ottima DX

### Perché TanStack Query?
- Cache automatica
- Refetch intelligente
- Optimistic updates
- Gestione loading/error states

### Perché Tailwind?
- Utility-first = velocità di sviluppo
- Mobile-first responsive design
- Bundle size ridotto (purge CSS)
- Ottimo per prototipazione

## License

MIT
