export const categories = [
  'General Inquiry', 'Billing Issue', 'Feature Request', 'Technical Problem', 'Unknown'
]

export const routineActions = {
  FAQ: {
    category: 'General Inquiry',
    pattern: /^(?:hi[,.!]? )?(?:what are your (?:business|support|opening) hours|when are you open|(?:your )?business hours)[?!.]*$/i,
    text: 'Respond with FAQ link.',
  },
  SUBSCRIPTION_UPGRADE: {
    category: 'Billing Issue',
    pattern: /^(?:can i|how (?:can|do) i) upgrade (?:my|our) subscription(?: to the [a-z0-9-]+ plan)?[?!.]*$/i,
    text: 'Share the subscription upgrade instructions.',
  },
  CSV_FEATURE_REQUEST: {
    category: 'Feature Request',
    pattern: /^(?:could|can) you add (?:an? )?(?:export to csv|csv export)(?: feature)?[?!.]*(?: would be really useful for my monthly reports\.)?$/i,
    text: 'Record the CSV export request for the product team.',
  },
}

export function matchedSpan(message, pattern) {
  const match = pattern.exec(message)
  return match && { start: match.index, end: match.index + match[0].length }
}

export function isGroundedSpan(message, span) {
  return Boolean(span && Number.isInteger(span.start) && Number.isInteger(span.end) &&
    span.start >= 0 && span.end <= message.length && span.end > span.start &&
    message.slice(span.start, span.end).trim())
}

export function hasExactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}
