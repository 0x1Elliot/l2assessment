# Configure Groq for local triage

1. Create a development API key in the [Groq console](https://console.groq.com/keys).
2. Copy `.env.example` to `.env.local` in the project root. Set `GROQ_API_KEY` in that file or in the server environment.
3. Restart `npm run dev`, `npm run preview`, or `npm start` after changing the configuration.
4. In Analyze, submit `What are your business hours?` and open **Routing audit**. With a successful Groq verification, the result is **Automatic recommendation** and `ROUTINE_VERIFIED`. If verification fails, the result requires human review and shows the failure reason.

The default model is `openai/gpt-oss-120b`. To use another model available to your Groq project, set the optional server variable `GROQ_MODEL` to a model that supports [Groq JSON Object Mode](https://console.groq.com/docs/structured-outputs#json-object-mode).

The server reads the credential. `.env.local` is ignored by Git. If you previously used a disposable browser-side key with the baseline app, revoke that key in Groq and use a fresh one under `GROQ_API_KEY`. The app can run with no key. The backend still enforces mandatory reviews and holds messages that need verification.
