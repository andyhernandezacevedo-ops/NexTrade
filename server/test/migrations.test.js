import test from 'node:test'
import assert from 'node:assert/strict'
import * as initial from '../src/migrations/1792956000000_initial_schema.js'
import * as laboratoryIndexes from '../src/migrations/1792960100000_laboratory_indexes.js'
import * as tradeIntegrity from '../src/migrations/1792960000000_trade_integrity.js'

test('initial migration creates the auth and journal tables', () => {
  const statements = []
  initial.up({ sql: (statement) => statements.push(statement) })
  assert.match(statements.join('\n'), /CREATE TABLE users/)
  assert.match(statements.join('\n'), /CREATE TABLE strategies/)
  assert.match(statements.join('\n'), /CREATE TABLE trades/)
  assert.match(statements.join('\n'), /CREATE TABLE market_datasets/)
  assert.match(statements.join('\n'), /CREATE TABLE market_candles/)
  assert.match(statements.join('\n'), /CREATE TABLE backtests/)
})

test('trade integrity migration is independently reversible', () => {
  const upStatements = []
  const downStatements = []
  tradeIntegrity.up({ sql: (statement) => upStatements.push(statement) })
  tradeIntegrity.down({ sql: (statement) => downStatements.push(statement) })
  assert.match(upStatements.join('\n'), /trades_closed_fields_check/)
  assert.match(upStatements.join('\n'), /trades_close_after_open/)
  assert.match(downStatements.join('\n'), /DROP CONSTRAINT trades_result_requires_close/)
})

test('laboratory dataset index migration is independently reversible', () => {
  const upStatements = []
  const downStatements = []
  laboratoryIndexes.up({ sql: (statement) => upStatements.push(statement) })
  laboratoryIndexes.down({ sql: (statement) => downStatements.push(statement) })
  assert.match(upStatements.join('\n'), /market_datasets_user_created_idx/)
  assert.match(downStatements.join('\n'), /DROP INDEX market_datasets_user_created_idx/)
})
