import { dispositionLabel } from '../utils/routingLabels'

function formatEvidence(message, spans) {
  return spans.filter(Boolean).map(({ start, end }) => `“${message.slice(start, end)}”`).join(', ')
}

export default function RoutingDecision({ result }) {
  if (!result.disposition) {
    return <p className="text-sm text-gray-700">{dispositionLabel()}</p>
  }

  const { proposal, policy, verifier, message } = result
  const verification = [verifier?.status, verifier?.risk?.risk, verifier?.review?.verdict].filter(Boolean).join(' · ')
  const policyMatches = policy?.matches.map(match => match.id).join(', ')

  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 p-4" aria-label="Routing decision">
      <h3 className="font-semibold text-gray-900">{dispositionLabel(result.disposition)}</h3>
      <p className="mt-1 text-sm text-gray-700">
        <code>{result.reasonCode}</code> · {result.reasoning}
      </p>
      {result.reviewOwners?.length > 0 && (
        <p className="mt-2 text-sm text-gray-700">Review owner — {result.reviewOwners.join(' and ')}</p>
      )}
      <details className="mt-3 text-sm text-gray-700">
        <summary className="cursor-pointer font-medium">Routing audit</summary>
        <dl className="mt-2 grid gap-2">
          <div><dt className="font-semibold">Request ID</dt><dd className="break-all">{result.requestId}</dd></div>
          <div>
            <dt className="font-semibold">Rules · {result.proposalVersion}</dt>
            <dd>{proposal ? [proposal.status, proposal.category, proposal.actionId].filter(Boolean).join(' · ') : 'No valid proposal'}</dd>
            {proposal?.evidence.length > 0 && <dd>{formatEvidence(message, proposal.evidence)}</dd>}
          </div>
          <div>
            <dt className="font-semibold">Policy · {result.policyVersion}</dt>
            <dd>{policyMatches || policy?.eligibleAction || 'No eligible automatic action'}</dd>
            {policyMatches && <dd>{formatEvidence(message, policy.matches.map(match => match.evidence))}</dd>}
          </div>
          <div>
            <dt className="font-semibold">Verifier · {verifier?.provider} · {verifier?.model} · {verifier?.version}</dt>
            <dd>
              {verification}
              {verifier?.stage && ` · ${verifier.stage} check`}
              {verifier?.providerStatus && ` · HTTP ${verifier.providerStatus}`}
              {Number.isInteger(verifier?.durationMs) && ` · ${verifier.durationMs} ms`}
            </dd>
            {verifier?.risk && <dd>{formatEvidence(message, verifier.risk.evidence)}</dd>}
            {verifier?.review && (
              <dd>{verifier.review.category} · {verifier.review.actionId ?? 'No action'} {formatEvidence(message, verifier.review.evidence)}</dd>
            )}
          </div>
        </dl>
      </details>
    </section>
  )
}
