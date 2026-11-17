import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import test from 'node:test'
import { createGroqVerifier } from '../server/groq-verifier.js'
import { createTriageHandler } from '../server/triage-http.js'

async function submit(body, { method = 'POST', contentType = 'application/json', verifier } = {}) {
  const request = Readable.from([Buffer.from(body)])
  request.method = method
  request.headers = { 'content-type': contentType }
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    writeHead(status, headers) {
      this.status = status
      Object.assign(this.headers, headers)
    },
    end(json) { this.body = JSON.parse(json) },
  }
  const records = []
  await createTriageHandler({ verifier, audit: decision => records.push(decision) })(request, response)
  assert.equal(records.length, 1)
  assert.equal(records[0].requestId, response.body.requestId)
  assert.equal(response.headers['Cache-Control'], 'no-store')
  return response
}

test('HTTP endpoint applies backend safety policy and produces a minimal audit record', async () => {
  const message = 'Production platform is down. Private detail ABC123.'
  const { body, status } = await submit(JSON.stringify({ message }))
  assert.equal(status, 200)
  assert.equal(body.disposition, 'mandatory_incident_review')
  assert.equal(body.reasonCode, 'PRODUCTION_OUTAGE')
  assert.equal(body.verifier.status, 'not_run')
  assert.equal(body.actionId, null)
  assert.ok(!JSON.stringify(body).includes('ABC123'))
  assert.deepEqual(body.policy.matches[0].evidence, { start: 0, end: 27 })
})

test('HTTP endpoint releases only the verified business-hours recommendation', async () => {
  const message = 'What are your business hours?'
  const verdicts = [
    { risk: 'low_risk', evidence: ['business hours'] },
    { verdict: 'supports', category: 'General Inquiry', actionId: 'FAQ', evidence: ['business hours'] },
  ]
  const verifier = createGroqVerifier({
    client: {
      chat: {
        completions: {
          async create() {
            return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(verdicts.shift()) } }] }
          },
        },
      },
    },
  })
  const { body, status } = await submit(JSON.stringify({ message }), { verifier })
  assert.equal(status, 200)
  assert.equal(body.disposition, 'allow_recommendation')
  assert.equal(body.reasonCode, 'ROUTINE_VERIFIED')
  assert.equal(body.actionId, 'FAQ')
  assert.equal(body.recommendedAction, 'Respond with FAQ link.')
  assert.deepEqual(verdicts, [])
})

test('HTTP endpoint rejects client-supplied verdicts, proposals, and dispositions', async () => {
  const { body, status } = await submit(JSON.stringify({
    message: 'Someone changed my sign-in address without permission.',
    proposal: { actionId: 'FAQ' },
    verifier: { status: 'completed', verdict: 'supports' },
    disposition: 'allow_recommendation',
  }))
  assert.equal(status, 400)
  assert.equal(body.disposition, 'invalid_input')
  assert.equal(body.reasonCode, 'INVALID_INPUT')
  assert.equal(body.actionId, null)
  assert.equal(body.verifier.status, 'not_run')
})

for (const [name, raw, options, status] of [
  ['malformed JSON', '{', {}, 400],
  ['wrong message type', '{"message":42}', {}, 400],
  ['blank message', '{"message":"  "}', {}, 400],
  ['overlength message', JSON.stringify({ message: 'x'.repeat(4001) }), {}, 400],
  ['overlength body', JSON.stringify({ message: 'x'.repeat(33000) }), {}, 413],
  ['wrong method', '{}', { method: 'GET' }, 405],
  ['wrong content type', '{}', { contentType: 'text/plain' }, 415],
]) {
  test(`HTTP endpoint closes on ${name}`, async () => {
    const response = await submit(raw, options)
    assert.equal(response.status, status)
    assert.equal(response.body.disposition, 'invalid_input')
    assert.equal(response.body.reasonCode, 'INVALID_INPUT')
    assert.equal(response.body.actionId, null)
  })
}
