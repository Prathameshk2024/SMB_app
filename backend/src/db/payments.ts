import type { Seller, SellerStatus, SubscriptionPayment } from '@shared/types.js'

/**
 * What a seller's status should become when one of her payments is rejected.
 *
 * Not simply PAYMENT_REJECTED. A seller can have more than one payment on
 * file - a duplicate submission is the ordinary case, someone tapping submit
 * twice on a slow connection - and rejecting the leftover must not revoke an
 * account she has already paid for and had approved.
 *
 * BLOCKED is likewise left alone: a rejection is not the way to un-block
 * somebody, and quietly doing so would undo a deliberate admin decision.
 */
export function sellerStatusAfterReject(
  seller: Seller,
  payments: SubscriptionPayment[],
  rejectedPaymentId: string,
): SellerStatus {
  if (seller.status === 'BLOCKED') return 'BLOCKED'

  // The payment being rejected cannot be the one vouching for her.
  const stillApproved = payments.some(
    (p) =>
      p.id !== rejectedPaymentId &&
      p.sellerId === seller.id &&
      p.status === 'APPROVED',
  )

  return stillApproved ? seller.status : 'PAYMENT_REJECTED'
}
