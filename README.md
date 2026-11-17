# Customer Inbox Triage App

Relay AI evaluates customer support messages and recommends the next step. The backend routes suspected production outages to incident review and suspected account compromise or data exposure to security review. It can recommend routine actions after a deterministic proposal, a successful Groq verification, and backend policy approval.

## Run locally

Use Node.js 20.19+ or 22.12+ and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open the URL printed by Vite. Groq is optional for startup. See [Groq setup](GROQ-SETUP.md) to enable live verification with a server-side key.

To run the built app and backend on the same origin:

```bash
npm run build
npm start
```

The built app listens at `http://127.0.0.1:4173` by default. `npm run preview` also serves the API for local build checks.

## Routing decisions

1. Analyze sends the original message to `POST /api/triage`.
2. Versioned backend rules propose a route. Independent policy checks the original text for mandatory reviews and for an eligible routine action. Clear mandatory-review and instruction-override matches can be decided locally.
3. Groq checks risk from the message alone. If the message and proposal qualify for automatic handling, a second prompt evaluates the proposed category and action. Invalid, ungrounded, uncertain, mismatched, or unavailable verdicts require review.
4. The final decision includes a disposition, reason code, request ID, and evidence and version information. Use **Routing audit** on Analyze or History to inspect it.

The app recommends review and identifies the appropriate team. Completing that handoff is a manual step. Server audit output contains decision metadata and evidence offsets. Browser History stores results and customer text locally, including earlier entries created before the gate. Routing patterns and routine allowlists cover a bounded set of signals. Messages outside that set cannot receive an automatic recommendation.

| Example | Expected disposition |
| --- | --- |
| Our production server is down. All customers are unable to access their accounts. | Mandatory incident review |
| Someone changed my sign-in address without permission and is exporting our customer records. | Mandatory security review |
| What are your business hours? | Automatic recommendation when Groq verifies it, human review when verification is unavailable |

## Checks

`npm test` runs offline tests for the policy, verifier contracts, failure paths, and HTTP endpoint. `npm run build` builds the frontend. `npm run lint` runs ESLint.

This project is for educational purposes.
