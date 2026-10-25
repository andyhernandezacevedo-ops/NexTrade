# NexTrade

Plataforma de registro, análisis, backtesting y comunidad. NexTrade no ejecuta órdenes ni gestiona cuentas reales o demo.

## Requisitos

Node.js 22+ y PostgreSQL.

## Arranque

1. Copia `server/.env.example` a `server/.env` y configura `DATABASE_URL` y `JWT_SECRET` (al menos 32 caracteres).
2. Ejecuta `npm install` desde la raíz del monorepo.
3. Aplica el esquema con `npm run db:migrate`.
4. Inicia cliente y API con `npm run dev`.

El cliente usa Vite en `http://localhost:5173` y la API en `http://localhost:3001`.

`npm test` ejecuta las pruebas del servidor.

El diario autenticado ofrece resumen analítico en `GET /api/trades/analytics`.
El winrate usa operaciones cerradas; profit factor compara ganancias y pérdidas brutas;
riesgo/beneficio compara sus promedios. Drawdown y rentabilidad acumulada se calculan
sobre la curva de resultados R en orden de cierre. No representan importes monetarios.

El laboratorio autenticado está disponible en `/lab`. Permite importar CSV con las
columnas `timestamp,open,high,low,close` (también acepta `time` o `date`; `volume` es
opcional) o cargar velas históricas de Binance Spot sin clave. Los datos se guardan por
usuario y se pueden analizar con cruces SMA, RSI y rebotes en niveles. El simulador usa
señales al cierre y entradas al abrir la vela siguiente; no incluye comisiones ni
deslizamiento y nunca envía órdenes.
