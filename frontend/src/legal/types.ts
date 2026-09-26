/**
 * The shape every policy document is written in, in both languages.
 *
 * Plain data rather than JSX, so the two languages can be checked against
 * each other (same documents, same section ids) and the Marathi can go
 * through the same style checks as the dictionary.
 */

export const DOC_IDS = ['privacy', 'terms', 'seller', 'refunds', 'grievance'] as const
export type DocId = (typeof DOC_IDS)[number]

/** A paragraph, or a bulleted list. */
export type Block = string | { list: string[] }

export interface LegalSection {
  /** Stable across languages - the parity test compares these. */
  id: string
  heading: string
  body: Block[]
}

export interface LegalDoc {
  title: string
  /** One sentence under the title, and the line on the index page. */
  summary: string
  sections: LegalSection[]
}

export type LegalSet = Record<DocId, LegalDoc>
