/**
 * WHO RUNS THIS MARKET, AND WHO ANSWERS FOR IT.
 *
 * The Consumer Protection (E-Commerce) Rules 2020 and the IT (Intermediary
 * Guidelines) Rules 2021 both require the operator's legal name and address
 * and a grievance officer's name and contact to be published where a user can
 * find them. Every document quotes these rather than retyping them, so a new
 * officer is one edit here and not five documents that disagree.
 *
 * The phone number is the same desk as SUPPORT_PHONE in screens/seller/Misc.tsx.
 */

export const OPERATOR = {
  nameEn: 'Jawahar Arts, Science & Commerce College, Anadur',
  nameMr: 'जवाहर कला, विज्ञान व वाणिज्य महाविद्यालय, अणदुर',
  addressEn: 'Anadur, Tal. Tuljapur, Dist. Dharashiv, Maharashtra 413603',
  addressMr: 'अणदुर, ता. तुळजापूर, जि. धाराशिव, महाराष्ट्र 413603',
} as const

export const GRIEVANCE_OFFICER = {
  nameEn: 'Jyoti Basvant Hattarge',
  nameMr: 'ज्योती बसवंत हत्तरगे',
  roleEn: 'Assistant Professor, Department of Zoology, Jawahar Arts, Science & Commerce College, Anadur',
  roleMr: 'सहायक प्राध्यापक, प्राणिशास्त्र विभाग, जवाहर कला, विज्ञान व वाणिज्य महाविद्यालय, अणदुर',
  phone: '7057899018',
  email: 'jyotihattarge@gmail.com',
} as const

/** Where a dispute is heard. */
export const COURTS = {
  en: 'Chhatrapati Sambhajinagar',
  mr: 'छत्रपती संभाजीनगर',
} as const

export const GRIEVANCE_ACK_HOURS = 48
export const GRIEVANCE_RESOLVE_DAYS = 30

/** Wrong or damaged goods must be reported to the seller within this. */
export const RETURN_REPORT_HOURS = 24

/** A rejected ₹50 payment is sent back within this. */
export const FEE_REFUND_WORKING_DAYS = 7

/** 90 days: MAX_AGE_MS in backend/src/auth/events.ts. */
export const SECURITY_LOG_DAYS = 90
