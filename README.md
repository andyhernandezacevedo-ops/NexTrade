# NexTrade

Plataforma de registro, análisis, backtesting y comunidad. NexTrade no ejecuta órdenes ni gestiona cuentas reales o demo.

## Requisitos

Node.js 22+ y PostgreSQL.

## Arranque

1. Copia `server/.env.example` a `server/.env` y configura `DATABASE_URL` y `JWT_SECRET`.
2. Ejecuta `npm install` desde la raíz del monorepo.
3. Aplica el esquema con `npm run db:migrate`.
4. Inicia cliente y API con `npm run dev`.

El cliente usa Vite en `http://localhost:5173` y la API en `http://localhost:3001`.
