import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { prisma } from './lib/prisma.js';
import { monthPeriodRoutes } from './routes/month-period.routes.js';
import { incomeRoutes } from './routes/income.routes.js';
import { expenseRoutes } from './routes/expense.routes.js';
import { budgetRuleRoutes } from './routes/budget-rule.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { reallocationRoutes } from './routes/reallocation.routes.js';
import { cashFlowRoutes } from './routes/cashflow.routes.js';
import { fixedExpenseTemplateRoutes } from './routes/fixed-expense-template.routes.js';
import { portfolioRoutes } from './routes/portfolio.routes.js';
import { spendingCategoryRoutes } from './routes/spending-category.routes.js';
import { sinkingFundRoutes } from './routes/sinking-fund.routes.js';
import { wealthGoalRoutes } from './routes/wealth-goal.routes.js';
import { mealRoutes } from './routes/meal.routes.js';
import { mealTypeDefinitionRoutes } from './routes/meal-type-definition.routes.js';
import { mealUnitDefinitionRoutes } from './routes/meal-unit-definition.routes.js';
import { moodDefinitionRoutes } from './routes/mood-definition.routes.js';
import { quickLogRoutes } from './routes/quick-log.routes.js';
import { treatmentRoutes } from './routes/treatment.routes.js';
import { checkInRoutes } from './routes/check-in.routes.js';
import { foodDashboardRoutes } from './routes/food-dashboard.routes.js';
import { errorHandler } from './lib/error-handler.js';
import authPlugin from './auth/auth.plugin.js';
import { authRoutes } from './auth/auth.routes.js';
import { authMiddleware } from './auth/auth.middleware.js';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  },
});

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

await fastify.register(cors, {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    // Check if origin is in allowed list
    if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
      callback(null, origin);
      return;
    }
    // In development, allow all
    if (process.env.NODE_ENV !== 'production') {
      callback(null, origin);
      return;
    }
    callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
});

// Register auth plugin (JWT, OAuth, cookies)
await fastify.register(authPlugin);

// Swagger documentation
await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Budget Tracker API',
      description: 'Personal finance management API with 65/25/10 budget rule',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}`,
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Month Periods', description: 'Monthly budget periods management' },
      { name: 'Budget Rules', description: 'Budget percentage rules' },
      { name: 'Incomes', description: 'Income entries management' },
      { name: 'Expenses', description: 'Expense entries management' },
      { name: 'Dashboard', description: 'Dashboard and summary endpoints' },
      { name: 'Reallocations', description: 'Budget reallocation management' },
      { name: 'CashFlow', description: 'Net worth tracking checks and settings' },
      { name: 'Fixed Expenses', description: 'Recurring fixed expense templates' },
      { name: 'Portfolio', description: 'Portfolio historical market data' },
      { name: 'Spending Categories', description: 'Fine-grained expense classification' },
      { name: 'Sinking Funds', description: 'Monthly accruals for irregular expenses' },
      { name: 'Wealth Goals', description: 'Net worth targets with run-rate projections' },
      { name: 'Meals', description: 'Food diary meals and items' },
      { name: 'Meal Types', description: 'Custom food diary meal types' },
      { name: 'Meal Units', description: 'Custom food diary units' },
      { name: 'Quick Logs', description: 'Food diary raw quick logs' },
      { name: 'Moods', description: 'User-owned catalog of mood states' },
      { name: 'Intakes', description: 'User-owned catalog of things taken daily, and adherence' },
      { name: 'Check-in', description: 'Configurable daily self-report scales' },
      { name: 'Food Dashboard', description: 'Food diary trends, correlations and CSV export' },
    ],
  },
});

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Error handler
fastify.setErrorHandler(errorHandler);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register auth routes (public - no auth required)
await fastify.register(authRoutes, { prefix: '/auth' });

// Auth middleware for all /api routes
fastify.addHook('onRequest', async (request, reply) => {
  // Skip auth for public endpoints
  if (
    request.url.startsWith('/auth') ||
    request.url === '/health' ||
    request.url.startsWith('/docs')
  ) {
    return;
  }

  // Apply auth middleware to /api routes
  if (request.url.startsWith('/api')) {
    await authMiddleware(request, reply);
  }
});

// Register routes
await fastify.register(monthPeriodRoutes, { prefix: '/api/periods' });
await fastify.register(budgetRuleRoutes, { prefix: '/api/budget-rules' });
await fastify.register(incomeRoutes, { prefix: '/api/incomes' });
await fastify.register(expenseRoutes, { prefix: '/api/expenses' });
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
await fastify.register(reallocationRoutes, { prefix: '/api/reallocations' });
await fastify.register(cashFlowRoutes, { prefix: '/api/cashflow' });
await fastify.register(fixedExpenseTemplateRoutes, { prefix: '/api/fixed-expenses' });
await fastify.register(portfolioRoutes, { prefix: '/api/portfolio' });
await fastify.register(spendingCategoryRoutes, { prefix: '/api/spending-categories' });
await fastify.register(sinkingFundRoutes, { prefix: '/api/sinking-funds' });
await fastify.register(wealthGoalRoutes, { prefix: '/api/wealth-goals' });
await fastify.register(mealRoutes, { prefix: '/api/meals' });
await fastify.register(mealTypeDefinitionRoutes, { prefix: '/api/meal-types' });
await fastify.register(mealUnitDefinitionRoutes, { prefix: '/api/meal-units' });
await fastify.register(moodDefinitionRoutes, { prefix: '/api/moods' });
await fastify.register(quickLogRoutes, { prefix: '/api/quick-logs' });
await fastify.register(treatmentRoutes, { prefix: '/api/treatments' });
await fastify.register(checkInRoutes, { prefix: '/api/check-in' });
await fastify.register(foodDashboardRoutes, { prefix: '/api/food-dashboard' });

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 Server running at http://localhost:${port}`);
    console.log(`📚 API Docs available at http://localhost:${port}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
