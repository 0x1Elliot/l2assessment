import { matchedSpan, routineActions } from './route-catalog.js'

export const policyVersion = 'routing-policy-v1'

const mandatoryRules = [
  {
    id: 'ACCOUNT_COMPROMISE',
    review: 'security',
    patterns: [
      /\baccounts? (?:was |were |is |has been )?(?:hacked|compromised|taken over)\b/i,
      /\baccount (?:takeover|compromise)\b/i,
      /\b(?:unauthori[sz]ed|unrecogni[sz]ed|suspicious) (?:login|sign[ -]?in|access|password change)\b/i,
      /\b(?:some(?:one|body)|an attacker|a hacker) (?:\w+ ){0,4}(?:changed|reset|took over|got into|logged in to|signed in to)\b[^.!?\n]{0,100}\b(?:sign[ -]?in|login|password|email|account|credentials)\b/i,
      /\b(?:email|sign[ -]?in|login|password|credentials)\b[^.!?\n]{0,40}\b(?:changed|reset|modified)\b[^.!?\n]{0,45}\b(?:without (?:my |our )?permission|without authori[sz]ation|wasn.t me)\b/i,
    ],
  },
  {
    id: 'DATA_EXPOSURE',
    review: 'security',
    patterns: [
      /\b(?:data|records|credentials|information|customer files) (?:\w+ ){0,4}(?:exposed|leaked|stolen|publicly accessible|visible to (?:other|another) (?:accounts?|customers?|tenants?)|exported without permission)\b/i,
      /\b(?:expos(?:ing|ed)|leak(?:ing|ed)|stealing|exfiltrat\w*|exporting) (?:\w+ ){0,4}(?:customer (?:data|records|information)|personal (?:data|information)|credentials)\b/i,
      /\bdata (?:breach|leak|exposure)\b/i,
      /\b(?:other|another) (?:account|customer|tenant)\b[^.!?\n]{0,50}\b(?:see|view|access|download)\b[^.!?\n]{0,50}\b(?:records|data|information)\b/i,
    ],
  },
  {
    id: 'PRODUCTION_OUTAGE',
    review: 'incident',
    patterns: [
      /\bproduction (?:outage|incident|(?:\w+ ){0,4}(?:down|offline|unavailable|outage|not responding|stopped working|failing))\b/i,
      /\b(?:server|database|site|service|platform|system) (?:is |are |has gone |went )?(?:down|offline|unavailable|unreachable|not responding)\b/i,
      /\b(?:database connection lost|(?:major|widespread|sitewide|global) outage)\b/i,
      /\b(?:all|every) (?:users?|customers?)\b[^.!?\n]{0,80}\b(?:can.t|cannot|unable to|locked out|failing|unavailable|down|offline|won.t)\b/i,
      /\b(?:fail(?:ing|s|ed)?|unavailable|down|offline) (?:for|across) (?:all|every|everyone)\b/i,
    ],
  },
  {
    id: 'SAFETY_HAZARD',
    review: 'incident',
    patterns: [/\b(?:smoke (?:coming|from)|on fire|electric shock|sparks? (?:coming|from))\b/i],
  },
]

const overridePattern = /\b(?:ignore|disregard|override|bypass)\b[^.!?\n]{0,70}\b(?:policy|instructions?|rules?|verifier|review)|\b(?:system|developer)\s*:|"(?:verdict|disposition|actionId)"\s*:|\b(?:manager|admin) approved\b/i

export function assessPolicy(message) {
  const normalized = message.normalize('NFKC').replace(/\p{Cf}/gu, '')
  const matches = mandatoryRules.flatMap(({ id, review, patterns }) => {
    const pattern = patterns.find(pattern => pattern.test(normalized))
    if (!pattern) return []
    // Offsets always refer to the original message. A normalized-only match has no raw span.
    return [{ id, review, evidence: matchedSpan(message, pattern) }]
  })
  if (matches.length > 0) return { matches, eligibleAction: null }

  if (overridePattern.test(normalized)) {
    return { matches: [{ id: 'INSTRUCTION_OVERRIDE', review: 'support', evidence: matchedSpan(message, overridePattern) }], eligibleAction: null }
  }

  const allowed = Object.entries(routineActions).find(([, action]) => action.pattern.test(message.trim()))
  return { matches: [], eligibleAction: allowed?.[0] ?? null }
}
