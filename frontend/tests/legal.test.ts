import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEGAL, DOC_IDS } from '../src/legal/index.js'
import { GRIEVANCE_OFFICER, OPERATOR } from '../src/legal/operator.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * THE TWO LANGUAGES DESCRIBE THE SAME AGREEMENT
 * =============================================
 * The Marathi and English policies are written independently, like the two
 * dictionaries - but they are one agreement, and a woman who switches
 * language to understand a clause better must find the same clause there.
 * A section in one and not the other is a promise made to half the readers.
 */

const DEVANAGARI = /[ऀ-ॿ]/

test('both languages carry every document, with the same sections in the same order', () => {
  for (const id of DOC_IDS) {
    const mr = LEGAL.mr[id].sections.map((s) => s.id)
    const en = LEGAL.en[id].sections.map((s) => s.id)
    assert.deepEqual(mr, en, `${id}: sections differ between Marathi and English`)
  }
})

test('no section is empty', () => {
  for (const lang of ['mr', 'en'] as const) {
    for (const id of DOC_IDS) {
      for (const s of LEGAL[lang][id].sections) {
        assert.ok(s.heading.trim(), `${lang}.${id}.${s.id} has no heading`)
        assert.ok(s.body.length > 0, `${lang}.${id}.${s.id} has no text`)
      }
    }
  }
})

test('the English policies are English', () => {
  const bad: string[] = []
  for (const id of DOC_IDS) {
    const doc = LEGAL.en[id]
    const all = [doc.title, doc.summary, ...doc.sections.flatMap((s) => [
      s.heading, ...s.body.flatMap((b) => (typeof b === 'string' ? [b] : b.list)),
    ])]
    for (const line of all) if (DEVANAGARI.test(line)) bad.push(`${id}: ${line.slice(0, 60)}`)
  }
  assert.deepEqual(bad, [])
})

test('the grievance page names the operator and a reachable officer in both languages', () => {
  // Required by the E-Commerce Rules and the IT Rules: a legal name, an
  // address, and a grievance officer's name and contact, where users find them.
  for (const lang of ['mr', 'en'] as const) {
    const text = JSON.stringify(LEGAL[lang].grievance)
    assert.ok(text.includes(lang === 'mr' ? OPERATOR.nameMr : OPERATOR.nameEn), `${lang}: operator`)
    assert.ok(text.includes(GRIEVANCE_OFFICER.phone), `${lang}: phone`)
    assert.ok(text.includes(GRIEVANCE_OFFICER.email), `${lang}: email`)
  }
})

test('the officer\'s phone is the same desk the app\'s call buttons ring', () => {
  // Two numbers for one desk is how one of them stops being answered.
  // Read from the source: importing the screen would pull in its images.
  const misc = readFileSync(join(import.meta.dirname, '..', 'src', 'screens', 'seller', 'Misc.tsx'), 'utf8')
  const supportPhone = misc.match(/SUPPORT_PHONE = '(\d+)'/)?.[1]
  assert.equal(GRIEVANCE_OFFICER.phone, supportPhone)
})
