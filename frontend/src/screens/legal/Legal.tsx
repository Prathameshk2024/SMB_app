import { Link, Navigate, useParams } from 'react-router-dom'
import { POLICY_VERSION } from '@shared/legal.js'
import { useI18n, useT } from '../../i18n/I18nProvider.js'
import { AppBar, Card, LanguagePicker, SectionTitle } from '../../components/ui.js'
import { IconChevron } from '../../components/icons.js'
import { DOC_IDS, type Block, isDocId, legalDoc, legalPath } from '../../legal/index.js'

/**
 * THE POLICIES, READABLE BY ANYONE.
 *
 * Public on purpose, like /delete-account: Google Play needs a privacy policy
 * URL that opens in a browser, a buyer should be able to read the terms before
 * she gives a phone number, and the acceptance screens link here from inside
 * a signed-in app. No session, no bottom tabs, and Back returns to wherever
 * she came from - the registration draft and the basket are kept on the phone,
 * so reading a policy mid-way through either loses nothing.
 *
 * The language picker sits at the top because the reader may have arrived
 * from a Play Store listing on an English phone and read only Marathi.
 */

function effectiveDate(lang: string): string {
  return new Date(`${POLICY_VERSION}T00:00:00+05:30`).toLocaleDateString(
    lang === 'mr' ? 'mr-IN' : 'en-IN',
    { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' },
  )
}

function goBack() {
  if (window.history.length > 1) window.history.back()
  else window.location.assign('/')
}

export function LegalIndex() {
  const t = useT()
  const { lang } = useI18n()

  return (
    <div className="app-shell">
      <AppBar brand title={t('legal.title')} onBack={goBack} bell={false} />
      <div className="screen screen--nonav stack">
        <Card><LanguagePicker /></Card>
        <p className="body muted" style={{ margin: 0 }}>{t('legal.lede')}</p>
        <p className="small dim" style={{ margin: 0 }}>{t('legal.effective', { date: effectiveDate(lang) })}</p>

        {DOC_IDS.map((id) => {
          const doc = legalDoc(lang, id)
          return (
            <Link key={id} className="tile" to={legalPath(id)}>
              <div className="tile__body">
                <div className="tile__title">{doc.title}</div>
                <div className="small dim">{doc.summary}</div>
              </div>
              <span aria-hidden="true"><IconChevron /></span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function LegalDocScreen() {
  const t = useT()
  const { lang } = useI18n()
  const { docId } = useParams()

  if (!isDocId(docId)) return <Navigate to={legalPath()} replace />
  const doc = legalDoc(lang, docId)

  return (
    <div className="app-shell">
      <AppBar title={doc.title} onBack={goBack} bell={false} />
      <div className="screen screen--nonav stack">
        <Card><LanguagePicker /></Card>
        <div className="stack-sm">
          <p className="body" style={{ margin: 0 }}>{doc.summary}</p>
          <p className="small dim" style={{ margin: 0 }}>
            {t('legal.effective', { date: effectiveDate(lang) })}
          </p>
        </div>

        {doc.sections.map((s) => (
          <Card key={s.id}>
            <section id={s.id} className="stack-sm">
              <SectionTitle>{s.heading}</SectionTitle>
              {s.body.map((block, i) => <LegalBlock key={i} block={block} />)}
            </section>
          </Card>
        ))}

        <Card>
          <SectionTitle>{t('legal.otherDocs')}</SectionTitle>
          <div className="stack-sm">
            {DOC_IDS.filter((id) => id !== docId).map((id) => (
              <Link key={id} to={legalPath(id)}>{legalDoc(lang, id).title}</Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function LegalBlock({ block }: { block: Block }) {
  if (typeof block === 'string') return <p className="body" style={{ margin: 0 }}>{block}</p>
  return (
    <ul className="stack-sm body" style={{ margin: 0, paddingLeft: 'var(--s5)' }}>
      {block.list.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}
