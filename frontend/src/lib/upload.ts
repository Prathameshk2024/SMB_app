import { getToken } from './api.js'
import { takeRegisterTicket } from './registerTicket.js'

/**
 * Product photo upload.
 *
 * The file goes straight from the phone to Cloudinary using a signature our
 * server issues, so a 4MB photo never passes through the API.
 *
 * Before it leaves the device it is downscaled and re-encoded. A modern phone
 * camera produces 3-6MB per shot; on a village 4G connection that is close to
 * a minute of uploading, and it is the single most likely place a seller gives
 * up halfway through adding her first product. 1200px at JPEG 0.75 is
 * typically 150-350KB and indistinguishable at the sizes we render.
 */

const BASE = import.meta.env.VITE_API_URL ?? ''
const MAX_EDGE = 1200
const QUALITY = 0.75

/**
 * The largest file we will accept off the picker.
 *
 * Everything is downscaled to 1200px before it leaves the phone, so this is
 * not a bandwidth limit - it is a guard against the wrong FILE. A gallery
 * picker will happily hand back a video or a 40MP RAW, and `createImageBitmap`
 * on one of those either takes half a minute or runs the tab out of memory, on
 * exactly the cheap phones this app is for.
 *
 * 8MB clears any phone camera JPEG (3-6MB is typical at 12MP) with room to
 * spare, and sits under Cloudinary's 10MB image ceiling so a file that passes
 * here cannot then be refused at the far end.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_UPLOAD_MB = 8

/** Thrown before anything is read, so the message can name the real limit. */
export class FileTooLargeError extends Error {
  constructor(public bytes: number) {
    super(`file is ${(bytes / 1024 / 1024).toFixed(1)}MB, over the ${MAX_UPLOAD_MB}MB limit`)
  }
}

export class NotAnImageError extends Error {}

export interface UploadedImage {
  url: string
  publicId: string
  width: number
  height: number
  bytes: number
}

export class UploadDisabledError extends Error {}

/** Downscale in a canvas. Returns the original if anything goes wrong. */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))

    // Already small enough - re-encoding would only lose quality.
    if (scale === 1 && file.size < 600_000) {
      bitmap.close?.()
      return file
    }

    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    // If the re-encode somehow got bigger, keep the original.
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

interface Signature {
  cloudName: string
  apiKey: string
  signature: string
  timestamp: number
  folder: string
  transformation: string
  uploadUrl: string
}

async function getSignature(kind: 'product' | 'payment'): Promise<Signature> {
  const token = getToken()

  /**
   * During REGISTRATION there is no session yet - the seller record is created
   * at the very end - so her registration ticket is the proof she offers
   * instead. The server accepts either. Without this the payment-QR upload on
   * the last wizard screen answered 401, which the app could only report as
   * "the photo could not be sent".
   */
  const ticket = token ? '' : takeRegisterTicket()

  const res = await fetch(`${BASE}/api/uploads/signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ kind, ticket }),
  })
  if (res.status === 503) {
    throw new UploadDisabledError('Cloudinary is not configured')
  }
  if (!res.ok) throw new Error(`signature ${res.status}`)
  return (await res.json()) as Signature
}

/**
 * Upload one image. `onProgress` receives 0..1 so the UI can show a bar -
 * essential when this can take fifteen seconds on a weak connection.
 */
export async function uploadImage(
  file: File,
  opts: { kind?: 'product' | 'payment'; onProgress?: (fraction: number) => void } = {},
): Promise<UploadedImage> {
  const { kind = 'product', onProgress } = opts

  // Checked before a byte is read, so a wrong file fails instantly with a
  // message that names the limit rather than after a long silent stall.
  if (!file.type.startsWith('image/')) throw new NotAnImageError(file.type)
  if (file.size > MAX_UPLOAD_BYTES) throw new FileTooLargeError(file.size)

  const blob = await shrinkImage(file)
  const sig = await getSignature(kind)

  const form = new FormData()
  form.append('file', blob)
  form.append('api_key', sig.apiKey)
  form.append('timestamp', String(sig.timestamp))
  form.append('signature', sig.signature)
  form.append('folder', sig.folder)
  form.append('transformation', sig.transformation)

  // XHR rather than fetch: fetch still cannot report upload progress.
  return new Promise<UploadedImage>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', sig.uploadUrl)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`upload ${xhr.status}`))
        return
      }
      const body = JSON.parse(xhr.responseText) as {
        secure_url: string; public_id: string; width: number; height: number; bytes: number
      }
      resolve({
        url: body.secure_url,
        publicId: body.public_id,
        width: body.width,
        height: body.height,
        bytes: body.bytes,
      })
    }
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(form)
  })
}

/**
 * Ask Cloudinary for exactly the size we render, in whatever format the
 * browser prefers. Serving a 1200px master into a 150px card wastes most of
 * the bytes; `f_auto,q_auto` typically halves them again with WebP/AVIF.
 */
export function cloudinaryThumb(url: string, width: number): string {
  if (!url.includes('/image/upload/')) return url
  return url.replace(
    '/image/upload/',
    `/image/upload/f_auto,q_auto,c_fill,w_${width},h_${width}/`,
  )
}
