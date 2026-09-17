import { useState } from 'react'
import QRCode from 'qrcode'
import { useT } from '../i18n/I18nProvider.js'
import { useToast } from '../store/ToastContext.js'
import { Button } from './ui.js'
import { IconDownload } from './icons.js'
import { QR_COLOURS } from './QrCode.js'

/**
 * PAYING FROM THE SAME PHONE THAT SHOWS THE QR.
 *
 * A phone cannot scan its own screen, and for a while the answer to that was a
 * "Pay" button on a `upi://pay` link that opened PhonePe or Google Pay with
 * everything filled in. It opened them, and then they refused to pay:
 * "declined for security reasons". UPI apps now treat a payment that ANOTHER
 * app starts, to a PERSONAL UPI ID, as the shape of a scam - and every payee
 * in this market, sellers and the college alike, is a personal UPI ID. Nothing
 * in the link can change that; tested on real phones, 14 September 2026.
 *
 * What those same apps do accept is a payment she starts inside them: scanning
 * a QR picked from her gallery, or pasting a UPI ID. So the QR is saved to the
 * phone as a picture, and the steps say where to take it.
 *
 * If payees ever move to business UPI IDs, a pay link works again for those
 * accounts - and only for those.
 */
export function SaveQrButton({
  link, fileName, onSaved,
}: {
  link: string
  fileName: string
  /** Called once the picture is really on the phone, so the screen can wait for her return. */
  onSaved?: () => void
}) {
  const t = useT()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const blob = await qrPng(link)
      // Inside the APK's WebView a download link does nothing and says
      // nothing, so the share sheet is the way out there - and where even that
      // is missing, she is told to take a screenshot rather than told "saved".
      if (isAndroidWebView()) {
        const file = new File([blob], fileName, { type: 'image/png' })
        if (!navigator.canShare?.({ files: [file] })) throw new Error('cannot save here')
        await navigator.share({ files: [file] })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      toast(t('ok.qrOnPhone'))
      onSaved?.()
    } catch (e) {
      // Closing the share sheet is a choice, not a failure.
      if (e instanceof DOMException && e.name === 'AbortError') return
      toast(t('err.qrSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={() => void save()} disabled={busy}>
      <IconDownload aria-hidden="true" /> {t('pay.saveQr')}
    </Button>
  )
}

/**
 * The three steps, written out. Scanning from the gallery is a menu she has
 * probably never opened, and a button that saves a picture explains nothing
 * about what the picture is for.
 */
export function PaySteps({ screenshot = false }: { screenshot?: boolean }) {
  const t = useT()
  return (
    <ol className="stack-sm" style={{ margin: 0, paddingLeft: 'var(--s5)' }}>
      <li>{t('pay.step1')}</li>
      <li>{t('pay.step2')}</li>
      {/* Where proof is asked for, the step to capture it comes BEFORE she
          leaves the success screen - it is gone once she presses back. */}
      {screenshot && <li>{t('pay.stepScreenshot')}</li>}
      <li>{t('pay.step3')}</li>
    </ol>
  )
}

/**
 * Larger than the on-screen code and with a wider quiet zone: a gallery
 * scanner works from a photo of whatever size, and a generous margin is what
 * lets it find the corners.
 */
function qrPng(link: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  return QRCode.toCanvas(canvas, link, {
    width: 720,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: QR_COLOURS,
  }).then(
    () => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png')
    }),
  )
}

/** Android marks its WebView with "; wv)" in the user agent; Chrome does not. */
function isAndroidWebView(): boolean {
  return /; wv\)/.test(navigator.userAgent)
}
