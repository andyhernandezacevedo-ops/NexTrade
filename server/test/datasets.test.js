import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePublicCandles, parseCsvCandles } from '../src/services/datasets.js'

test('CSV import accepts aliases and normalizes epoch timestamps', () => {
  const csv = '\uFEFFtimestamp,open,high,low,close,volume\n1760000000000,10,12,9,11,30\n1760003600000,11,13,10,12,40\n'
  const result = parseCsvCandles(csv)
  assert.equal(result.error, undefined)
  assert.equal(result.candles.length, 2)
  assert.equal(result.candles[0].time, new Date(1760000000000).toISOString())
  assert.equal(result.candles[1].close, '12')
})

test('CSV import validates OHLC ranges and ordered unique dates', () => {
  const invalidRange = parseCsvCandles('time,open,high,low,close\n2026-01-01T00:00:00Z,10,9,8,10\n2026-01-02T00:00:00Z,10,11,9,10\n')
  assert.match(invalidRange.error, /Fila/)

  const unordered = parseCsvCandles('time,open,high,low,close\n2026-01-02T00:00:00Z,10,11,9,10\n2026-01-01T00:00:00Z,10,11,9,10\n')
  assert.match(unordered.error, /orden cronológico/)
})

test('CSV import requires the expected columns and candle count', () => {
  assert.match(parseCsvCandles('time,open,high,low\n2026-01-01,10,11,9\n2026-01-02,10,11,9\n').error, /Fila/)
  assert.match(parseCsvCandles('time,open,high,low,close\n').error, /entre 2 y 5.000/)
})

test('public API data is normalized and rejects invalid rows', () => {
  const result = normalizePublicCandles([
    [1760000000000, '10', '12', '9', '11', '100'],
    [1760003600000, '11', '13', '10', '12', '120'],
  ])
  assert.equal(result.candles.length, 2)
  assert.equal(result.candles[0].volume, '100')
  assert.match(normalizePublicCandles([[0, '10', '9', '8', '10', '0']]).error, /inválidos/)
  assert.match(normalizePublicCandles([[Number.NaN]]).error, /incompletas/)
})
