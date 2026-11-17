import { categories, hasExactKeys, isGroundedSpan, matchedSpan, routineActions } from './route-catalog.js'

export const proposalVersion = 'triage-rules-v1'

const categoryRules = {
  'Billing Issue': /\b(?:billing|payments?|invoices?|subscription|refund|credit card)\b/i,
  'Feature Request': /\b(?:feature request|feature|please add|could you add|enhancement)\b/i,
  'Technical Problem': /\b(?:bug|error|outage|server|broken|crash(?:es|ed)?|not working|can.t access|won.t load)\b/i,
}

export function proposeRoute(message) {
  const trimmed = message.trim()
  for (const [actionId, action] of Object.entries(routineActions)) {
    if (action.pattern.test(trimmed)) {
      const start = message.indexOf(trimmed)
      return {
        status: 'candidate',
        category: action.category,
        actionId,
        evidence: [{ start, end: start + trimmed.length }],
      }
    }
  }

  const matches = Object.entries(categoryRules).flatMap(([category, pattern]) => {
    const span = matchedSpan(message, pattern)
    return span ? [{ category, span }] : []
  })
  return {
    status: matches.length > 1 ? 'conflicting' : 'uncertain',
    category: matches.length === 1 ? matches[0].category : 'Unknown',
    actionId: null,
    evidence: matches.map(match => match.span),
  }
}

export function isValidProposal(message, proposal) {
  if (!hasExactKeys(proposal, ['status', 'category', 'actionId', 'evidence']) ||
      !categories.includes(proposal.category) || !Array.isArray(proposal.evidence) ||
      !proposal.evidence.every(span => hasExactKeys(span, ['start', 'end']) && isGroundedSpan(message, span))) {
    return false
  }

  if (proposal.status === 'candidate') {
    return typeof proposal.actionId === 'string' && Object.hasOwn(routineActions, proposal.actionId) &&
      routineActions[proposal.actionId].category === proposal.category && proposal.evidence.length > 0
  }
  return ['uncertain', 'conflicting'].includes(proposal.status) && proposal.actionId === null
}
