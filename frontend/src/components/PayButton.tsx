import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/I18nProvider.js'
import { Rupees } from './ui.js'
import { IconUpi } from './icons.js'

/**
 * OPEN HER UPI APP, WITH THE PAYMENT ALREADY FILLED IN.
 *
 * Every payment screen in this app shows a QR, and every one of them shows it
 * on the phone the payer is holding. A phone cannot scan its own screen. What
 * was left was a second handset, a screenshot fed to PhonePe's gallery
 * scanner, or retyping a UPI ID she cannot proofread - three answers that all
 * assume somebody else is standing next to her.
 *
 * `upi://pay` is the one link every Indian payment app registers, so Android
 * offers whichever ones she actually has: PhonePe, Google Pay, Paytm, BHIM,
 * her bank's own. Naming them ourselves would mean a button that opens
 * nothing on a phone without that app, and a list to maintain for ever.
 *
 * A "pay now" link was removed from this app once before, for a good reason:
 * the tap after a successful payment is Back, and she used to land on a form
 * with no reference number captured and no sign anything had happened. That
 * is what `onReturn` is for - the caller uses it to put the reference box in
 * front of her the moment she comes back. The QR stays exactly where it was,
 * for the case where somebody IS standing next to her with a second phone.
 *
 * An anchor rather than an onClick: a WebView hands an `upi:` href to Android
 * as an intent, where a scripted navigation can be swallowed silently.
 */
export function PayButton({
  link, amount, onReturn,
}: {
  link: string
  amount: number
  /** Fired when the app comes back to the foreground after this was tapped. */
  onReturn?: () => void
}) {
  const t = useT()
  const [launched, setLaunched] = useState(false)
  const returned = useRef(false)

  useEffect(() => {
    if (!launched) return

    function back() {
      // Once per launch. Android fires focus and visibilitychange together,
      // and two prompts for one payment reads as a bug.
      if (document.visibilityState !== 'visible' || returned.current) return
      returned.current = true
      setLaunched(false)
      onReturn?.()
    }

    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
    }
  }, [launched, onReturn])

  return (
    <a
      className="btn"
      href={link}
      onClick={() => { returned.current = false; setLaunched(true) }}
    >
      <IconUpi aria-hidden="true" /> {t('pay.payNow')} <Rupees value={amount} />
    </a>
  )
}
