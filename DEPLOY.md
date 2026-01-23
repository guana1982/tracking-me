# Deploy su Railway

Questa guida spiega come deployare Budget Tracker su Railway.

## Prerequisiti

1. Account su [Railway](https://railway.app)
2. Repository Git (GitHub, GitLab, o Bitbucket)


## Architettura

L'applicazione è composta da 3 servizi:
- **Backend** (Fastify API)
- **Frontend** (React SPA)
- **Database** (PostgreSQL)

## Setup su Railway

### 1. Crea un nuovo progetto

1. Vai su [Railway Dashboard](https://railway.app/dashboard)
2. Clicca su "New Project"
3. Seleziona "Deploy from GitHub repo"
4. Collega il tuo repository

### 2. Aggiungi il Database PostgreSQL

1. Nel progetto, clicca su "New"
2. Seleziona "Database" → "Add PostgreSQL"
3. Railway creerà automaticamente la variabile `DATABASE_URL`

### 3. Configura il Backend

1. Clicca su "New" → "GitHub Repo"
2. Seleziona lo stesso repository
3. Nelle impostazioni del servizio:
   - **Root Directory**: `apps/backend`
   - **Build Command**: `cd ../.. && pnpm install && pnpm --filter @budget/shared build && pnpm --filter @budget/backend build && pnpm --filter @budget/backend prisma:generate`
   - **Start Command**: `pnpm prisma:migrate:prod && pnpm start`

4. Aggiungi le variabili d'ambiente:
   - `DATABASE_URL` → Clicca su "Add Reference" e seleziona la variabile dal servizio PostgreSQL
   - `NODE_ENV` → `production`

5. Genera un dominio pubblico:
   - Vai su "Settings" → "Networking" → "Generate Domain"
   - Copia l'URL (es: `your-backend.up.railway.app`)

### 4. Configura il Frontend

1. Clicca su "New" → "GitHub Repo"
2. Seleziona lo stesso repository
3. Nelle impostazioni del servizio:
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `cd ../.. && pnpm install && pnpm --filter @budget/shared build && pnpm --filter @budget/frontend build`
   - **Start Command**: `npx serve -s dist -l $PORT`

4. Aggiungi le variabili d'ambiente:
   - `VITE_API_URL` → `https://your-backend.up.railway.app/api` (usa l'URL del backend)
   - `NODE_ENV` → `production`

5. Genera un dominio pubblico per il frontend

## Variabili d'ambiente

### Backend
| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | Fornita da Railway |
| `PORT` | Porta del server | Fornita automaticamente |
| `NODE_ENV` | Ambiente | `production` |

### Frontend
| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `VITE_API_URL` | URL dell'API backend | `https://backend.up.railway.app/api` |

## Deploy Automatico

Dopo la configurazione iniziale, ogni push al branch principale attiverà automaticamente un nuovo deploy.

## Monitoraggio

- **Logs**: Disponibili nella dashboard di Railway per ogni servizio
- **Health Check**: Il backend espone `/health` per verificare lo stato
- **Metrics**: Railway fornisce metriche base di CPU/RAM

## Costi

Railway offre:
- **Free Tier**: $5 di crediti gratuiti al mese
- **Hobby Plan**: $5/mese con 500 ore di esecuzione
- **Pro Plan**: Pay-as-you-go per progetti più grandi

Per un'app budget tracker personale, il Free Tier dovrebbe essere sufficiente.

## Troubleshooting

### Il build fallisce
- Verifica che `pnpm-lock.yaml` sia nel repository
- Controlla i log di build per errori specifici

### Errori di connessione al database
- Verifica che `DATABASE_URL` sia configurata correttamente
- Controlla che le migrazioni siano state eseguite

### Il frontend non si connette al backend
- Verifica che `VITE_API_URL` punti all'URL corretto del backend
- Controlla che il backend abbia un dominio pubblico generato
- Verifica le policy CORS nel backend

### Errore "Cannot find module"
- Assicurati che il build command includa la build del package `@budget/shared`
