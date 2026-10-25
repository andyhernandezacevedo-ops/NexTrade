import test from 'node:test'
import assert from 'node:assert/strict'
import * as initial from '../src/migrations/1792956000000_initial_schema.js'
import * as tradeIntegrity from '../src/migrations/1792960000000_trade_integrity.js'

test('initial migration creates the auth and journal tables', () => {
  const statements = []
  initial.up({ sql: (statement) => statements.push(statement) })
  assert.match(statements.join('\n'), /CREATE TABLE users/)
  assert.match(statements.join('\n'), /CREATE TABLE strategies/)
  assert.match(statements.join('\n'), /CREATE TABLE trades/)
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
