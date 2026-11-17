import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createGroqVerifier } from './groq-verifier.js'
import { createTriageHandler, triagePath } from './triage-http.js'

try {
  process.loadEnvFile('.env.local')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const dist = new URL('../dist/', import.meta.url)
await readFile(new URL('index.html', dist))
const triage = createTriageHandler({
  verifier: createGroqVerifier({ apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL }),
})
const appPaths = new Set(['/', '/analyze', '/history', '/dashboard'])
const contentTypes = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml',
}

const server = createServer(async (request, response) => {
  const path = request.url.split('?')[0]
  if (path === triagePath) {
    await triage(request, response)
    return
  }

  const file = appPaths.has(path.replace(/\/$/, '') || '/') ? 'index.html' : path.slice(1)
  if (!['GET', 'HEAD'].includes(request.method) ||
      !(file === 'index.html' || file === 'vite.svg' || /^assets\/[\w.-]+\.(?:js|css|svg)$/.test(file))) {
    response.writeHead(404).end()
    return
  }

  try {
    const content = await readFile(new URL(file, dist))
    response.writeHead(200, {
      'Content-Type': contentTypes[file.split('.').at(-1)],
      'X-Content-Type-Options': 'nosniff',
    }).end(request.method === 'HEAD' ? undefined : content)
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end()
  }
})

const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4173)
server.listen(port, host, () => {
  console.info(`Relay AI listening on http://${host}:${server.address().port}`)
})
