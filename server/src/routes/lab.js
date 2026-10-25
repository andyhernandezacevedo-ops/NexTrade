import { Router } from 'express'
import multer from 'multer'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { backtests, marketCandles, marketDatasets, strategies } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { runBacktest } from '../services/backtest.js'
import { normalizePublicCandles, parseCsvCandles } from '../services/datasets.js'
import {
  createBacktestSchema,
  csvDatasetSchema,
  datasetIdParamsSchema,
  publicDatasetSchema,
} from '../services/validation.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1 },
  fileFilter: (req, file, next) => {
    if (file.originalname.toLowerCase().endsWith('.csv')) return next(null, true)
    return next(new Error('Selecciona un archivo con extensión .csv.'))
  },
})

router.use(requireAuth)

async function storeDataset({ userId, source, asset, timeframe, candles }) {
  return db.transaction(async (tx) => {
    const [dataset] = await tx.insert(marketDatasets).values({
      userId,
      source,
      asset,
      timeframe,
      candleCount: candles.length,
    }).returning()

    for (let start = 0; start < candles.length; start += 1000) {
      const batch = candles.slice(start, start + 1000).map((candle) => ({
        datasetId: dataset.id,
        recordedAt: new Date(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? null,
      }))
      await tx.insert(marketCandles).values(batch)
    }

    return dataset
  })
}

router.get('/datasets', async (req, res) => {
  const datasets = await db.select({
    id: marketDatasets.id,
    source: marketDatasets.source,
    asset: marketDatasets.asset,
    timeframe: marketDatasets.timeframe,
    candleCount: marketDatasets.candleCount,
    createdAt: marketDatasets.createdAt,
  }).from(marketDatasets)
    .where(eq(marketDatasets.userId, req.user.id))
    .orderBy(desc(marketDatasets.createdAt))
    .limit(50)
  return res.json({ datasets })
})

router.post('/datasets/csv', upload.single('file'), validate(csvDatasetSchema), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Selecciona un archivo CSV para importar.' })

  const parsed = parseCsvCandles(req.file.buffer.toString('utf8'))
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  const dataset = await storeDataset({
    userId: req.user.id,
    source: 'csv',
    asset: req.body.asset,
    timeframe: req.body.timeframe,
    candles: parsed.candles,
  })
  return res.status(201).json({ dataset })
})

router.post('/datasets/public', validate(publicDatasetSchema), async (req, res) => {
  const { symbol, timeframe, limit } = req.body
  const endpoint = new URL('https://api.binance.com/api/v3/klines')
  endpoint.search = new URLSearchParams({ symbol, interval: timeframe, limit }).toString()

  let response
  let payload
  try {
    response = await fetch(endpoint, { signal: AbortSignal.timeout(12000) })
    if (!response.ok) {
      console.error(`Binance public market data returned HTTP ${response.status}.`)
      return res.status(502).json({ error: 'La API pública de mercado no pudo entregar los datos solicitados.' })
    }
    payload = await response.json()
  } catch (error) {
    console.error('Failed to fetch Binance public market data:', error)
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError'
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut
        ? 'La API pública de mercado tardó demasiado. Inténtalo de nuevo.'
        : 'No fue posible conectar con la API pública de mercado.',
    })
  }

  const parsed = normalizePublicCandles(payload)
  if (parsed.error) return res.status(502).json({ error: parsed.error })
  const dataset = await storeDataset({
    userId: req.user.id,
    source: 'public_api',
    asset: symbol,
    timeframe,
    candles: parsed.candles,
  })
  return res.status(201).json({ dataset })
})

router.get('/datasets/:datasetId/candles', validate(datasetIdParamsSchema, 'params'), async (req, res) => {
  const [dataset] = await db.select({ id: marketDatasets.id })
    .from(marketDatasets)
    .where(and(eq(marketDatasets.id, req.params.datasetId), eq(marketDatasets.userId, req.user.id)))
    .limit(1)
  if (!dataset) return res.status(404).json({ error: 'No se encontró el dataset solicitado.' })

  const candles = await db.select({
    time: marketCandles.recordedAt,
    open: marketCandles.open,
    high: marketCandles.high,
    low: marketCandles.low,
    close: marketCandles.close,
    volume: marketCandles.volume,
  }).from(marketCandles)
    .where(eq(marketCandles.datasetId, dataset.id))
    .orderBy(asc(marketCandles.recordedAt))
  return res.json({ candles })
})

router.get('/backtests', async (req, res) => {
  const runs = await db.select({
    id: backtests.id,
    strategyId: backtests.strategyId,
    datasetId: backtests.datasetId,
    configuration: backtests.configuration,
    results: backtests.results,
    createdAt: backtests.createdAt,
  }).from(backtests)
    .where(eq(backtests.userId, req.user.id))
    .orderBy(desc(backtests.createdAt))
    .limit(20)
  return res.json({ backtests: runs })
})

router.post('/backtests', validate(createBacktestSchema), async (req, res) => {
  const { datasetId, strategyId, rule } = req.body
  const [dataset] = await db.select({
    id: marketDatasets.id,
    asset: marketDatasets.asset,
    timeframe: marketDatasets.timeframe,
  }).from(marketDatasets)
    .where(and(eq(marketDatasets.id, datasetId), eq(marketDatasets.userId, req.user.id)))
    .limit(1)
  if (!dataset) return res.status(404).json({ error: 'No se encontró el dataset solicitado.' })

  if (strategyId) {
    const [strategy] = await db.select({ id: strategies.id })
      .from(strategies)
      .where(and(eq(strategies.id, strategyId), eq(strategies.userId, req.user.id)))
      .limit(1)
    if (!strategy) return res.status(404).json({ error: 'No se encontró una estrategia propia con ese identificador.' })
  }

  const rows = await db.select({
    time: marketCandles.recordedAt,
    open: marketCandles.open,
    high: marketCandles.high,
    low: marketCandles.low,
    close: marketCandles.close,
    volume: marketCandles.volume,
  }).from(marketCandles)
    .where(eq(marketCandles.datasetId, dataset.id))
    .orderBy(asc(marketCandles.recordedAt))
  const candles = rows.map((candle) => ({
    ...candle,
    time: candle.time.toISOString(),
  }))

  let results
  try {
    results = runBacktest(candles, rule)
  } catch (error) {
    if (error instanceof RangeError) return res.status(400).json({ error: error.message })
    throw error
  }

  const configuration = { datasetId, asset: dataset.asset, timeframe: dataset.timeframe, rule }
  const [saved] = await db.insert(backtests).values({
    userId: req.user.id,
    strategyId: strategyId || null,
    datasetId,
    configuration,
    results,
  }).returning({
    id: backtests.id,
    strategyId: backtests.strategyId,
    datasetId: backtests.datasetId,
    configuration: backtests.configuration,
    results: backtests.results,
    createdAt: backtests.createdAt,
  })
  return res.status(201).json({ backtest: saved })
})

export default router
