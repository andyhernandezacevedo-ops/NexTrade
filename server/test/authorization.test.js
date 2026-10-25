import test from 'node:test'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgres://localhost:5432/nextrade'
process.env.JWT_SECRET ||= 'phase-one-test-secret-with-32-characters'

const { requireRole } = await import('../src/middleware/auth.js')

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

test('role middleware rejects missing and insufficient roles', () => {
  const moderatorOnly = requireRole('moderator', 'admin')
  for (const user of [undefined, { id: 'member-id', role: 'member' }]) {
    const res = response()
    let continued = false
    moderatorOnly({ user }, res, () => { continued = true })
    assert.equal(res.statusCode, 403)
    assert.equal(continued, false)
  }
})

test('role middleware permits moderators and administrators', () => {
  const moderatorOnly = requireRole('moderator', 'admin')
  for (const role of ['moderator', 'admin']) {
    const res = response()
    let continued = false
    moderatorOnly({ user: { id: `${role}-id`, role } }, res, () => { continued = true })
    assert.equal(continued, true)
    assert.equal(res.statusCode, 200)
  }
})
