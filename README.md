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

La comunidad pública está disponible en `/community`: permite publicar ideas o
estrategias del diario, votar, comentar y copiar estrategias al espacio privado. Las
métricas de las ideas usan operaciones cerradas del autor; las de estrategias, las
operaciones cerradas asociadas a esa estrategia. Los resultados se calculan en el
servidor en unidades R. Las publicaciones nuevas requieren aprobación de moderación
antes de aparecer en el feed.

La consola restringida está en `/admin`. Moderadores y administradores pueden revisar
publicaciones; solo administradores pueden suspender o reactivar cuentas de miembros.
Para habilitar el primer administrador, crea la cuenta normalmente y promueve su correo
de forma controlada en PostgreSQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

No existe un endpoint público para elevar privilegios. Las cuentas de administrador no
se pueden suspender desde la consola para evitar el bloqueo accidental del acceso.
