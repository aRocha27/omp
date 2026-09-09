import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'

export type EmlDirectoryHandle = {
  name: string
  queryPermission: (options?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>
  requestPermission: (options?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{
    createWritable: () => Promise<{ write: (data: string | Uint8Array) => Promise<void>; close: () => Promise<void> }>
  }>
}

const SETTINGS_KEY = 'omp.eml-files'
const DATABASE_NAME = 'omp-settings'
const STORE_NAME = 'folders'
const HANDLE_KEY = 'eml-folder'
const SEND_TYPE_KEY = 'omp.send-invoice-type'
const PICK_FOLDER_ON_SEND_KEY = 'omp.eml-pick-folder-on-send'

export type SendInvoiceType = 'smtp' | 'outlook' | 'eml'

export function readSendInvoiceType(): SendInvoiceType {
  const value = window.localStorage.getItem(SEND_TYPE_KEY)
  return value === 'smtp' || value === 'outlook' ? value : 'eml'
}

export function saveSendInvoiceType(value: SendInvoiceType): void {
  window.localStorage.setItem(SEND_TYPE_KEY, value)
}

export function readPickEmlFolderOnSend(): boolean {
  return window.localStorage.getItem(PICK_FOLDER_ON_SEND_KEY) === 'true'
}

export function savePickEmlFolderOnSend(value: boolean): void {
  window.localStorage.setItem(PICK_FOLDER_ON_SEND_KEY, String(value))
}

export function readEmlFolderLabel(): string {
  try {
    return window.localStorage.getItem(SETTINGS_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveEmlFolderLabel(label: string): void {
  window.localStorage.setItem(SETTINGS_KEY, label)
}

function folderStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
  })
}

export async function saveEmlFolder(handle: EmlDirectoryHandle): Promise<void> {
  const store = await folderStore('readwrite')
  await new Promise<void>((resolve, reject) => {
    const request = store.put(handle, HANDLE_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  saveEmlFolderLabel(handle.name)
}

export async function loadEmlFolder(): Promise<EmlDirectoryHandle | undefined> {
  const store = await folderStore('readonly')
  return new Promise((resolve, reject) => {
    const request = store.get(HANDLE_KEY)
    request.onsuccess = () => resolve(request.result as EmlDirectoryHandle | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function pickEmlFolder(): Promise<EmlDirectoryHandle> {
  const picker = (window as Window & {
    showDirectoryPicker?: () => Promise<EmlDirectoryHandle>
  }).showDirectoryPicker
  if (!picker) throw new Error('This browser cannot select a folder here. Use Save As when sending invoices.')
  return picker()
}

export async function saveInvoiceEmlAs(
  row: DocumentoFaturacao,
  pdf: File,
  recipients: string[],
): Promise<string> {
  const filename = `${row.N_Doc_FT ?? row.ID_Facturacao}.eml`
  const content = await buildInvoiceEml(row, pdf, recipients)
  const savePicker = (window as Window & {
    showSaveFilePicker?: (options?: unknown) => Promise<{
      createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>
    }>
  }).showSaveFilePicker
  if (savePicker) {
    const fileHandle = await savePicker({
      suggestedName: filename,
      types: [{ description: 'Email file', accept: { 'message/rfc822': ['.eml'] } }],
    })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  } else {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([content], { type: 'message/rfc822' }))
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return filename
}

export async function saveInvoiceEmlZipAs(entries: { filename: string; content: string }[]): Promise<string> {
  const filename = `invoices-${new Date().toISOString().slice(0, 10)}.zip`
  const content = createZip(entries)
  const savePicker = (window as Window & {
    showSaveFilePicker?: (options?: unknown) => Promise<{
      createWritable: () => Promise<{ write: (data: string | Uint8Array) => Promise<void>; close: () => Promise<void> }>
    }>
  }).showSaveFilePicker
  if (savePicker) {
    const fileHandle = await savePicker({ suggestedName: filename, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  } else {
    downloadFile(content, filename, 'application/zip')
  }
  return filename
}

export async function writeInvoiceEmlZip(
  folder: EmlDirectoryHandle,
  entries: { filename: string; content: string }[],
): Promise<string> {
  const filename = `invoices-${new Date().toISOString().slice(0, 10)}.zip`
  const fileHandle = await folder.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(createZip(entries))
  await writable.close()
  return filename
}

export async function writeInvoiceEml(
  folder: EmlDirectoryHandle,
  row: DocumentoFaturacao,
  pdf: File,
  recipients: string[],
): Promise<string> {
  const filename = `${row.N_Doc_FT ?? row.ID_Facturacao}.eml`
  const eml = await buildInvoiceEml(row, pdf, recipients)
  const fileHandle = await folder.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(eml)
  await writable.close()
  return filename
}

export async function buildInvoiceEml(
  row: DocumentoFaturacao,
  pdf: File,
  recipients: string[],
  options: { from?: string; cc?: string[]; date?: Date } = {},
): Promise<string> {
  const bytes = new Uint8Array(await pdf.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const attachment = btoa(binary)
  const boundary = `----OMP-${createBoundaryId()}`
  const invoice = row.N_Doc_FT ?? String(row.ID_Facturacao)
  const poNumber = row.Order_PO ?? ''
  const amount = row.Valor_Doc_FT ?? 0
  const vatAmount = amount * 0.23
  const documentType = documentTypeLabel(row.ID_Tp_Doc_FT)
  const subject = `Paperfold Stationery - Invoice ${invoice} - Customer order ${poNumber} - ${row.Client_Name ?? ''}`
  const body = [
    `Caro(a) ${row.Order_Contact ?? 'Cliente'},`,
    '',
    `Paperfold Stationery is sending invoice ${invoice}, regarding customer order ${poNumber}, for the total amount of ${formatMoney(amount + vatAmount)}.`,
    '',
    'Detalhes do documento',
    '',
    `Empresa: ${row.Client_Name ?? 'Cliente'}`,
    `Data do documento: ${formatDate(row.DT_Doc_FT)}`,
    '',
    `Tipo de documento: ${documentType}`,
    `Nº do documento: ${invoice}`,
    `Nota de Encomenda: ${poNumber}`,
    `Valor sem IVA: ${formatMoney(amount)}`,
    `Valor do IVA: ${formatMoney(vatAmount)}`,
    `Valor total:  ${formatMoney(amount + vatAmount)}`,
    '',
    'Agradecemos a vossa atenção e ficamos disponíveis para qualquer esclarecimento adicional.',
    '',
    'Com os melhores cumprimentos,',
    '',
    'Paperfold Team',
    'Sales Assistant',
    '',
    'Paperfold Stationery',
    'p: <Sender Phone>',
    'w: www.paperfold.test',
    'e: hello@paperfold.test',
    '',
    'a: 12 Paper Lane',
    'Stationery District',
    'Papertown',
    '10000-001 Paperland',
  ].map(escapeHtml).join('<br>')
  const cc = options.cc?.filter(Boolean) ?? []
  const eml = [
    'MIME-Version: 1.0',
    `Date: ${(options.date ?? new Date()).toUTCString()}`,
    ...(options.from ? [`From: ${options.from}`] : []),
    `To: ${recipients.join(', ')}`,
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'Content-Type: multipart/mixed;',
    ` boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    quotedPrintableUtf8(`<html><body>${body}</body></html>`),
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${encodeHeader(pdf.name)}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${encodeHeader(pdf.name)}"`,
    '',
    wrapBase64(attachment),
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return eml
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? ''
}

function encodeHeader(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `=?UTF-8?B?${btoa(binary)}?=`
}

function quotedPrintableUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  const tokens: string[] = []
  for (const byte of bytes) {
    tokens.push(byte === 9 || (byte >= 32 && byte <= 60) || (byte >= 62 && byte <= 126) ? String.fromCharCode(byte) : `=${byte.toString(16).toUpperCase().padStart(2, '0')}`)
  }
  let line = ''
  const lines: string[] = []
  for (const token of tokens) {
    if (line.length + token.length > 72) {
      lines.push(`${line}=`)
      line = ''
    }
    line += token
  }
  if (line) lines.push(line)
  return lines.join('\r\n')
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatMoney(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`
}

function formatDate(value: string | null | undefined): string {
  return value ? new Intl.DateTimeFormat('pt-PT').format(new Date(value)) : 'sem data'
}

function documentTypeLabel(value: string | null | undefined): string {
  return ({ AcFT: 'Acerto Fatura', FT: 'Fatura', NC: 'Nota Crédito' } as Record<string, string>)[value ?? ''] ?? value ?? 'Documento'
}

function createBoundaryId(): string {
  const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: () => string }
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function downloadFile(content: Uint8Array, filename: string, type: string): void {
  const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([content.buffer as ArrayBuffer], { type }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function createZip(entries: { filename: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encoder.encode(entry.filename)
    const data = encoder.encode(entry.content)
    const crc = crc32(data)
    const header = new Uint8Array(30 + name.length)
    const view = new DataView(header.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint16(6, 0x800, true)
    view.setUint32(14, crc, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, name.length, true)
    header.set(name, 30)
    local.push(header, data)
    const directory = new Uint8Array(46 + name.length)
    const directoryView = new DataView(directory.buffer)
    directoryView.setUint32(0, 0x02014b50, true)
    directoryView.setUint16(4, 20, true)
    directoryView.setUint16(6, 20, true)
    directoryView.setUint16(8, 0x800, true)
    directoryView.setUint32(16, crc, true)
    directoryView.setUint32(20, data.length, true)
    directoryView.setUint32(24, data.length, true)
    directoryView.setUint16(28, name.length, true)
    directoryView.setUint32(42, offset, true)
    directory.set(name, 46)
    central.push(directory)
    offset += header.length + data.length
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  return joinBytes([...local, ...central, end])
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function joinBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}
