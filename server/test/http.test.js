import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

process.env.DATABASE_URL ||= 'postgres://localhost:5432/nextrade'
process.env.JWT_SECRET ||= 'phase-one-test-secret-with-32-characters'

const [{ default: app }, { pool }] = await Promise.all([
  import('../src/app.js'),
  import('../src/db/index.js'),
])

test('API exposes health and rejects invalid or unauthenticated journal requests', async (context) => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  context.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    await pool.end()
  })

  const baseUrl = `http://127.0.0.1:${server.address().port}/api`
  const health = await fetch(`${baseUrl}/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok' })

  const invalidRegistration = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invalid', username: 'x', password: 'short' }),
  })
  assert.equal(invalidRegistration.status, 400)

  const privateStrategies = await fetch(`${baseUrl}/strategies/mine`)
  assert.equal(privateStrategies.status, 401)

  const privateTrades = await fetch(`${baseUrl}/trades`)
  assert.equal(privateTrades.status, 401)

  const privateAnalytics = await fetch(`${baseUrl}/trades/analytics`)
  assert.equal(privateAnalytics.status, 401)

  const privateLab = await fetch(`${baseUrl}/lab/datasets`)
  assert.equal(privateLab.status, 401)

  const privateBacktest = await fetch(`${baseUrl}/lab/backtests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(privateBacktest.status, 401)

  const invalidCommunityFilter = await fetch(`${baseUrl}/community/feed?kind=invalid`)
  assert.equal(invalidCommunityFilter.status, 400)

  const privateCommunityPost = await fetch(`${baseUrl}/community/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'idea',
      title: 'Idea pública',
      content: 'Una descripción pública suficientemente larga.',
    }),
  })
  assert.equal(privateCommunityPost.status, 401)

  const privateCommunityVote = await fetch(`${baseUrl}/community/posts/00000000-0000-4000-8000-000000000001/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 1 }),
  })
  assert.equal(privateCommunityVote.status, 401)

  const privateAdminQueue = await fetch(`${baseUrl}/admin/posts`)
  assert.equal(privateAdminQueue.status, 401)

  const privateAdminUsers = await fetch(`${baseUrl}/admin/users`)
  assert.equal(privateAdminUsers.status, 401)

  const privateStrategyCopy = await fetch(`${baseUrl}/strategies/00000000-0000-4000-8000-000000000001/copy`, {
    method: 'POST',
  })
  assert.equal(privateStrategyCopy.status, 401)

  const invalidToken = jwt.sign({ id: 'not-a-uuid' }, process.env.JWT_SECRET)
  const invalidSession = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${invalidToken}` },
  })
  assert.equal(invalidSession.status, 401)

  const invalidStrategyId = await fetch(`${baseUrl}/strategies/not-a-uuid`)
  assert.equal(invalidStrategyId.status, 400)
})
