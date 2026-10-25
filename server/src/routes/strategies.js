import { Router } from 'express'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { strategies, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { strategyIdParamsSchema, strategySchema } from '../services/validation.js'
import { strategyMetrics } from '../services/metrics.js'

const router = Router()

async function withMetrics(strategy) {
  return { ...strategy, metrics: await strategyMetrics(strategy.id) }
}

router.get('/', async (req, res) => {
  const filters = [eq(strategies.isPublished, true)]
  if (req.query.asset) filters.push(eq(strategies.asset, String(req.query.asset).toUpperCase()))
  if (req.query.timeframe) filters.push(eq(strategies.timeframe, String(req.query.timeframe)))

  const rows = await db.select({
    id: strategies.id,
    title: strategies.title,
    description: strategies.description,
    asset: strategies.asset,
    timeframe: strategies.timeframe,
    rules: strategies.rules,
    createdAt: strategies.createdAt,
    userId: strategies.userId,
    username: users.username,
  }).from(strategies)
    .innerJoin(users, eq(strategies.userId, users.id))
    .where(and(...filters))
    .orderBy(desc(strategies.createdAt))

  const results = await Promise.all(rows.map(withMetrics))
  if (req.query.sort === 'winrate') results.sort((a, b) => (b.metrics.winrate ?? -1) - (a.metrics.winrate ?? -1))
  return res.json({ strategies: results })
})

router.get('/mine', requireAuth, async (req, res) => {
  const rows = await db.select().from(strategies)
    .where(eq(strategies.userId, req.user.id))
    .orderBy(desc(strategies.updatedAt))
  return res.json({ strategies: rows })
})

router.get('/profiles/:username', async (req, res) => {
  const [user] = await db.select({
    id: users.id,
    username: users.username,
    bio: users.bio,
    avatarUrl: users.avatarUrl,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.username, req.params.username)).limit(1)
  if (!user) return res.status(404).json({ error: 'No se encontró el perfil solicitado.' })

  const published = await db.select({
    id: strategies.id,
    title: strategies.title,
    description: strategies.description,
    asset: strategies.asset,
    timeframe: strategies.timeframe,
    rules: strategies.rules,
    createdAt: strategies.createdAt,
    userId: strategies.userId,
    username: users.username,
  }).from(strategies)
    .innerJoin(users, eq(strategies.userId, users.id))
    .where(and(eq(strategies.userId, user.id), eq(strategies.isPublished, true)))
    .orderBy(desc(strategies.createdAt))

  return res.json({ user, strategies: await Promise.all(published.map(withMetrics)) })
})

router.get('/:strategyId', validate(strategyIdParamsSchema, 'params'), async (req, res) => {
  const [strategy] = await db.select({
    id: strategies.id,
    title: strategies.title,
    description: strategies.description,
    asset: strategies.asset,
    timeframe: strategies.timeframe,
    rules: strategies.rules,
    isPublished: strategies.isPublished,
    createdAt: strategies.createdAt,
    userId: strategies.userId,
    username: users.username,
  }).from(strategies)
    .innerJoin(users, eq(strategies.userId, users.id))
    .where(and(eq(strategies.id, req.params.strategyId), eq(strategies.isPublished, true)))
    .limit(1)
  if (!strategy) return res.status(404).json({ error: 'La estrategia no existe o no es pública.' })
  return res.json({ strategy: await withMetrics(strategy) })
})

router.post('/', requireAuth, validate(strategySchema), async (req, res) => {
  const [strategy] = await db.insert(strategies)
    .values({ ...req.body, userId: req.user.id })
    .returning()
  return res.status(201).json({ strategy })
})

router.put('/:strategyId', requireAuth, validate(strategyIdParamsSchema, 'params'), validate(strategySchema), async (req, res) => {
  const [strategy] = await db.update(strategies)
    .set({ ...req.body, updatedAt: new Date() })
    .where(and(eq(strategies.id, req.params.strategyId), eq(strategies.userId, req.user.id)))
    .returning()
  if (!strategy) return res.status(404).json({ error: 'No se encontró una estrategia propia con ese identificador.' })
  return res.json({ strategy })
})

router.delete('/:strategyId', requireAuth, validate(strategyIdParamsSchema, 'params'), async (req, res) => {
  const [strategy] = await db.delete(strategies)
    .where(and(eq(strategies.id, req.params.strategyId), eq(strategies.userId, req.user.id)))
    .returning({ id: strategies.id })
  if (!strategy) return res.status(404).json({ error: 'No se encontró una estrategia propia con ese identificador.' })
  return res.status(204).end()
})

export default router
