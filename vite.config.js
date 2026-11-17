import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createGroqVerifier } from './server/groq-verifier.js'
import { createTriageHandler, triagePath } from './server/triage-http.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'GROQ_')
  const verifier = createGroqVerifier({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL })
  const triage = createTriageHandler({ verifier })

  function installTriage(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url.split('?')[0] !== triagePath) return next()
      triage(request, response).catch(next)
    })
  }

  return {
    envPrefix: 'APP_PUBLIC_',
    plugins: [
      react(),
      { name: 'routing-safety-gate', configureServer: installTriage, configurePreviewServer: installTriage },
    ],
  }
})
