import { Router } from 'express'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db, pool } from '../db/index.js'
import { comments, communityPosts, strategies, users, votes } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { publicAuthorMetrics, strategyMetrics } from '../services/metrics.js'
import {
  communityCommentSchema,
  communityFeedQuerySchema,
  communityPostIdParamsSchema,
  communityPostSchema,
  voteSchema,
} from '../services/validation.js'

const router = Router()

async function publicPost(postId) {
  const [post] = await db.select({ id: communityPosts.id })
    .from(communityPosts)
    .where(and(
      eq(communityPosts.id, postId),
      eq(communityPosts.moderationStatus, 'approved'),
      isNotNull(communityPosts.publishedAt),
    ))
    .limit(1)
  return post
}

router.get('/feed', async (req, res) => {
  const parsedQuery = communityFeedQuerySchema.safeParse(req.query)
  if (!parsedQuery.success) {
    return res.status(400).json({ error: 'El filtro de comunidad no es válido.' })
  }

  const { kind } = parsedQuery.data
  const { rows } = await pool.query(`
    SELECT
      p.id,
      p.user_id AS "userId",
      p.strategy_id AS "strategyId",
      p.kind,
      p.title,
      p.content,
      p.published_at AS "publishedAt",
      u.username,
      s.title AS "strategyTitle",
      s.description AS "strategyDescription",
      s.asset AS "strategyAsset",
      s.timeframe AS "strategyTimeframe",
      COALESCE((SELECT SUM(v.value)::int FROM votes v WHERE v.post_id = p.id), 0) AS "voteCount",
      (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS "commentCount"
    FROM community_posts p
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN strategies s ON s.id = p.strategy_id
    WHERE p.moderation_status = 'approved'
      AND p.published_at IS NOT NULL
      AND ($1::text IS NULL OR p.kind::text = $1)
    ORDER BY p.published_at DESC, p.id DESC
    LIMIT 30
  `, [kind || null])

  const authorIds = [...new Set(rows.filter((post) => post.kind === 'idea').map((post) => post.userId))]
  const strategyIds = [...new Set(rows.filter((post) => post.strategyId).map((post) => post.strategyId))]
  const [authorMetrics, strategyMetricEntries] = await Promise.all([
    publicAuthorMetrics(authorIds),
    Promise.all(strategyIds.map(async (id) => [id, await strategyMetrics(id)])),
  ])
  const strategiesById = new Map(strategyMetricEntries)

  return res.json({
    posts: rows.map((post) => ({
      id: post.id,
      kind: post.kind,
      title: post.title,
      content: post.content,
      publishedAt: post.publishedAt,
      username: post.username,
      strategy: post.strategyId ? {
        id: post.strategyId,
        title: post.strategyTitle,
        description: post.strategyDescription,
        asset: post.strategyAsset,
        timeframe: post.strategyTimeframe,
      } : null,
      metrics: post.strategyId
        ? strategiesById.get(post.strategyId)
        : authorMetrics.get(post.userId) || null,
      voteCount: post.voteCount,
      commentCount: post.commentCount,
    })),
  })
})

router.post('/posts', requireAuth, validate(communityPostSchema), async (req, res) => {
  const { kind, title, content, strategyId } = req.body
  if (strategyId) {
    const [strategy] = await db.select({ id: strategies.id })
      .from(strategies)
      .where(and(eq(strategies.id, strategyId), eq(strategies.userId, req.user.id)))
      .limit(1)
    if (!strategy) return res.status(404).json({ error: 'Solo puedes compartir una estrategia propia.' })
  }

  const [post] = await db.transaction(async (tx) => {
    if (strategyId) {
      await tx.update(strategies)
        .set({ isPublished: true, moderationStatus: 'approved', updatedAt: new Date() })
        .where(and(eq(strategies.id, strategyId), eq(strategies.userId, req.user.id)))
    }
    return tx.insert(communityPosts).values({
      userId: req.user.id,
      strategyId: strategyId || null,
      kind,
      title,
      content,
      moderationStatus: 'approved',
      publishedAt: new Date(),
    }).returning({
      id: communityPosts.id,
      kind: communityPosts.kind,
      title: communityPosts.title,
      content: communityPosts.content,
      publishedAt: communityPosts.publishedAt,
    })
  })
  return res.status(201).json({ post })
})

router.get('/posts/:postId/comments', validate(communityPostIdParamsSchema, 'params'), async (req, res) => {
  const post = await publicPost(req.params.postId)
  if (!post) return res.status(404).json({ error: 'La publicación no existe o no es pública.' })

  const rows = await db.select({
    id: comments.id,
    content: comments.content,
    createdAt: comments.createdAt,
    username: users.username,
  }).from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, post.id))
    .orderBy(desc(comments.createdAt))
    .limit(100)
  return res.json({ comments: rows })
})

router.post('/posts/:postId/comments', requireAuth, validate(communityPostIdParamsSchema, 'params'), validate(communityCommentSchema), async (req, res) => {
  const post = await publicPost(req.params.postId)
  if (!post) return res.status(404).json({ error: 'La publicación no existe o no es pública.' })

  const [comment] = await db.insert(comments).values({
    userId: req.user.id,
    postId: post.id,
    content: req.body.content,
  }).returning({
    id: comments.id,
    content: comments.content,
    createdAt: comments.createdAt,
  })
  return res.status(201).json({ comment })
})

router.post('/posts/:postId/vote', requireAuth, validate(communityPostIdParamsSchema, 'params'), validate(voteSchema), async (req, res) => {
  const post = await publicPost(req.params.postId)
  if (!post) return res.status(404).json({ error: 'La publicación no existe o no es pública.' })

  await db.insert(votes).values({
    userId: req.user.id,
    postId: post.id,
    value: req.body.value,
  }).onConflictDoUpdate({
    target: [votes.userId, votes.postId],
    set: { value: req.body.value, createdAt: new Date() },
  })
  const [result] = await db.select({
    voteCount: sql`COALESCE(SUM(${votes.value}), 0)::int`,
  }).from(votes).where(eq(votes.postId, post.id))
  return res.json({ voteCount: result.voteCount })
})

export default router
