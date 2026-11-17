import { randomUUID } from 'node:crypto'
import { routineActions } from './route-catalog.js'
import { isValidProposal, proposalVersion, proposeRoute } from './rule-proposal.js'
import { assessPolicy, policyVersion } from './routing-policy.js'

const reviewRoutes = {
  security: { disposition: 'mandatory_security_review', category: 'Security Incident', owner: 'Security team' },
  incident: { disposition: 'mandatory_incident_review', category: 'Technical Problem', owner: 'Incident response team' },
  support: { disposition: 'human_review_required', owner: 'Support team' },
}
const descriptions = {
  ACCOUNT_COMPROMISE: 'The message indicates possible unauthorized access or changes to an account.',
  DATA_EXPOSURE: 'The message indicates possible exposure or unauthorized export of sensitive data.',
  PRODUCTION_OUTAGE: 'The message indicates a production outage or widespread service disruption.',
  SAFETY_HAZARD: 'The message indicates a possible physical safety hazard.',
  INSTRUCTION_OVERRIDE: 'The message contains instructions that could interfere with routing.',
  PROPOSAL_INVALID: 'The rules produced an invalid routing proposal.',
  CONFLICTING_INTENTS: 'The rules found more than one possible intent.',
  OUTSIDE_ALLOWLIST: 'The message did not qualify for a routine recommendation.',
  VERIFIER_UNAVAILABLE: 'Groq is not configured.',
  VERIFIER_TIMEOUT: 'Groq did not respond within the verification time limit.',
  VERIFIER_PROVIDER_ERROR: 'Groq could not complete verification.',
  VERIFIER_INVALID_OUTPUT: 'Groq did not return a valid verdict with supporting evidence.',
  VERIFIER_UNCERTAIN: 'The verifier could not establish a safe recommendation.',
  VERIFIER_UNSAFE: 'The verifier identified risk in the original message.',
  VERIFIER_SECURITY_RISK: 'The verifier identified a possible security incident.',
  VERIFIER_INCIDENT_RISK: 'The verifier identified a possible outage or physical safety hazard.',
  VERIFIER_DISAGREEMENT: 'The verifier did not support the proposed category and action.',
  ROUTINE_VERIFIED: 'The backend policy permits this routine action and the verifier supports it.',
  INVALID_INPUT: 'Submit a nonempty message with no more than 4,000 characters.',
  INTERNAL_ERROR: 'The server could not complete the routing decision.',
}
const verifierFailures = {
  missing_credentials: 'VERIFIER_UNAVAILABLE',
  timeout: 'VERIFIER_TIMEOUT',
  provider_error: 'VERIFIER_PROVIDER_ERROR',
  invalid_output: 'VERIFIER_INVALID_OUTPUT',
}

function decisionContext() {
  return { requestId: randomUUID(), timestamp: new Date().toISOString() }
}

function hold(context, reasonCode, reviews = ['support']) {
  const routes = reviews.map(review => reviewRoutes[review])
  const primary = routes[0]
  const reviewOwners = routes.map(route => route.owner)
  return {
    ...context,
    disposition: primary.disposition,
    reasonCode,
    category: primary.category ?? context.proposal?.category ?? 'Unknown',
    urgency: reviews[0] === 'support' ? 'Medium' : 'High',
    actionId: null,
    recommendedAction: `Requires review by the ${reviewOwners.join(' and ')}.`,
    reviewOwners,
    reasoning: descriptions[reasonCode],
  }
}

function invalidDecision(context) {
  return {
    ...context,
    disposition: 'invalid_input',
    reasonCode: 'INVALID_INPUT',
    category: 'Unknown',
    urgency: null,
    actionId: null,
    recommendedAction: null,
    reviewOwners: [],
    reasoning: descriptions.INVALID_INPUT,
  }
}

export function resolveRoute(context) {
  const { policy, proposal, verifier } = context

  // Mandatory review takes precedence even if both advisors agree on a routine action.
  if (policy.matches.length > 0) {
    const reviews = [...new Set(policy.matches.map(match => match.review))]
    return hold(context, policy.matches[0].id, reviews)
  }
  if (!proposal) return hold(context, 'PROPOSAL_INVALID')

  if (Object.hasOwn(verifierFailures, verifier.status)) {
    return hold(context, verifierFailures[verifier.status])
  }

  const risk = verifier.risk?.risk
  if (risk === 'security') return hold(context, 'VERIFIER_SECURITY_RISK', ['security'])
  if (risk === 'incident') return hold(context, 'VERIFIER_INCIDENT_RISK', ['incident'])
  if (risk === 'unsafe') return hold(context, 'VERIFIER_UNSAFE')
  if (verifier.status !== 'completed' || risk !== 'low_risk') return hold(context, 'VERIFIER_UNCERTAIN')

  if (proposal.status === 'conflicting') return hold(context, 'CONFLICTING_INTENTS')
  if (proposal.status !== 'candidate' || proposal.actionId !== policy.eligibleAction) {
    return hold(context, 'OUTSIDE_ALLOWLIST')
  }

  const { review } = verifier
  if (review?.verdict === 'uncertain') return hold(context, 'VERIFIER_UNCERTAIN')
  if (review?.verdict !== 'supports' || review.category !== proposal.category ||
      review.actionId !== proposal.actionId) {
    return hold(context, 'VERIFIER_DISAGREEMENT')
  }

  return {
    ...context,
    disposition: 'allow_recommendation',
    reasonCode: 'ROUTINE_VERIFIED',
    category: proposal.category,
    urgency: 'Low',
    actionId: proposal.actionId,
    recommendedAction: routineActions[proposal.actionId].text,
    reviewOwners: [],
    reasoning: descriptions.ROUTINE_VERIFIED,
  }
}

export const maxMessageLength = 4000

export async function triageMessage(message, verifier, propose = proposeRoute) {
  const context = {
    ...decisionContext(),
    policyVersion,
    proposalVersion,
    proposal: null,
    policy: null,
    verifier: { ...verifier.provenance, status: 'not_run' },
  }
  if (typeof message !== 'string' || message.length > maxMessageLength || !message.trim()) {
    return invalidDecision(context)
  }

  try {
    context.policy = assessPolicy(message)
    const proposal = propose(message)
    context.proposal = isValidProposal(message, proposal) ? proposal : null
    if (context.policy.matches.length === 0 && context.proposal) {
      const candidate = context.proposal.actionId === context.policy.eligibleAction &&
        context.proposal.status === 'candidate' ? context.proposal : null
      context.verifier = await verifier.verify(message, candidate)
    }
    return resolveRoute(context)
  } catch {
    if (context.policy?.matches.length) return resolveRoute(context)
    return hold(context, 'INTERNAL_ERROR')
  }
}
