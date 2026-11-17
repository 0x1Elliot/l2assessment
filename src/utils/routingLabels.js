const dispositions = {
  allow_recommendation: 'Automatic recommendation',
  human_review_required: 'Human review required',
  mandatory_incident_review: 'Mandatory incident review',
  mandatory_security_review: 'Mandatory security review',
  invalid_input: 'Invalid input',
}

export function dispositionLabel(disposition) {
  return dispositions[disposition] ?? 'Legacy result · audit unavailable'
}
