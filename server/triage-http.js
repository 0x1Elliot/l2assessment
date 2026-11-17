import { Buffer } from 'node:buffer'
import { createGroqVerifier } from './groq-verifier.js'
import { hasExactKeys } from './route-catalog.js'
import { triageMessage } from './triage.js'

const maxBodyBytes = 32 * 1024
export const triagePath = '/api/triage'

export function createTriageHandler({
  verifier = createGroqVerifier(),
  audit = decision => console.info(JSON.stringify({ event: 'triage_decision', ...decision })),
} = {}) {
  return async function handleTriage(request, response) {
    let status = 200
    let message
    if (request.method !== 'POST') {
      status = 405
      response.setHeader('Allow', 'POST')
    } else if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      status = 415
    } else {
      try {
        const chunks = []
        let size = 0
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          size += chunk.length
          if (size > maxBodyBytes) {
            status = 413
            break
          }
          chunks.push(chunk)
        }
        if (status === 200) {
          const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (hasExactKeys(input, ['message'])) message = input.message
        }
      } catch {
        status = 400
      }
    }
    request.resume()

    const decision = await triageMessage(message, verifier)
    if (status === 200 && decision.disposition === 'invalid_input') status = 400
    // The decision contains evidence offsets, with no raw message or provider response.
    audit(decision)
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    response.end(JSON.stringify(decision))
  }
}
