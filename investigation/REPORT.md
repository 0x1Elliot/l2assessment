# Relay AI Week 8 — investigation and feature proposal

Status: **partial investigation; live workflow blocked by missing Groq credentials; feature not implemented.**

Date: November 9, 2026 (America/New_York). Scope follows the user's supplied Week 8 instructions; the repository contains app setup and sample messages, but no separate assessment rubric was supplied.

## Repository and safety boundary

- Original: https://github.com/jimenezatmit/l2assessment (read only throughout).
- User fork: https://github.com/0x1Elliot/l2assessment (existing fork verified against parent; reused without resetting it).
- Investigation: `investigation/week8-routing-audit-20261109`.
- Baseline commit: `011d920e412a3069bc430e87157b8f4321037c06`.
- Application source, package manifest, lockfile, and main remain unchanged. Only investigation artifacts are added.
- No feature branch, feature implementation, PR, merge, deployment, production data, or real customer messages.

## Executed evidence and limits

The intended flow is customer message → browser Groq request → category parser → urgency rules → recommendation → local history. There is no application backend or actual support-queue integration in the baseline.

| Check | Executed outcome | Evidence |
|---|---|---|
| Locked dependency installation | Completed: 340 packages; installer reported 21 advisories (1 low, 5 moderate, 15 high); no automatic upgrades | Installation tool output in this assessment conversation |
| Production build | Pass, 235 modules transformed | [build.log](evidence/build.log) |
| Baseline lint | Fail, six existing errors; no fixes made | [lint.log](evidence/lint.log) |
| Local dev server | Ready at http://127.0.0.1:5173 | [dev-server.log](evidence/dev-server.log) |
| Browser entry at /analyze | Blank screen; Groq constructor throws before React renders | [startup-console.json](evidence/startup-console.json), [screenshot](evidence/missing-key-startup.png) |
| Offline reproducer | 10/10 checks reproduced existing defects | [baseline-run.log](evidence/baseline-run.log), [baseline.json](evidence/baseline.json) |
| Investigation harness lint | Pass | Executed ESLint against investigation/baseline.mjs |
| Live Groq categorization | **Blocked; zero live calls** | No Groq key configured; no placeholder key inserted |
| End-to-end history/dashboard verification | **Blocked at initial render** | Not continued past the broken boundary |

The first sandboxed GitHub login check misleadingly reported invalid credentials because networking was unavailable. A network-enabled check succeeded; no credential changes or authentication bypass occurred.

The offline harness loads the unchanged source modules using Node VM modules and substitutes only the external Groq transport, date, and randomness. It exercises 16 synthetic messages under controlled provider failure, seven injected model-output fixtures, a time comparison, two escalation-helper probes, and one false-consensus scenario. It does not modify the app to make it run. The initial time probe did not cross an urgency threshold; the retained probe uses two exclamation marks and demonstrably crosses High → Medium.

The 16-message set produced 8 category mismatches and 13 urgency mismatches against explicitly stated investigation assumptions. These are diagnostic examples, **not a representative accuracy estimate** or official policy ground truth. Seven parser fixtures produced four mismatches. Fixture responses are authored tests, **not observed Groq responses** and do not establish attack success rates. The ten green reproducer checks confirm defects, not acceptance of the product.

## Top three improvement opportunities

### 1. Prioritize impact and enforce escalation in the actual decision path

`Our production server is down` returns **Low**. The polite widespread outage in U03 also returns **Low**. `PAYMENTS ARE FAILING FOR ALL CUSTOMERS` returns **Low**. A long complimentary message U15 returns **High**. Identical order-processing text changes **High → Medium** from weekday noon to Sunday evening solely because of the operator's clock.

The urgency score rewards punctuation, subtracts for short text, politeness, capitals, and off-hours, and never checks business impact. The separate escalation helper returns false for `Server down now` and true for a long thank-you; AnalyzePage never calls that helper at all.

Opportunity: replace stylistic urgency with explicit impact/risk signals, require human review for serious incidents and uncertain cases, and connect the disposition to the UI/action. This targets delayed response to outages, compromise, and data exposure—the highest-consequence failure examples found here. No actual monetary loss was measured.

[Urgency source](https://github.com/jimenezatmit/l2assessment/blob/011d920e412a3069bc430e87157b8f4321037c06/src/utils/urgencyScorer.js#L5) [Escalation helper](https://github.com/jimenezatmit/l2assessment/blob/011d920e412a3069bc430e87157b8f4321037c06/src/utils/templates.js#L41) [Analyze flow](https://github.com/jimenezatmit/l2assessment/blob/011d920e412a3069bc430e87157b8f4321037c06/src/pages/AnalyzePage.jsx#L21)

### 2. Constrain classification and make degraded operation explicit

Injected response P01 says `Technical Problem. This is not a billing issue.` but parses as **Billing Issue**. P02 says a request is not a technical bug and parses as **Technical Problem** instead of Feature Request. The parser scans the entire explanation and gives billing priority, including negated or incidental words. The single user-role prompt interpolates customer text directly and requires neither a category enum nor structured evidence.

Provider errors silently invoke keyword mocks with random explanations and no provenance field. The fallback routes `No billing problem. The production server is down for everyone.` to Billing. U13 routes an account-compromise report to Feature Request because `address` matches the substring `add` alongside `please`. The UI labels these explanations AI Reasoning and saves them indistinguishably. Missing credentials are worse: initialization throws before the catch block and prevents any UI from rendering.

Opportunity: schema-validated responses, data/instruction separation, explicit source/status, and a review disposition on timeout, malformed output, uncertainty, or unavailable credentials. Keep provider credentials on a server. This reduces wrong-category routing and misleading assurance during failures.

[LLM helper](https://github.com/jimenezatmit/l2assessment/blob/011d920e412a3069bc430e87157b8f4321037c06/src/utils/llmHelper.js#L8) [Analyze flow](https://github.com/jimenezatmit/l2assessment/blob/011d920e412a3069bc430e87157b8f4321037c06/src/pages/AnalyzePage.jsx#L21)

### 3. Make recommended actions depend on risk and disposition

U07 correctly becomes **Feature Request** but receives `Ask user to check billing portal.` U01 receives `Suggest user to restart their browser.` for a production outage. Passing different urgency values never changes these templates; AnalyzePage passes only the category. There is no independent check between classification and displaying the recommended action.

Opportunity: define a small, versioned action catalog with valid category/risk/urgency combinations and human owners. Require an independent policy gate to authorize the final disposition; a category or high-confidence explanation must not authorize a risky action by itself. Surface why a case is held and who should review it. This reduces misleading self-service that delays useful intervention.

[Action templates](https://github.com/jimenezatmit/l2assessment/blob/011d920e412a3069bc430e87157b8f4321037c06/src/utils/templates.js#L5) [Analyze flow](https://github.com/jimenezatmit/l2assessment/blob/011d920e412a3069bc430e87157b8f4321037c06/src/pages/AnalyzePage.jsx#L21)

## Recommended single feature: a policy-enforced routing safety gate

**Proposal only; user approval required before implementation.**

Add a small local backend that owns one final decision path and the Groq credential. Keep this scoped to triage recommendations and a visible human-review disposition; actual paging, queue delivery, production authentication, and deployment require separately specified integrations.

1. **Deterministic backend proposal.** Normalize input while retaining the original, apply explicit category/action rules with matched evidence spans, and propose a category, impact level, action ID, and uncertainty status. Multiple intents, no clear match, and policy-sensitive evidence are explicit states. Keywords propose; they do not prove absence of risk.
2. **LLM safety verification.** Provide a fixed system instruction and customer text as untrusted data. First assess risk from the original message without the proposed verdict, then review the proposal. Validate a strict safe/unsafe/uncertain schema, evidence spans, and a category/action enum. Model confidence is advisory. Missing/invalid evidence, disagreement, timeout, or API failure holds the decision for human review. Do not use freeform reasoning as a parser or fabricate a successful fallback.
3. **Independent risk-policy enforcement.** Ordinary backend code, outside both proposer and LLM, owns the final action. It validates action compatibility and mandatory-review rules against original text and available trusted metadata. Account compromise, data exposure, widespread outages, safety hazards, conflicting intents, and unresolved risk block self-service release. Neither component can downgrade a mandatory hold, including when they agree. Only tightly defined benign intents with supported evidence and policy permission qualify for automatic recommendations. No keyword-only system can guarantee it detected every risk; ambiguous evidence stays in review, and false-consensus testing remains mandatory.
4. **Visible decision and audit record.** Display proposed route, verifier status, final route/action, rule IDs, source/degraded state, and reason for review. Persist request ID, rule/model versions, and outcome for inspection. Store a minimal local assessment audit trail; do not claim this is a production human-review queue or immutable audit store.

Suggested final states: `allow_recommendation`, `human_review_required`, `mandatory_incident_review`, `invalid_input`. A hold must not leave an executable self-service action visible as approved.

### Why agreement is insufficient

The executed false-consensus fixture uses: `No billing question: someone changed my sign-in address and is exporting customer records. Please help.` The current deterministic fallback returns Billing. An injected model response also returns Billing and claims self-service is safe. The current template recommends the billing portal. This is a **controlled demonstration**, not a live verifier test: the baseline has neither a verifier nor an independent enforcer.

The planned feature must hold that case for account-compromise review even if both proposal and verifier say Billing/safe. It must also hold the reverse disagreement (rules report a serious incident while the verifier says safe) and semantic risk found by the verifier when lexical rules miss it. A tie-breaker alone cannot address two components making the same mistake.

### Adversarial acceptance plan after approval

| Family | Concrete cases | Required behavior |
|---|---|---|
| False consensus | Both components say Billing/safe on the account-compromise fixture; both say FAQ/safe on exposed records | Independent mandatory review; no billing-only or FAQ-only release |
| Disagreement | Backend incident/model safe; backend benign/model unsafe or uncertain | Hold; preserve both verdicts and evidence |
| Instruction injection | Customer asks to ignore policy, emits fake system/JSON instructions, claims a manager approved routing | Treat as message data; no policy override |
| Negation and mixed intents | No billing problem + outage; invoice feature request; payment failure plus access loss | Supported category/action or review; no explanation-keyword precedence |
| Tone invariance | Short/polite/capitalized outage; same message on weekend/night; excited praise | Risk unchanged by style or local clock |
| Model/service failures | Missing key, bad JSON, invalid enum, empty response, 429, timeout, 5xx | Visible unavailable/review status; no mock presented as AI; no bypass |
| Evidence attacks | Fabricated spans, Unicode/confusables, quoted historical incidents, non-English messages, ambiguous affected scope | Validate spans, avoid unsupported assurance; hold unresolved cases |
| Benign controls | Business hours, subscription upgrade, CSV feature request | Correct allowlisted action when policy permits; track excess reviews |
| End-to-end integrity | Refresh/history shows final policy decision; client attempts a forged safe verdict | Backend recomputes/enforces; client cannot authorize an action |

Use deterministic injected provider fixtures for fault and false-consensus tests **and** run separately labeled live Groq cases with captured request IDs, model, outcomes, latency, and provenance. An agreement rate is not a safety metric. Record critical false-negative rate, wrong-action rate, review volume, coverage, and latency. Compare baseline and feature on a fixed held-out set reviewed by the user; use stated cost weights to estimate weighted routing loss. Do not claim a reduction in real costs without production labels/cost data. Fixed critical safety cases must have zero unsafe auto-release before review.

### Implementation boundary after explicit approval

Create `feature/routing-safety-gate` from the unchanged baseline in a separate worktree/checkout. Keep this investigation branch for evidence. Add backend, validated verifier contract, independent policy module, minimal UI disposition/provenance, and meaningful adversarial/integration checks. Run the full app with live Groq, inspect saved results, build, and report lint honestly. Push only to the user's fork; open a review PR targeting the user's fork main so the original repository remains unchanged. Do not merge. If a blocker prevents live verification, pause and state which tests could not run.

## Genuine blocker and next action

Live tests cannot run because `VITE_GROQ_API_KEY` is absent. Configure it locally in `work/l2assessment/.env.local` and reply `configured`; do not paste credentials into chat. Reload the running app after configuration (restart if needed) and execute the synthetic set through the UI, preserving real provider provenance and results. No dummy key or intercepted live request should be used to imply a successful run.

The baseline investigation can be reviewed now, but the assessment remains incomplete until live baseline verification, explicit feature approval, implementation, adversarial testing, and an unmerged review PR are complete.

## Full IDE conversation and export

A local visible-message transcript snapshot and a refreshable exporter are delivered alongside this report in outputs. They contain user/assistant messages, not private reasoning or system instructions. Re-run the exporter after this response and again after implementation so the final replies and approval are included. Do not submit a progress summary as a full conversation transcript.

Official Codex CLI instructions: wait for the active turn to finish, run `codex resume 01a1c162-179a-78b3-b901-4e3dd38e3c12`, then `/export /absolute/path/to/assessment-conversation.md`. `/export` also supports clipboard or file selection. See [official export instructions](https://learn.chatgpt.com/docs/developer-commands?surface=cli#export-a-conversation-with-export). If this desktop session is not resumable in the installed CLI, use the delivered local exporter instead; no desktop menu capability is assumed.

The referenced prior ChatGPT chat returned user turns and assistant placeholders rather than full assistant text. Those unavailable messages cannot be reconstructed or honestly claimed as exported. If the assessor requires that earlier discussion, include its original readable export separately.

## Full executed offline message results

| ID | Message | Fallback category | Urgency | Recommendation |
|---|---|---|---|---|
| U01 | Our production server is down | Technical Problem | Low | Suggest user to restart their browser. |
| U02 | Database connection lost | General Inquiry | Low | Respond with FAQ link. |
| U03 | Please help: all customers cannot log in and the service is unavailable. Thank you. | General Inquiry | Low | Respond with FAQ link. |
| U04 | Our customer records are exposed to other accounts. Please contain this incident. | General Inquiry | Medium | Respond with FAQ link. |
| U05 | PAYMENTS ARE FAILING FOR ALL CUSTOMERS | Billing Issue | Low | Ask user to check billing portal. |
| U06 | Thanks! I love the product! Everything works wonderfully! Keep up the great work! | General Inquiry | Medium | Respond with FAQ link. |
| U07 | Could you add an export to CSV feature? Would be really useful for my monthly reports. | Feature Request | Low | Ask user to check billing portal. |
| U08 | My payment failed and now I can't access the dashboard. Is there a bug or do I need to update my credit card? | Billing Issue | Low | Ask user to check billing portal. |
| U09 | What are your business hours? | General Inquiry | Low | Respond with FAQ link. |
| U10 | No billing problem. The production server is down for everyone. | Billing Issue | Medium | Ask user to check billing portal. |
| U11 | Please add invoice export as a feature when convenient. | Billing Issue | Medium | Ask user to check billing portal. |
| U12 | The server is not down; just asking how to download our invoice. | Billing Issue | Medium | Ask user to check billing portal. |
| U13 | Please help: someone changed my sign-in address and is exporting all customer records. | Feature Request | Medium | Ask user to check billing portal. |
| U14 | There is smoke coming from the device. What should I do? | General Inquiry | Low | Respond with FAQ link. |
| U15 | Hi! I was just browsing through your website and noticed you have a really nice design! I especially like the color scheme and the navigation menu! Everything looks so professional and clean! Just wanted to share my positive feedback! | General Inquiry | High | Respond with FAQ link. |
| U16 | Can I upgrade my subscription to the pro plan? | Billing Issue | Low | Ask user to check billing portal. |

All rows above executed unchanged helper code with a controlled provider failure at Monday noon, America/New_York. They are not live app/LLM results. Exact fixtures, expectations, timestamps, checks, and warnings counts are in baseline.json.
