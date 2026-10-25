import { pool } from '../db/index.js'

const closedTradesCte = `
  WITH closed_trades AS (
    SELECT
      t.id,
      t.strategy_id,
      t.asset,
      COALESCE(t.result_r, 0)::numeric AS result_r,
      COALESCE(t.closed_at, t.opened_at) AS closed_at
    FROM trades t
    WHERE t.exit_price IS NOT NULL
      AND t.user_id = $1
      %WHERE%
  ),
  equity AS (
    SELECT
      closed_trades.*,
      SUM(result_r) OVER (ORDER BY closed_at, id) AS equity_r
    FROM closed_trades
  ),
  drawdowns AS (
    SELECT
      equity.*,
      GREATEST(0, MAX(equity_r) OVER (
        ORDER BY closed_at, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )) - equity_r AS drawdown_r
    FROM equity
  )
`

function numberOrNull(value) {
  return value == null ? null : Number(value)
}

function formatSummary(row) {
  return {
    closedTrades: Number(row.closedTrades),
    winrate: numberOrNull(row.winrate),
    profitFactor: numberOrNull(row.profitFactor),
    riskReward: numberOrNull(row.riskReward),
    maxDrawdownR: numberOrNull(row.maxDrawdownR),
    cumulativeR: Number(row.cumulativeR),
  }
}

async function getSummary(userId, filter = '') {
  const query = `
    ${closedTradesCte.replace('%WHERE%', filter)}
    SELECT
      COUNT(*)::int AS "closedTrades",
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE result_r > 0)::numeric * 100 / COUNT(*), 1)
        ELSE NULL
      END AS winrate,
      ROUND(
        SUM(result_r) FILTER (WHERE result_r > 0)
        / NULLIF(ABS(SUM(result_r) FILTER (WHERE result_r < 0)), 0),
        2
      ) AS "profitFactor",
      ROUND(
        (SUM(result_r) FILTER (WHERE result_r > 0) / NULLIF(COUNT(*) FILTER (WHERE result_r > 0), 0))
        / NULLIF(
          ABS(SUM(result_r) FILTER (WHERE result_r < 0))
          / NULLIF(COUNT(*) FILTER (WHERE result_r < 0), 0),
          0
        ),
        2
      ) AS "riskReward",
      ROUND(COALESCE(MAX(drawdown_r), 0), 2) AS "maxDrawdownR",
      ROUND(COALESCE(SUM(result_r), 0), 2) AS "cumulativeR"
    FROM drawdowns
  `
  const { rows } = await pool.query(query, [userId])
  return formatSummary(rows[0])
}

async function getEquityCurve(userId) {
  const query = `
    ${closedTradesCte.replace('%WHERE%', '')}
    SELECT
      closed_at AS date,
      ROUND(result_r, 4) AS "resultR",
      ROUND(equity_r, 2) AS "equityR"
    FROM equity
    ORDER BY closed_at, id
  `
  const { rows } = await pool.query(query, [userId])
  return rows.map((row) => ({
    date: row.date,
    resultR: Number(row.resultR),
    equityR: Number(row.equityR),
  }))
}

async function getGroupedMetrics(userId, groupBy) {
  const groupColumn = groupBy === 'strategy' ? 'strategy_id' : 'asset'
  const groupName = groupBy === 'strategy' ? 'COALESCE(s.title, \'Sin estrategia\')' : 'asset'
  const joinStrategies = groupBy === 'strategy' ? 'LEFT JOIN strategies s ON s.id = d.strategy_id' : ''
  const query = `
    ${closedTradesCte.replace('%WHERE%', '')}
    , grouped_equity AS (
      SELECT
        d.*,
        SUM(result_r) OVER (PARTITION BY ${groupColumn} ORDER BY closed_at, id) AS equity_r
      FROM closed_trades d
    ),
    grouped_drawdowns AS (
      SELECT
        grouped_equity.*,
        GREATEST(0, MAX(equity_r) OVER (
          PARTITION BY ${groupColumn} ORDER BY closed_at, id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )) - equity_r AS drawdown_r
      FROM grouped_equity
    )
    SELECT
      ${groupBy === 'strategy' ? 'd.strategy_id' : 'd.asset'} AS id,
      ${groupName} AS name,
      COUNT(*)::int AS "closedTrades",
      ROUND(COUNT(*) FILTER (WHERE result_r > 0)::numeric * 100 / COUNT(*), 1) AS winrate,
      ROUND(
        SUM(result_r) FILTER (WHERE result_r > 0)
        / NULLIF(ABS(SUM(result_r) FILTER (WHERE result_r < 0)), 0),
        2
      ) AS "profitFactor",
      ROUND(
        (SUM(result_r) FILTER (WHERE result_r > 0) / NULLIF(COUNT(*) FILTER (WHERE result_r > 0), 0))
        / NULLIF(
          ABS(SUM(result_r) FILTER (WHERE result_r < 0))
          / NULLIF(COUNT(*) FILTER (WHERE result_r < 0), 0),
          0
        ),
        2
      ) AS "riskReward",
      ROUND(COALESCE(MAX(drawdown_r), 0), 2) AS "maxDrawdownR",
      ROUND(SUM(result_r), 2) AS "cumulativeR"
    FROM grouped_drawdowns d
    ${joinStrategies}
    GROUP BY ${groupBy === 'strategy' ? 'd.strategy_id, s.title' : 'd.asset'}
    ORDER BY "closedTrades" DESC, name ASC
  `
  const { rows } = await pool.query(query, [userId])
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ...formatSummary(row),
  }))
}

export async function strategyMetrics(strategyId) {
  const query = `
    ${closedTradesCte.replace('t.user_id = $1', 't.strategy_id = $1').replace('%WHERE%', '')}
    SELECT
      COUNT(*)::int AS "closedTrades",
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE result_r > 0)::numeric * 100 / COUNT(*), 1)
        ELSE NULL
      END AS winrate,
      ROUND(
        SUM(result_r) FILTER (WHERE result_r > 0)
        / NULLIF(ABS(SUM(result_r) FILTER (WHERE result_r < 0)), 0),
        2
      ) AS "profitFactor",
      ROUND(
        (SUM(result_r) FILTER (WHERE result_r > 0) / NULLIF(COUNT(*) FILTER (WHERE result_r > 0), 0))
        / NULLIF(
          ABS(SUM(result_r) FILTER (WHERE result_r < 0))
          / NULLIF(COUNT(*) FILTER (WHERE result_r < 0), 0),
          0
        ),
        2
      ) AS "riskReward",
      ROUND(COALESCE(MAX(drawdown_r), 0), 2) AS "maxDrawdownR",
      ROUND(COALESCE(SUM(result_r), 0), 2) AS "cumulativeR"
    FROM drawdowns
  `
  const { rows } = await pool.query(query, [strategyId])
  return formatSummary(rows[0])
}

export async function getUserAnalytics(userId) {
  const [summary, equityCurve, byAsset, byStrategy, counts] = await Promise.all([
    getSummary(userId),
    getEquityCurve(userId),
    getGroupedMetrics(userId, 'asset'),
    getGroupedMetrics(userId, 'strategy'),
    pool.query(
      'SELECT COUNT(*)::int AS "totalTrades", COUNT(*) FILTER (WHERE exit_price IS NULL)::int AS "openTrades" FROM trades WHERE user_id = $1',
      [userId],
    ),
  ])

  return {
    metrics: summary,
    totalTrades: Number(counts.rows[0].totalTrades),
    openTrades: Number(counts.rows[0].openTrades),
    equityCurve,
    byAsset,
    byStrategy,
    assetStats: byAsset.map(({ name, ...metrics }) => ({ asset: name, ...metrics })),
  }
}
