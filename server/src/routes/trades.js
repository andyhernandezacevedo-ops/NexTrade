import { Router } from 'express'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { strategies, trades } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { tradeIdParamsSchema, tradeSchema } from '../services/validation.js'
import { calculateMetrics } from '../services/metrics.js'

const router = Router()

function valuesForDatabase(body) {
  return {
    ...body,
    openedAt: new Date(body.openedAt),
    closedAt: body.closedAt ? new Date(body.closedAt) : null,
    entryPrice: String(body.entryPrice),
    exitPrice: body.exitPrice == null ? null : String(body.exitPrice),
    stopLoss: body.stopLoss == null ? null : String(body.stopLoss),
    takeProfit: body.takeProfit == null ? null : String(body.takeProfit),
    resultR: body.resultR == null ? null : String(body.resultR),
  }
}

async function verifyStrategyAccess(strategyId, userId) {
  if (!strategyId) return true
  const [strategy] = await db.select({
    userId: strategies.userId,
  }).from(strategies).where(eq(strategies.id, strategyId)).limit(1)
  return Boolean(strategy && strategy.userId === userId)
}

router.use(requireAuth)

router.get('/', async (req, res) => {
  const rows = await db.select().from(trades)
    .where(eq(trades.userId, req.user.id))
    .orderBy(desc(trades.openedAt))
  return res.json({ trades: rows })
})

router.get('/dashboard', async (req, res) => {
  const rows = await db.select().from(trades)
    .where(eq(trades.userId, req.user.id))
    .orderBy(asc(trades.openedAt))
  const closed = rows.filter((trade) => trade.exitPrice !== null)
  const groupedByAsset = new Map()
  for (const trade of closed) {
    const items = groupedByAsset.get(trade.asset) || []
    items.push(trade)
    groupedByAsset.set(trade.asset, items)
  }
  const assetStats = [...groupedByAsset.entries()].map(([asset, items]) => ({
    asset,
    ...calculateMetrics(items.map((trade) => trade.resultR)),
  }))
  let equity = 0
  const equityCurve = closed.map((trade) => {
    equity += Number(trade.resultR || 0)
    return { date: trade.closedAt || trade.openedAt, resultR: Number(trade.resultR || 0), equityR: Number(equity.toFixed(2)) }
  })
  return res.json({
    metrics: calculateMetrics(closed.map((trade) => trade.resultR)),
    equityCurve,
    assetStats,
  })
})

router.post('/', validate(tradeSchema), async (req, res) => {
  if (!(await verifyStrategyAccess(req.body.strategyId, req.user.id))) {
    return res.status(400).json({ error: 'Solo puedes vincular una estrategia propia.' })
  }
  const [trade] = await db.insert(trades)
    .values({ ...valuesForDatabase(req.body), userId: req.user.id })
    .returning()
  return res.status(201).json({ trade })
})

router.put('/:tradeId', validate(tradeIdParamsSchema, 'params'), validate(tradeSchema), async (req, res) => {
  if (!(await verifyStrategyAccess(req.body.strategyId, req.user.id))) {
    return res.status(400).json({ error: 'Solo puedes vincular una estrategia propia.' })
  }
  const [trade] = await db.update(trades)
    .set(valuesForDatabase(req.body))
    .where(and(eq(trades.id, req.params.tradeId), eq(trades.userId, req.user.id)))
    .returning()
  if (!trade) return res.status(404).json({ error: 'No se encontró una operación propia con ese identificador.' })
  return res.json({ trade })
})

router.delete('/:tradeId', validate(tradeIdParamsSchema, 'params'), async (req, res) => {
  const [trade] = await db.delete(trades)
    .where(and(eq(trades.id, req.params.tradeId), eq(trades.userId, req.user.id)))
    .returning({ id: trades.id })
  if (!trade) return res.status(404).json({ error: 'No se encontró una operación propia con ese identificador.' })
  return res.status(204).end()
})

export default router
