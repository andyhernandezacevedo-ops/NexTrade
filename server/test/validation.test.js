import test from 'node:test'
import assert from 'node:assert/strict'
import {
  communityFeedQuerySchema,
  communityPostSchema,
  moderationSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  strategySchema,
  tradeSchema,
  voteSchema,
} from '../src/services/validation.js'

const openTrade = {
  asset: 'eurusd',
  side: 'long',
  entryPrice: '1.08425',
  stopLoss: '1.08',
  takeProfit: '1.09',
  notes: 'Entrada por ruptura',
  openedAt: '2026-10-25T12:00:00.000Z',
}

test('registration normalizes email and username', () => {
  assert.deepEqual(registerSchema.parse({
    email: ' Trader@Example.com ',
    username: 'My_Trading',
    password: 'a-strong-password',
  }), {
    email: 'trader@example.com',
    username: 'my_trading',
    password: 'a-strong-password',
  })
})

test('registration rejects short passwords and invalid usernames', () => {
  assert.equal(registerSchema.safeParse({
    email: 'trader@example.com',
    username: 'bad name',
    password: 'short',
  }).success, false)
})

test('login normalizes email', () => {
  assert.equal(loginSchema.parse({ email: 'Trader@Example.com', password: 'pass' }).email, 'trader@example.com')
})

test('profile updates require at least one allowed field', () => {
  assert.equal(profileSchema.safeParse({}).success, false)
  assert.deepEqual(profileSchema.parse({ username: 'NewName', bio: '  Trader  ', role: 'admin' }), {
    username: 'newname',
    bio: 'Trader',
  })
})

test('strategies remain private and normalize the asset', () => {
  const result = strategySchema.parse({
    title: 'Ruptura de rango',
    description: 'Entrada tras confirmación del rango.',
    asset: 'eurusd',
    timeframe: '4H',
    isPublished: true,
  })
  assert.equal(result.asset, 'EURUSD')
  assert.equal('isPublished' in result, false)
})

test('community strategies require a diary strategy and posts accept no hand-entered metrics', () => {
  const idea = communityPostSchema.parse({
    kind: 'idea',
    title: 'Idea de mercado',
    content: 'Contexto suficiente para compartir esta idea.',
    winrate: 99,
  })
  assert.equal('winrate' in idea, false)
  assert.equal(communityPostSchema.safeParse({
    kind: 'strategy',
    title: 'Estrategia pública',
    content: 'Descripción de la estrategia compartida.',
  }).success, false)
  assert.equal(communityPostSchema.safeParse({
    kind: 'idea',
    title: 'Idea de mercado',
    content: 'Una descripción pública suficientemente larga.',
    strategyId: '00000000-0000-4000-8000-000000000001',
  }).success, false)
  assert.deepEqual(communityFeedQuerySchema.parse({ kind: 'idea' }), { kind: 'idea' })
  assert.equal(communityFeedQuerySchema.safeParse({ kind: 'unknown' }).success, false)
  assert.equal(moderationSchema.safeParse({ status: 'approved' }).success, true)
  assert.equal(moderationSchema.safeParse({ status: 'pending' }).success, false)
})

test('community votes accept only a single upvote or downvote value', () => {
  assert.deepEqual(voteSchema.parse({ value: 1 }), { value: 1 })
  assert.deepEqual(voteSchema.parse({ value: -1 }), { value: -1 })
  assert.equal(voteSchema.safeParse({ value: 2 }).success, false)
})

test('trade schema accepts an open operation', () => {
  assert.equal(tradeSchema.safeParse(openTrade).success, true)
})

test('trade schema requires an exit price and close date together', () => {
  assert.equal(tradeSchema.safeParse({ ...openTrade, exitPrice: '1.09' }).success, false)
  assert.equal(tradeSchema.safeParse({
    ...openTrade,
    exitPrice: '1.09',
    closedAt: '2026-10-25T13:00:00.000Z',
    resultR: '1.5',
  }).success, true)
})

test('trade schema rejects a close before open and invalid prices', () => {
  assert.equal(tradeSchema.safeParse({
    ...openTrade,
    exitPrice: '1.09',
    closedAt: '2026-10-25T11:00:00.000Z',
  }).success, false)
  assert.equal(tradeSchema.safeParse({ ...openTrade, entryPrice: '0' }).success, false)
  assert.equal(tradeSchema.safeParse({ ...openTrade, entryPrice: '-4' }).success, false)
  assert.equal(tradeSchema.safeParse({ ...openTrade, resultR: '1.12345' }).success, false)
})
