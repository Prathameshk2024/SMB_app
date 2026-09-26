/**
 * THE POLICIES SHE AGREED TO
 * ==========================
 * The privacy policy, the terms, the seller agreement, the refund policy and
 * the grievance page are one set with one version. The text itself lives in
 * `frontend/src/legal/`; this file is only the version and the rule for
 * whether a person has accepted it, because the server enforces it and the
 * app draws the acceptance screen from it.
 *
 * WHY ONE VERSION FOR THE SET. The documents refer to each other - the terms
 * say refunds are the seller's, the refund policy says how - and a woman
 * asked to accept five things separately is asked five times to read what
 * she will not read. One version, one tap, and a record of which set it was.
 *
 * WHY A RECORD AT ALL. The DPDP Act 2023 makes consent something the operator
 * has to be able to show, not assume. `acceptedPolicies` on her own record is
 * that proof: which version, and when. It is not personal data - it survives
 * an account being closed, like the money trail, because it is the evidence
 * that the data was held on her say-so while it was held.
 *
 * CHANGING THE TEXT. Bump `POLICY_VERSION` only for a change that alters what
 * somebody agreed to - what is collected, who sees it, what she pays, what
 * she is responsible for. Every signed-in person then meets the acceptance
 * screen once more. A spelling fix or a clearer sentence is not a new version:
 * asking again for nothing teaches people to tap "I agree" without looking.
 */

/** The date the current text took effect, which is also its name. */
export const POLICY_VERSION = '2026-09-26'

export interface PolicyAcceptance {
  version: string
  /** ISO timestamp, from the server's clock. */
  at: string
}

/** True while this person has not accepted the set that is in force now. */
export function needsPolicyAcceptance(accepted: PolicyAcceptance | undefined): boolean {
  return accepted?.version !== POLICY_VERSION
}

export function acceptNow(now = new Date()): PolicyAcceptance {
  return { version: POLICY_VERSION, at: now.toISOString() }
}

/**
 * The body's answer to "do you agree", read strictly. Only a literal `true`
 * counts: a missing field is an older app that never showed the checkbox, and
 * treating that as yes would record consent nobody gave.
 */
export function saidYes(body: unknown): boolean {
  return (body as { acceptPolicies?: unknown } | null)?.acceptPolicies === true
}

export const POLICY_REFUSED_MR =
  'पुढे जाण्यासाठी अटी आणि गोपनीयता धोरण मान्य करा.'
