import test from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgres://localhost:5432/nextrade'

const [{ pool }, { getUserAnalytics, strategyMetrics }] = await Promise.all([
  import('../src/db/index.js'),
  import('../src/services/metrics.js'),
])

const summary = {
  closedTrades: 4,
  winrate: '50.0',
  profitFactor: '1.50',
  riskReward: '1.50',
  maxDrawdownR: '1.00',
  cumulativeR: '1.00',
}

function mockQueries(handler) {
  const original = Object.getOwnPropertyDescriptor(pool, 'query')
  pool.query = handler
  return () => {
    if (original) Object.defineProperty(pool, 'query', original)
    else delete pool.query
  }
}

test('dashboard requests SQL-computed summary, curve, group metrics and counts', async () => {
  const statements = []
  const restore = mockQueries(async (query, values) => {
    statements.push({ query, values })
    if (query.includes('"totalTrades"')) return { rows: [{ totalTrades: 7, openTrades: 3 }] }
    if (query.includes('closed_at AS date')) {
      return { rows: [{ date: '2026-10-24T15:00:00.000Z', resultR: '1.5', equityR: '1.5' }] }
    }
    if (query.includes('FROM grouped_drawdowns')) {
      const row = {
        id: 'asset-id',
        name: 'EURUSD',
        ...summary,
      }
      return { rows: [row] }
    }
    return { rows: [summary] }
  })

  try {
    const result = await getUserAnalytics('user-id')
    assert.equal(result.totalTrades, 7)
    assert.equal(result.openTrades, 3)
    assert.deepEqual(result.metrics, {
      closedTrades: 4,
      winrate: 50,
      profitFactor: 1.5,
      riskReward: 1.5,
      maxDrawdownR: 1,
      cumulativeR: 1,
    })
    assert.deepEqual(result.equityCurve, [{
      date: '2026-10-24T15:00:00.000Z',
      resultR: 1.5,
      equityR: 1.5,
    }])
    assert.equal(result.byAsset[0].name, 'EURUSD')
    assert.equal(result.byStrategy[0].closedTrades, 4)
    assert.equal(result.assetStats[0].asset, 'EURUSD')
    assert.equal(statements.length, 5)
    assert.ok(statements.every(({ query, values }) => query.includes('SUM(result_r) OVER') || query.includes('"totalTrades"')))
    assert.ok(statements.every(({ values }) => values[0] === 'user-id'))
    assert.ok(statements.some(({ query }) => query.includes('GROUP BY d.asset')))
    assert.ok(statements.some(({ query }) => query.includes('GROUP BY d.strategy_id, s.title')))
  } finally {
    restore()
  }
})

test('public strategy metrics are also calculated by SQL', async () => {
  let capturedQuery
  let capturedValues
  const restore = mockQueries(async (query, values) => {
    capturedQuery = query
    capturedValues = values
    return { rows: [summary] }
  })

  try {
    const result = await strategyMetrics('strategy-id')
    assert.equal(result.cumulativeR, 1)
    assert.match(capturedQuery, /t\.strategy_id = \$1/)
    assert.match(capturedQuery, /SUM\(result_r\) OVER/)
    assert.deepEqual(capturedValues, ['strategy-id'])
  } finally {
    restore()
  }
})
