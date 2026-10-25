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

  const invalidToken = jwt.sign({ id: 'not-a-uuid' }, process.env.JWT_SECRET)
  const invalidSession = await fetch(`${baseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${invalidToken}` },
  })
  assert.equal(invalidSession.status, 401)

  const invalidStrategyId = await fetch(`${baseUrl}/strategies/not-a-uuid`)
  assert.equal(invalidStrategyId.status, 400)
})
