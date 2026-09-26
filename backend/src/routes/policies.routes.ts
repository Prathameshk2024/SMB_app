import { Router } from 'express'
import { POLICY_REFUSED_MR, saidYes } from '@shared/legal.js'
import { getDb, save } from '../db/store.js'
import { recordAcceptance } from '../db/policies.js'
import { requireRole } from '../middleware/auth.js'

/**
 * "I AGREE", FROM SOMEBODY ALREADY SIGNED IN.
 *
 * Registration records acceptance on its own (the seller wizard's review
 * screen, the customer's name screen). This route is for everyone else: the
 * people who registered before the policies existed, and everyone again each
 * time POLICY_VERSION moves. The acceptance screen in both apps calls it.
 */
export const policiesRouter: Router = Router()

policiesRouter.post('/accept', requireRole('seller', 'customer'), (req, res) => {
  if (!saidYes(req.body)) {
    res.status(400).json({ error: 'Policies not accepted', messageMr: POLICY_REFUSED_MR })
    return
  }

  const auth = req.auth!
  const db = getDb()
  const accepted = auth.role === 'seller'
    ? recordAcceptance(db, { role: 'seller', sellerId: auth.sellerId! })
    : recordAcceptance(db, { role: 'customer', customerId: auth.customerId!, phone: auth.phone ?? '' })

  if (!accepted) {
    res.status(404).json({ error: 'Account not found', messageMr: 'खाते सापडले नाही.' })
    return
  }

  save()
  res.json({ acceptedPolicies: accepted })
})
