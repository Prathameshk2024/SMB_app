import { Router } from 'express'
import type { Product, Seller } from '@shared/types.js'
import { getDb } from '../db/store.js'
import { CATEGORIES } from '../db/seed.js'

/** Public, unauthenticated. This is what a shopper and a scanned QR both hit. */
export const catalogRouter: Router = Router()

/**
 * WHAT THE PUBLIC MAY SEE, IN ONE PLACE.
 *
 * The list and the by-id lookup each decided this for themselves, and a
 * listing hidden from one but readable from the other is not hidden - it is
 * findable by anyone who tries the id. A draft, a rejected product and a
 * paused one are all things a seller has chosen not to show, and a blocked or
 * closed shop is a decision about the whole shop.
 *
 * Both conditions matter. A LIVE product under a BLOCKED seller is still off
 * the shelf, and a shop that has closed for the afternoon takes its whole
 * window with it.
 */
export function publiclyVisible(
  product: Pick<Product, 'status'> | undefined,
  seller: Pick<Seller, 'status' | 'isOpen'> | undefined,
): boolean {
  if (!product || !seller) return false
  return product.status === 'LIVE' && seller.status === 'ACTIVE' && !!seller.isOpen
}

catalogRouter.get('/categories', (_req, res) => {
  res.json({ categories: CATEGORIES })
})

catalogRouter.get('/products', (req, res) => {
  const db = getDb()
  const { categoryId, q, pincode, sellerId } = req.query as Record<string, string | undefined>

  const sellerById = new Map(db.sellers.map((s) => [s.id, s]))

  let list = db.products.filter((p) => publiclyVisible(p, sellerById.get(p.sellerId)))

  if (categoryId) list = list.filter((p) => p.categoryId === categoryId)

  // One shop's window: the "more from this shop" strip and the shop page.
  // Filtered here rather than in the browser because a phone on rural 4G
  // should not download the whole catalogue to show three products.
  if (sellerId) list = list.filter((p) => p.sellerId === sellerId)

  if (pincode) {
    const serviceable = new Set(
      db.sellers.filter((s) => s.pincodes.includes(pincode)).map((s) => s.id),
    )
    list = list.filter((p) => serviceable.has(p.sellerId))
  }

  if (q?.trim()) {
    const needle = q.trim().toLowerCase()
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.nameEn ?? '').toLowerCase().includes(needle),
    )
  }

  // Attach the seller card each listing needs, which
  // the law requires to be displayed on every food listing.
  const withSeller = list.map((p) => {
    const s = db.sellers.find((x) => x.id === p.sellerId)
    return {
      ...p,
      seller: s && {
        id: s.id,
        womenBizId: s.womenBizId,
        name: s.name,
        photo: s.photo,
        shopName: s.shopName,
        shopSlug: s.shopSlug,
        village: s.village,
        rating: s.rating,
        ratingCount: s.ratingCount,
        deliveryFee: s.deliveryFee,
        freeDeliveryAbove: s.freeDeliveryAbove,
        minOrder: s.minOrder,
        // The cart and checkout run entirely off this card: serviceability
        // needs the pincode list, and the UPI block needs her handle and
        // whether she has actually set her payment QR up.
        pincodes: s.pincodes,
        upiId: s.upiId,
        upiQrReady: s.upiQrReady,
        // The image she uploaded, so checkout can show HER bank's QR rather
        // than one this app drew. Public on purpose: it is the thing a buyer
        // has to scan to pay her.
        upiQrUrl: s.upiQrUrl,
      },
    }
  })

  res.json({ products: withSeller })
})

catalogRouter.get('/products/:id', (req, res) => {
  const db = getDb()
  const product = db.products.find((p) => p.id === req.params.id)
  const seller = product && db.sellers.find((s) => s.id === product.sellerId)

  // 404, not 403, and the same 404 whether the id is unknown or merely not
  // public: telling the difference confirms that a hidden listing exists.
  if (!publiclyVisible(product, seller)) {
    res.status(404).json({ error: 'Product not found', messageMr: 'हे उत्पादन सापडले नाही' })
    return
  }

  res.json({ product, seller })
})

// GET /addresses used to live here. It had no auth check and returned the same
// two seeded addresses to every caller, which checkout then showed as "your
// saved addresses". Addresses belong to a customer now: GET /api/customers/me.

/**
 * Share-QR landing. Records the scan, then the client redirects to the shop.
 * In production this endpoint also stamps the Play Store referrer so the
 * Install Referrer API can route a fresh install to her shop.
 */
catalogRouter.post('/share/:slug/scan', (req, res) => {
  const db = getDb()
  const seller = db.sellers.find((s) => s.shopSlug === req.params.slug)
  if (!seller) {
    res.status(404).json({ error: 'Shop not found' })
    return
  }
  seller.qrScans += 1
  res.json({ ok: true, shopSlug: seller.shopSlug })
})

/**
 * Pincode serviceability.
 *
 * Derived from the sellers who actually cover the pincode, never a static
 * list: a pincode is "serviceable" exactly when at least one ACTIVE, open
 * seller delivers there and has something live to sell. The customer app asks
 * this once, stores the answer, and every later screen reuses it.
 */
catalogRouter.get('/serviceability', (req, res) => {
  const pincode = String(req.query.pincode ?? '').trim()

  if (!/^[1-9]\d{5}$/.test(pincode)) {
    res.status(400).json({
      error: 'Invalid pincode',
      messageMr: '6 अंकी पिनकोड टाका',
      fields: { pincode: 'invalid' },
    })
    return
  }

  const db = getDb()
  const sellers = db.sellers.filter(
    (s) => s.status === 'ACTIVE' && s.isOpen && s.pincodes.includes(pincode),
  )
  const sellerIds = new Set(sellers.map((s) => s.id))
  const productCount = db.products.filter(
    (p) => p.status === 'LIVE' && sellerIds.has(p.sellerId),
  ).length

  res.json({
    pincode,
    serviceable: sellers.length > 0 && productCount > 0,
    sellerCount: sellers.length,
    productCount,
    // Shown when nothing is available, so she knows where the platform HAS
    // reached rather than just being told "no".
    nearbyVillages: [
      ...new Set(
        db.sellers
          .filter((s) => s.status === 'ACTIVE' && s.isOpen)
          .flatMap((s) => s.pincodes.map((pc) => `${s.village} (${pc})`)),
      ),
    ].slice(0, 6),
  })
})
