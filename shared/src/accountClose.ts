import type { Order, OrderStatus } from './types.js'

/**
 * CLOSING AN ACCOUNT
 * ==================
 * Google Play requires that an app which lets people make an account lets them
 * delete it, from inside the app and from a web page anyone can open. This
 * file is the rule both sides read; `backend/src/db/accountClose.ts` applies it.
 *
 * WHAT "DELETED" MEANS HERE. The row stays and the person is erased. Three
 * reasons, in order of weight:
 *
 * 1. A past order is the BUYER's record as much as the seller's, and the ₹50
 *    payments are the programme's accounts. Both outlive her account, and
 *    Play allows keeping what accounting and the other party need as long as
 *    the privacy policy says so.
 * 2. Removing rows can be REFUSED. A single persist may not delete more than
 *    half a collection (`isBulkDelete`), and a seller with five listings in a
 *    small catalogue is more than half of it. A delete that sometimes does not
 *    delete is worse than none.
 * 3. Orders and the admin console look a seller up by id. An id pointing at
 *    nothing is a blank shop name on somebody else's order screen.
 *
 * So `scrubSeller` empties every field that is *her* - phone, name, photo,
 * address, UPI, the readiness answers, an admin's notes about her - and leaves
 * an id, a status of CLOSED and the money trail. Her phone number goes back
 * into circulation: registration checks it against stored phones, and hers is
 * now blank, so she can start again from scratch if she ever wants to.
 *
 * THE SEVEN DAYS. Her shop closes the moment she asks - hidden from the
 * catalogue, signed out everywhere - but the erasing happens a week later, and
 * signing in during that week offers to stop it. Two confirmation screens and
 * four typed digits stop a stray tap; nothing but time helps a woman who
 * tapped through all of them without understanding what her shop was worth to
 * her. A customer gets no window: an address list is not a livelihood.
 */

export const UNDO_DAYS = 7

/** What she is asked before it happens. Codes, so each side reads its own language. */
export const CLOSE_REASONS = [
  'not_selling',
  'too_hard',
  'no_orders',
  'made_another',
  'personal',
  'other',
] as const

export type CloseReason = (typeof CLOSE_REASONS)[number]

export const CLOSE_NOTE_MIN = 5
export const CLOSE_NOTE_MAX = 200

/** Dictionary key for a reason code. */
export function closeReasonKey(reason: string): string {
  return `close.reason.${reason}`
}

/**
 * An order nobody has to do anything about any more.
 *
 * Deleting an account with an order in flight strands the other side: a buyer
 * waiting for a delivery, or a seller who has cooked for one. She finishes or
 * cancels it first - both are buttons she already has.
 */
export function orderIsFinished(status: OrderStatus): boolean {
  return status === 'DELIVERED' || status === 'REJECTED' || status === 'CANCELLED'
}

export function openOrders(orders: Order[]): Order[] {
  return orders.filter((o) => !orderIsFinished(o.status))
}

/**
 * THE LAST STEP: the final four digits of her own number.
 *
 * Every other candidate was worse for this reader. Typing a whole word is a
 * literacy test. A second OTP is an SMS against a three-a-day ceiling, and it
 * proves possession of a phone she is already signed in on. Her own number she
 * knows by heart, and four correct digits are not something a thumb produces
 * by accident in a kitchen.
 *
 * Checked on the server too, because the app can be bypassed.
 */
export function confirmDigits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-4)
}

export function confirmProblem(phone: string, typed: unknown): string | null {
  const digits = typeof typed === 'string' ? typed.replace(/\D/g, '') : ''
  if (digits.length !== 4) return 'तुमच्या नंबरचे शेवटचे 4 अंक टाका'
  if (digits !== confirmDigits(phone)) return 'हे अंक तुमच्या नंबरशी जुळत नाहीत'
  return null
}

/** What is wrong with the reason she picked, in Marathi, or null. */
export function closeReasonProblem(reason: unknown, note: unknown): string | null {
  if (typeof reason !== 'string' || !(CLOSE_REASONS as readonly string[]).includes(reason)) {
    return 'खाते बंद करण्याचे कारण निवडा'
  }
  if (reason !== 'other') return null
  const text = typeof note === 'string' ? note.trim() : ''
  if (text.length < CLOSE_NOTE_MIN) return 'कारण थोडक्यात लिहा'
  if (text.length > CLOSE_NOTE_MAX) return `कारण ${CLOSE_NOTE_MAX} अक्षरांपेक्षा लहान लिहा`
  return null
}

/** When the erasing happens, given the moment she asked. */
export function scrubDueAt(requestedAt: number): string {
  return new Date(requestedAt + UNDO_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/** Days left of the window, rounded up, never below zero - what her screen says. */
export function daysUntilScrub(closingAt: string, now = Date.now()): number {
  const left = new Date(closingAt).getTime() - now
  return left <= 0 ? 0 : Math.ceil(left / (24 * 60 * 60 * 1000))
}

/**
 * Every field on a seller that is the woman rather than the shop's history.
 *
 * One list so that the scrub and the test that guards it cannot drift: a field
 * added to `Seller` and forgotten here is a phone number surviving a deletion,
 * and `backend/tests/account-close.test.ts` fails the day that happens.
 *
 * `shopName` and `name` are not in it - they are replaced by a placeholder
 * rather than emptied, because a buyer's own order screen still has to say who
 * she bought from. `womenBizId` stays: it is the programme's serial, it is
 * printed on packaging that has already gone out, and it names a village, not
 * a woman.
 */
export const SELLER_PII_FIELDS = [
  'phone',
  'whatsapp',
  'photo',
  'age',
  'education',
  'village',
  'villageCode',
  'taluka',
  'district',
  'pincode',
  'about',
  'shgName',
  'yearsInBusiness',
  'monthlyCapacity',
  'upiId',
  'upiQrUrl',
  'upiQrPublicId',
  'digital',
  'pincodes',
  'notices',
  'blockReason',
] as const

/** The same, for a payment row: the ledger keeps the money, not the payer. */
export const PAYMENT_PII_FIELDS = ['phone', 'payerUpi', 'screenshotUrl'] as const

/** And for the buyer's copies carried on an order she placed. */
export const ORDER_BUYER_PII_FIELDS = ['customerPhone', 'address'] as const

/* ------------------------------------------------------------------ */
/* Closing an account for somebody who cannot sign in                 */
/* ------------------------------------------------------------------ */

/**
 * WHEN STAFF CLOSE IT FOR HER.
 *
 * The public deletion page and the privacy policy promise that a woman who
 * has lost her phone, or whose OTP never arrives, can ask by phone, WhatsApp
 * or email and have the account closed. Without her phone there is no OTP, so
 * a person has to stand where the OTP would: staff ring back the REGISTERED
 * number and hear her confirm it. Anyone can send an email naming somebody
 * else's number, and closing a rival's shop must not be one message away.
 *
 * So the console asks for three things, and the server refuses without them:
 * how the request arrived (kept on the record), a tick that the call-back
 * happened, and - for a seller, whose page the admin already has open - the
 * last four digits of her number typed, the same stray-click guard her own
 * button uses. What happens next is exactly what her own button does: a
 * seller gets the seven days, a buyer does not.
 */
export const ADMIN_CLOSE_CHANNELS = ['phone', 'whatsapp', 'email'] as const
export type AdminCloseChannel = (typeof ADMIN_CLOSE_CHANNELS)[number]

export interface AdminCloseInput {
  channel?: unknown
  /** Staff rang the registered number back and she confirmed. */
  verified?: unknown
  /** Last four digits of the account's number, typed. Seller only. */
  confirm?: unknown
  /** Anything worth keeping about the request. Optional. */
  note?: unknown
}

export const ADMIN_CLOSE_NOTE_MAX = 120

/** What is wrong with a staff close, or null. English first, then Marathi. */
export function adminCloseProblem(
  input: AdminCloseInput,
  phone: string,
  opts: { needsDigits: boolean },
): { error: string; messageMr: string } | null {
  if (typeof input.channel !== 'string' || !(ADMIN_CLOSE_CHANNELS as readonly string[]).includes(input.channel)) {
    return { error: 'Say how the request arrived', messageMr: 'विनंती कशी आली ते निवडा' }
  }
  if (input.verified !== true) {
    return {
      error: 'Ring the registered number back and confirm it is her first',
      messageMr: 'आधी नोंदणी केलेल्या नंबरवर फोन करून खात्री करा',
    }
  }
  if (opts.needsDigits) {
    const typed = typeof input.confirm === 'string' ? input.confirm.replace(/\D/g, '') : ''
    if (typed.length !== 4 || typed !== confirmDigits(phone)) {
      return {
        error: 'The last 4 digits do not match this account\'s number',
        messageMr: 'शेवटचे 4 अंक या खात्याच्या नंबरशी जुळत नाहीत',
      }
    }
  }
  if (typeof input.note === 'string' && input.note.trim().length > ADMIN_CLOSE_NOTE_MAX) {
    return {
      error: `Keep the note under ${ADMIN_CLOSE_NOTE_MAX} characters`,
      messageMr: `टीप ${ADMIN_CLOSE_NOTE_MAX} अक्षरांपेक्षा लहान लिहा`,
    }
  }
  return null
}

/**
 * The line kept on a seller's record, in the `other` reason's note. It names
 * the channel and the staff member, so "who closed this shop?" has an answer
 * after the admin who did it has left, and it fits CLOSE_NOTE_MAX.
 */
export function adminCloseNote(channel: AdminCloseChannel, by: string, note?: string): string {
  const extra = note?.trim() ? ` · ${note.trim()}` : ''
  return `Closed by staff on request (${channel}) · ${by}${extra}`.slice(0, CLOSE_NOTE_MAX)
}
