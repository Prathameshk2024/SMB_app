/**
 * REPORTING WHAT SHOULD NOT BE HERE.
 *
 * Anyone can list anything in this market, and the only people who see a
 * listing before an admin does are the buyers looking at it. So a buyer needs
 * a way to say "this is wrong" from the screen where she found it - which is
 * also what Google Play requires of any app carrying content its users write:
 * an in-app way to flag objectionable content, and someone who acts on it.
 *
 * A REASON IS ALWAYS REQUIRED, picked from a list. "Spoiled food" and "not
 * her photograph" are different problems with different answers, and a queue
 * of reports that all say "inappropriate" cannot be triaged by anybody.
 * `other` is the escape hatch and the only one that needs typed words, for
 * the same reason cancelling an order does: a list can never name everything.
 *
 * FOUR THINGS CAN BE REPORTED, and each has its own list, because the
 * questions differ. A listing can be unsafe to eat; a shop can take money and
 * send nothing; a buyer can order and never take delivery. Showing a buyer
 * "does not look safe to eat" about a seller she is reporting for abuse is a
 * list that names nothing she means.
 */

/** Every reason any report may carry. The per-target lists below pick from it. */
export const ALL_REPORT_REASONS = [
  'unsafe',
  'wrongInfo',
  'notTheirs',
  'offensive',
  'scam',
  'noDelivery',
  'abusive',
  'noShow',
  'falsePayment',
  'other',
] as const

export type ReportReason = (typeof ALL_REPORT_REASONS)[number]

/**
 * What can be reported. A product and a review are things one user wrote for
 * others to read; a seller and a customer are the people behind them - which
 * Play's User Generated Content policy asks for too: a way to report the
 * account, not only the post.
 */
export const REPORT_TARGETS = ['product', 'review', 'seller', 'customer'] as const
export type ReportTarget = (typeof REPORT_TARGETS)[number]

/**
 * Reasons per target. Codes, never sentences, so each reader sees them in
 * their own language - the seller app, the buyer app and the console each
 * carry a `report.reason.<code>` line.
 *
 * `seller` and `customer` reports are about a PERSON, so the lists say what
 * she did rather than what the thing is: a shop that took money and sent
 * nothing, a buyer who ordered and never opened the door. Both keep `scam`
 * and `other`, and a shop keeps the listing reasons that are really about the
 * shop - the photo or the whole shop belonging to someone else.
 */
export const REPORT_REASONS_FOR: Record<ReportTarget, readonly ReportReason[]> = {
  product: ['unsafe', 'wrongInfo', 'notTheirs', 'offensive', 'scam', 'other'],
  review: ['offensive', 'wrongInfo', 'scam', 'other'],
  seller: ['notTheirs', 'wrongInfo', 'noDelivery', 'offensive', 'scam', 'other'],
  customer: ['noShow', 'falsePayment', 'abusive', 'scam', 'other'],
}

/**
 * The listing list, under the name the report sheet has always imported. A
 * screen that has not yet learned to ask `reasonsFor(target)` still shows a
 * complete list for the two targets it knew about.
 */
export const REPORT_REASONS = REPORT_REASONS_FOR.product

export function reasonsFor(target: ReportTarget): readonly ReportReason[] {
  return REPORT_REASONS_FOR[target]
}

/**
 * Who may report what.
 *
 * A buyer reports what she is shown: listings, reviews, the shop itself. A
 * seller reports what is done TO her: a review written about her products,
 * and a buyer she has dealt with on an order. Nobody reports somebody they
 * have never met through the app - the server checks the order exists.
 */
export const REPORTABLE_BY: Record<ReportTarget, readonly ('customer' | 'seller')[]> = {
  product: ['customer'],
  review: ['customer', 'seller'],
  seller: ['customer'],
  customer: ['seller'],
}

export function mayReport(byRole: 'customer' | 'seller', target: ReportTarget): boolean {
  return REPORTABLE_BY[target].includes(byRole)
}

/** Long enough to explain, short enough to read in a queue. */
export const MIN_REPORT_NOTE = 5
export const MAX_REPORT_NOTE = 200

/**
 * Is this a reason at all - and, given a target, one that target accepts?
 * A reason from the wrong list is refused the same as an invented one: the
 * admin reading "does not look safe to eat" on a report about a buyer has
 * been told nothing.
 */
export function isReportReason(v: unknown, target?: ReportTarget): v is ReportReason {
  if (!ALL_REPORT_REASONS.includes(v as ReportReason)) return false
  return target ? REPORT_REASONS_FOR[target].includes(v as ReportReason) : true
}

export function isReportTarget(v: unknown): v is ReportTarget {
  return REPORT_TARGETS.includes(v as ReportTarget)
}

/**
 * Both sides check this: the sheet so she is told before she sends, the
 * server because a client can send anything. `target` narrows the reasons to
 * that target's list; without it any known reason passes, which is what a
 * sheet drawn from `REPORT_REASONS` alone needs.
 */
export function reportProblems(
  input: { reason?: unknown; note?: unknown },
  target?: ReportTarget,
): Record<string, string> {
  const fields: Record<string, string> = {}
  if (!isReportReason(input.reason, target)) {
    fields.reason = 'कारण निवडा'
    return fields
  }
  if (input.reason === 'other') {
    const note = String(input.note ?? '').trim()
    if (note.length < MIN_REPORT_NOTE) fields.note = 'काय अडचण आहे ते थोडक्यात लिहा'
    else if (note.length > MAX_REPORT_NOTE) fields.note = `${MAX_REPORT_NOTE} अक्षरांपेक्षा कमी लिहा`
  }
  return fields
}
