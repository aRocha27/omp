import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import nodemailer from 'nodemailer'
import type { OrderDetailRow } from './types.js'

export interface EmailDocument {
  N_Doc_FT: string | null
  ID_Tp_Doc_FT: string | null
  DT_Doc_FT: string | null
  Valor_Doc_FT: number | null
  Nome_PDF?: string | null
}

export interface EmailDependencies {
  send: (input: {
    to: string
    subject: string
    text: string
    attachments: { filename: string; path?: string; content?: Buffer }[]
  }) => Promise<void>
}

const documentTypeLabels: Record<string, string> = {
  AcFT: 'Acerto Fatura',
  FT: 'Fatura',
  NC: 'Nota Crédito',
}

const supportDirectory = path.resolve(process.cwd(), '..', 'emailSUPPORT')
const recipientFile = path.join(supportDirectory, 'test-recipient.txt')

export function buildEmailDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): EmailDependencies {
  const host = environment.SMTP_HOST?.trim()
  const port = Number(environment.SMTP_PORT ?? 587)
  const user = environment.SMTP_USER?.trim()
  const pass = environment.SMTP_PASSWORD
  const from = environment.SMTP_FROM?.trim() || user
  if (!host || !Number.isInteger(port) || !from) {
    return {
      send: async (_input) => {
        throw new Error('Email is not configured. Set SMTP_HOST, SMTP_PORT and SMTP_FROM.')
      },
    }
  }
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: environment.SMTP_SECURE === 'true',
    auth: user && pass ? { user, pass } : undefined,
  })
  return {
    send: async ({ to, subject, text, attachments }) => {
      await transporter.sendMail({ from, to, subject, text, attachments })
    },
  }
}

export async function readTestRecipient(): Promise<string> {
  const recipient = (await readFile(recipientFile, 'utf8')).trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error(`Set a valid email address in ${path.relative(process.cwd(), recipientFile)}.`)
  }
  return recipient
}

export function buildInvoiceEmail(
  order: OrderDetailRow,
  document: EmailDocument,
  environment: NodeJS.ProcessEnv = process.env,
): { subject: string; text: string } {
  const typeCode = document.ID_Tp_Doc_FT || ''
  const type = documentTypeLabels[typeCode] || typeCode || 'Documento'
  const number = document.N_Doc_FT || 'sem número'
  const formatMoney = (value: number | null) => `${(value ?? 0).toFixed(2).replace('.', ',')} €`
  const netAmount = document.Valor_Doc_FT ?? 0
  const vatRate = Number(environment.INVOICE_VAT_RATE ?? '0.23')
  const vatAmount = netAmount * vatRate
  const totalAmount = netAmount * (1 + vatRate)
  const date = document.DT_Doc_FT
    ? new Intl.DateTimeFormat('pt-PT').format(new Date(document.DT_Doc_FT))
    : 'sem data'
  // Sender identity is configurable so each deployment can supply its own
  // company name, contact person, and contact details without hard-coding
  // any of them into the public template.
  const senderCompany = environment.INVOICE_SENDER_COMPANY?.trim() || 'OMP'
  const senderContact = environment.INVOICE_SENDER_CONTACT?.trim() || 'OMP Team'
  const senderRole = environment.INVOICE_SENDER_ROLE?.trim() || 'Sales'
  const senderEmail = environment.INVOICE_SENDER_EMAIL?.trim() || 'noreply@example.com'
  const senderWebsite = environment.INVOICE_SENDER_WEBSITE?.trim() || ''
  const subject = `[${senderCompany}] Envio de ${type.toLowerCase()} ${number} – Encomenda ${order.PO_Cliente ?? ''} - ${order.Client_Name ?? ''}`
  const text = [
    `Caro(a) ${order.Contacto ?? 'Cliente'},`,
    '',
    `A ${senderCompany} envia, por este meio, o nosso documento nº ${number}, referente à vossa Nota de Encomenda nº ${order.PO_Cliente ?? ''}, no valor total de ${formatMoney(totalAmount)}.`,
    '',
    'Detalhes do documento',
    '',
    `Empresa: ${order.Client_Name ?? 'Cliente'}`,
    `Data do documento: ${date}`,
    '',
    `Tipo de documento: ${type}`,
    `Nº do documento: ${number}`,
    `Nota de Encomenda: ${order.PO_Cliente ?? ''}`,
    `Valor sem IVA: ${formatMoney(netAmount)}`,
    `Valor do IVA: ${formatMoney(vatAmount)}`,
    `Valor total:  ${formatMoney(totalAmount)}`,
    '',
    'Agradecemos a vossa atenção e ficamos disponíveis para qualquer esclarecimento adicional.',
    '',
    'Com os melhores cumprimentos,',
    '',
    senderContact,
    senderRole,
    senderCompany,
    senderWebsite ? `w: ${senderWebsite}` : '',
    `e: ${senderEmail}`,
  ].filter((line) => line !== '').join('\n')
  return { subject, text }
}

export async function resolvePdfAttachment(
  document: EmailDocument,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const directory = environment.EMAIL_PDF_DIRECTORY?.trim()
  const filename = document.Nome_PDF?.trim()
  if (!directory || !filename) return null
  const safeFilename = path.basename(filename)
  const attachmentPath = path.resolve(directory, safeFilename)
  try {
    await access(attachmentPath)
    return { filename: safeFilename, path: attachmentPath }
  } catch {
    return null
  }
}

export { recipientFile, supportDirectory }
