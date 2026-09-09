#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

const [emlPath, pdfPath] = process.argv.slice(2)
if (!emlPath || !pdfPath) {
  console.error('Usage: node scripts/validate-eml.mjs message.eml original.pdf')
  process.exit(2)
}

const eml = await readFile(emlPath, 'utf8')
const originalPdf = await readFile(pdfPath)
const required = [
  /^MIME-Version:\s*1\.0\r?$/im,
  /^Date:\s*.+\r?$/im,
  /^To:\s*.+\r?$/im,
  /^Subject:\s*.+\r?$/im,
  /^Content-Type:\s*multipart\/mixed;\s*$/im,
  /^Content-Type:\s*text\/html;\s*charset="UTF-8"\s*$/im,
  /^Content-Transfer-Encoding:\s*quoted-printable\s*$/im,
  /^Content-Type:\s*application\/pdf;/im,
  /^Content-Transfer-Encoding:\s*base64\s*$/im,
  /^Content-Disposition:\s*attachment;/im,
]
for (const pattern of required) if (!pattern.test(eml)) throw new Error(`Missing MIME element: ${pattern}`)

const boundary = eml.match(/^Content-Type: multipart\/mixed;\r?\n boundary="([^"]+)"/im)?.[1]
if (!boundary) throw new Error('Multipart boundary was not found.')
const boundaryCount = eml.split(`--${boundary}`).length - 1
if (boundaryCount < 3 || !eml.includes(`--${boundary}--`)) throw new Error('Multipart boundary is not correctly closed.')

const pdfPart = eml.split(`--${boundary}`).find((part) => /application\/pdf/i.test(part))
if (!pdfPart) throw new Error('PDF MIME part was not found.')
const encodedPdf = pdfPart.split(/\r?\n\r?\n/)[1]?.replace(/\s/g, '')
if (!encodedPdf || !/^[A-Za-z0-9+/]+=*$/.test(encodedPdf)) throw new Error('PDF is not valid Base64.')
const decodedPdf = Buffer.from(encodedPdf, 'base64')
if (!decodedPdf.equals(originalPdf)) throw new Error('Decoded PDF differs from the original PDF.')

console.log('Valid MIME structure and byte-for-byte identical PDF attachment.')
