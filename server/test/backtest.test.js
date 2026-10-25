import test from 'node:test'
import assert from 'node:assert/strict'
import { runBacktest } from '../src/services/backtest.js'

function candles(closes, opens = closes) {
  return closes.map((close, index) => ({
    time: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    open: String(opens[index]),
    high: String(Math.max(opens[index], close) + 1),
    low: String(Math.min(opens[index], close) - 1),
    close: String(close),
    volume: null,
  }))
}

test('levels enter on the next candle and reverse using its open', () => {
  const history = [
    { time: '2026-01-01T00:00:00.000Z', open: '101', high: '102', low: '100.5', close: '101', volume: null },
    { time: '2026-01-02T00:00:00.000Z', open: '100', high: '101', low: '99', close: '100', volume: null },
    { time: '2026-01-03T00:00:00.000Z', open: '100', high: '103', low: '99', close: '102', volume: null },
    { time: '2026-01-04T00:00:00.000Z', open: '102', high: '104', low: '101', close: '103', volume: null },
    { time: '2026-01-05T00:00:00.000Z', open: '103', high: '111', low: '102', close: '110', volume: null },
    { time: '2026-01-06T00:00:00.000Z', open: '110', high: '112', low: '108', close: '109', volume: null },
    { time: '2026-01-07T00:00:00.000Z', open: '109', high: '110', low: '107', close: '108', volume: null },
  ]

  const result = runBacktest(history, {
    type: 'levels',
    support: '100',
    resistance: '110',
    side: 'both',
  })

  assert.equal(result.trades.length, 2)
  assert.equal(result.trades[0].side, 'long')
  assert.equal(result.trades[0].entryAt, history[3].time)
  assert.equal(result.trades[0].entryPrice, 102)
  assert.equal(result.trades[0].exitAt, history[6].time)
  assert.equal(result.trades[0].exitPrice, 109)
  assert.equal(result.trades[1].side, 'short')
  assert.equal(result.trades[1].entryPrice, 109)
  assert.equal(result.metrics.totalTrades, 2)
  assert.ok(result.metrics.cumulativeReturnPct > 0)
  assert.equal(result.equityCurve[0].equityIndex, 100)
})

test('long-only simulations ignore short signals', () => {
  const history = [
    { time: '2026-01-01T00:00:00.000Z', open: '101', high: '102', low: '100.5', close: '101', volume: null },
    { time: '2026-01-02T00:00:00.000Z', open: '100', high: '101', low: '99', close: '100', volume: null },
    { time: '2026-01-03T00:00:00.000Z', open: '100', high: '103', low: '99', close: '102', volume: null },
    { time: '2026-01-04T00:00:00.000Z', open: '102', high: '104', low: '101', close: '103', volume: null },
    { time: '2026-01-05T00:00:00.000Z', open: '103', high: '111', low: '102', close: '110', volume: null },
    { time: '2026-01-06T00:00:00.000Z', open: '110', high: '112', low: '108', close: '109', volume: null },
    { time: '2026-01-07T00:00:00.000Z', open: '109', high: '110', low: '107', close: '108', volume: null },
  ]

  const result = runBacktest(history, {
    type: 'levels',
    support: '100',
    resistance: '110',
    side: 'long',
  })
  assert.equal(result.trades.length, 1)
  assert.equal(result.trades[0].side, 'long')
  assert.equal(result.trades[0].exitPrice, 109)
})

test('SMA crossover signals require prior candles and execute on the following open', () => {
  const closes = [5, 4, 3, 2, 3, 4, 5, 4, 3, 2]
  const opens = [5, 4, 3, 2, 3, 4, 5, 6, 5, 4]
  const history = candles(closes, opens)
  const result = runBacktest(history, {
    type: 'sma_cross',
    fastPeriod: 2,
    slowPeriod: 3,
    side: 'both',
  })

  assert.equal(result.candles, 10)
  assert.ok(result.trades.length >= 1)
  assert.equal(result.trades[0].entryAt, history[6].time)
  assert.equal(result.trades[0].entryPrice, Number(opens[6]))
})

test('RSI rule returns the normalized rule and an equity curve when there are no signals', () => {
  const history = candles(Array(30).fill(100))
  const result = runBacktest(history, {
    type: 'rsi',
    period: 14,
    oversold: 30,
    overbought: 70,
    side: 'both',
  })
  assert.equal(result.trades.length, 0)
  assert.equal(result.metrics.winrate, null)
  assert.equal(result.equityCurve.length, 1)
  assert.equal(result.equityCurve[0].date, history[0].time)
})

test('rules reject histories too short for their lookback period', () => {
  assert.throws(
    () => runBacktest(candles([1, 2, 3]), { type: 'sma_cross', fastPeriod: 2, slowPeriod: 5, side: 'both' }),
    /al menos 7 velas/,
  )
})
