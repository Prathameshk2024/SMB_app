import type { LangCode as Lang } from '../i18n/strings.js'
import { en } from './en.js'
import { mr } from './mr.js'
import { DOC_IDS, type DocId, type LegalDoc, type LegalSet } from './types.js'

export { DOC_IDS, type DocId } from './types.js'
export type { Block, LegalDoc, LegalSection } from './types.js'

export const LEGAL: Record<Lang, LegalSet> = { mr, en }

export function isDocId(value: unknown): value is DocId {
  return (DOC_IDS as readonly unknown[]).includes(value)
}

export function legalDoc(lang: Lang, id: DocId): LegalDoc {
  return LEGAL[lang][id]
}

/** Where each document lives. Public, so Play and a buyer can open it without an account. */
export function legalPath(id?: DocId): string {
  return id ? `/legal/${id}` : '/legal'
}
