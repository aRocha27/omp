import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, FolderOpen } from 'lucide-react'
import { useRepositories } from '@/app/providers/repository-provider'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useAllDocumentoFaturacao } from '@/features/orders/api/use-documento-faturacao'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import { formatOrderDate, formatPrice } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { buildInvoiceEml, pickEmlFolder, writeInvoiceEmlZip } from '@/features/administration/eml-files'

type DirectoryHandle = {
  queryPermission: () => Promise<'granted' | 'denied' | 'prompt'>
  values: () => AsyncIterable<{
    kind: string
    name: string
    getFile?: () => Promise<File>
    values?: () => AsyncIterable<unknown>
  }>
}

const PDF_FOLDER_DB = 'omp-settings'

function folderStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PDF_FOLDER_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('folders')
    request.onerror = () => reject(request.error)
    request.onsuccess = () =>
      resolve(request.result.transaction('folders', mode).objectStore('folders'))
  })
}

async function saveRememberedFolder(handle: DirectoryHandle) {
  const store = await folderStore('readwrite')
  await new Promise<void>((resolve, reject) => {
    const request = store.put(handle, 'pdf-folder')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export function SendDocumentsModal({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser()
  const { facturacao } = useRepositories()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pdfFiles, setPdfFiles] = useState<Record<number, File>>({})
  const [missingPdfIds, setMissingPdfIds] = useState<Set<number>>(new Set())
  const [folderScanned, setFolderScanned] = useState(false)
  const [recipientSelections, setRecipientSelections] = useState<Record<number, string[]>>({})
  const query = useAllDocumentoFaturacao({})
  const rows = query.data ?? []
  const eligibleRows = rows.filter(
    (row) => row.Imprimiu !== true && row.E_Invoice !== true && row.Imp_Block !== true,
  )
  const eligibleIds = new Set(eligibleRows.map((row) => row.ID_Facturacao))
  const selectedIds = [...selected].filter((id) => eligibleIds.has(id))
  const selectedMissingPdf = selectedIds.some((id) => !pdfFiles[id])
  const recipientsFor = (row: DocumentoFaturacao) =>
    recipientSelections[row.ID_Facturacao] ?? parseOrderEmails(row.Order_Email)
  const selectedMissingRecipients = selectedIds.some((id) => {
    const row = eligibleRows.find((candidate) => candidate.ID_Facturacao === id)
    return !row || recipientsFor(row).length === 0
  })

  async function sendDocuments() {
    setConfirming(false)
    setSending(true)
    setMessage(null)
    try {
      const folder = await pickEmlFolder()
      if (folder) {
        const permission = await folder.queryPermission({ mode: 'readwrite' })
        if (permission !== 'granted' && (await folder.requestPermission({ mode: 'readwrite' })) !== 'granted')
          throw new Error('Write permission was not granted for Path_FicheirosEML.')
      }
      const entries: { filename: string; content: string }[] = []
      for (const id of selectedIds) {
        const file = pdfFiles[id]
        const row = eligibleRows.find((candidate) => candidate.ID_Facturacao === id)
        if (!file || !row) throw new Error(`A PDF file must be selected for document ${id}.`)
        const content = await buildInvoiceEml(row, file, recipientsFor(row))
        entries.push({ filename: `${row.N_Doc_FT ?? row.ID_Facturacao}.eml`, content })
      }
      await writeInvoiceEmlZip(folder, entries)
      await Promise.all(
        selectedIds.map((id) => {
          const filename = pdfFiles[id]?.name
          if (!filename) throw new Error(`A PDF file must be selected for document ${id}.`)
          return facturacao.update(id, { Imprimiu: true, Nome_PDF: filename }, user.role)
        }),
      )
      await queryClient.invalidateQueries({ queryKey: ['orders', 'facturacao', 'all'] })
      await queryClient.invalidateQueries({ queryKey: ['orders', 'facturacao'] })
      setMessage(`Created a ZIP file with ${entries.length} EML file${entries.length === 1 ? '' : 's'} in ${folder.name}.`)
    } catch (error) {
      console.error('Could not send selected invoiced documents.', error)
      setMessage(error instanceof Error ? error.message : 'Could not send email.')
    } finally {
      setSending(false)
    }
  }

  async function choosePdfFolder() {
    try {
      const picker = (window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> })
        .showDirectoryPicker
      if (!picker) {
        document.getElementById('global-pdf-folder-fallback')?.click()
        return
      }
      const handle = await picker()
      await saveRememberedFolder(handle)
      await scanPdfDirectory(handle)
    } catch (error) {
      console.error('Could not choose or scan the PDF folder.', error)
      if ((error as { name?: string }).name !== 'AbortError') {
        console.error('Could not choose or scan the PDF folder.', error)
        setMessage('Could not access the selected PDF folder.')
      }
    }
  }

  function scanPdfFolder(files: FileList | null) {
    if (!files) return
    const byNumber = new Map<string, File>()
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue
      byNumber.set(file.name.slice(0, -4).toLowerCase(), file)
    }
    const missing = new Set<number>()
    setPdfFiles((current) => {
      const next = { ...current }
      for (const row of eligibleRows) {
        const match = byNumber.get((row.N_Doc_FT ?? '').trim().toLowerCase())
        if (match) next[row.ID_Facturacao] = match
        else missing.add(row.ID_Facturacao)
      }
      return next
    })
    setMissingPdfIds(missing)
    setFolderScanned(true)
    setMessage(`PDF scan complete: ${eligibleRows.length - missing.size} found, ${missing.size} missing.`)
  }

  async function scanPdfDirectory(handle: DirectoryHandle) {
    const files = new Map<string, File>()
    async function collect(directory: DirectoryHandle) {
      for await (const entry of directory.values()) {
        if (entry.kind === 'directory' && entry.values) {
          await collect({ ...directory, values: entry.values as DirectoryHandle['values'] })
        } else if (entry.kind === 'file' && entry.getFile && entry.name.toLowerCase().endsWith('.pdf')) {
          files.set(entry.name.slice(0, -4).toLowerCase(), await entry.getFile())
        }
      }
    }
    await collect(handle)
      const missing = new Set<number>()
    setPdfFiles((current) => {
      const next = { ...current }
      for (const row of eligibleRows) {
        const match = files.get((row.N_Doc_FT ?? '').trim().toLowerCase())
        if (match) next[row.ID_Facturacao] = match
        else missing.add(row.ID_Facturacao)
      }
      return next
    })
    setMissingPdfIds(missing)
    setFolderScanned(true)
    setMessage(`PDF scan complete: ${eligibleRows.length - missing.size} found, ${missing.size} missing.`)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-documents-title"
        className="max-h-[90vh] w-[96vw] max-w-[1600px] overflow-auto rounded-lg border border-border bg-surface p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="send-documents-title" className="text-base font-semibold">
              Send Invoices
            </h2>
            <p className="mt-1 text-xs text-foreground/60">
              All eligible invoiced documents from all orders are listed below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void choosePdfFolder()}>
              <FolderOpen className="size-3.5" aria-hidden /> Choose PDF's Path
            </Button>
            <input
              id="global-pdf-folder-fallback"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              ref={(node) => node?.setAttribute('webkitdirectory', '')}
              className="sr-only"
              onChange={(event) => scanPdfFolder(event.target.files)}
            />
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-b border-border pb-3">
          {query.isFetching && <span className="text-xs text-foreground/60">Loading…</span>}
          {!query.isFetching && (
            <span className="text-xs text-foreground/60">
              {eligibleRows.length} available, {selectedIds.length} selected
            </span>
          )}
          <Button
            className="ml-auto"
            size="sm"
            disabled={
              selectedIds.length === 0 ||
              selectedMissingPdf ||
              selectedMissingRecipients ||
              sending ||
              user.role === 'viewer'
            }
            onClick={() => setConfirming(true)}
          >
            {sending ? 'Sending…' : 'Send Invoices'}
          </Button>
        </div>
        {query.isError && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {query.error instanceof Error ? query.error.message : 'Could not load documents.'}
          </p>
        )}
        {!query.isError && !query.isFetching && (
          <DocumentRows
            rows={eligibleRows}
            selected={selected}
            pdfFiles={pdfFiles}
            missingPdfIds={missingPdfIds}
            folderScanned={folderScanned}
            recipientSelections={recipientSelections}
            onSelectionChange={setSelected}
            onRecipientChange={(row, values) =>
              setRecipientSelections((current) => ({ ...current, [row.ID_Facturacao]: values }))
            }
            onPdfChange={(row, file) => {
              setPdfFiles((current) => ({ ...current, [row.ID_Facturacao]: file }))
              setMissingPdfIds((current) => {
                const next = new Set(current)
                next.delete(row.ID_Facturacao)
                return next
              })
            }}
          />
        )}
        {!query.isFetching && !query.isError && eligibleRows.length === 0 && (
          <p className="p-8 text-center text-sm text-foreground/50">
            No eligible documents available.
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 text-xs text-foreground-muted">
            {message}
          </p>
        )}
        {selectedMissingPdf && (
          <p role="alert" className="mt-2 text-xs text-danger">
            Choose a real PDF for every selected row before sending. The generated document number
            is not used as a filename.
          </p>
        )}
        {selectedMissingRecipients && (
          <p role="alert" className="mt-2 text-xs text-danger">
            Choose at least one recipient email for every selected invoice.
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Send documents"
        description={`Send ${selectedIds.length} selected document${selectedIds.length === 1 ? '' : 's'} by email and mark them as printed?`}
        confirmLabel="Send"
        busy={sending}
        onConfirm={() => void sendDocuments()}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}

function parseOrderEmails(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
}

function DocumentRows({
  rows,
  selected,
  pdfFiles,
  missingPdfIds,
  folderScanned,
  recipientSelections,
  onSelectionChange,
  onRecipientChange,
  onPdfChange,
}: {
  rows: DocumentoFaturacao[]
  selected: Set<number>
  pdfFiles: Record<number, File>
  missingPdfIds: Set<number>
  folderScanned: boolean
  recipientSelections: Record<number, string[]>
  onSelectionChange: (next: Set<number>) => void
  onRecipientChange: (row: DocumentoFaturacao, values: string[]) => void
  onPdfChange: (row: DocumentoFaturacao, file: File) => void
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
            <th className="w-9 px-2.5 py-1.5">
              <input
                type="checkbox"
                aria-label="Select all invoices"
                checked={rows.length > 0 && rows.every((row) => selected.has(row.ID_Facturacao))}
                onChange={(event) =>
                  onSelectionChange(
                    event.target.checked
                      ? new Set(rows.map((row) => row.ID_Facturacao))
                      : new Set(),
                  )
                }
              />
            </th>
            <th className="px-2.5 py-1.5">SAP Order Number</th>
            <th className="px-2.5 py-1.5">Client Name</th>
            <th className="px-2.5 py-1.5">Date</th>
            <th className="px-2.5 py-1.5">Invoice Type</th>
            <th className="px-2.5 py-1.5">Invoice Number</th>
            <th className="px-2.5 py-1.5">PDF Name</th>
            <th className="px-2.5 py-1.5">Order Email</th>
            <th className="px-2.5 py-1.5 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expected = `${row.N_Doc_FT ?? row.ID_Facturacao}.pdf`
            const missing =
              folderScanned && missingPdfIds.has(row.ID_Facturacao) && !pdfFiles[row.ID_Facturacao]
            return (
              <tr key={row.ID_Facturacao} className="border-b border-border/50">
                <td className="px-2.5 py-1.5">
                  <input
                    type="checkbox"
                    aria-label={`Select document ${row.ID_Facturacao}`}
                    checked={selected.has(row.ID_Facturacao)}
                    onChange={(event) => {
                      const next = new Set(selected)
                      if (event.target.checked) next.add(row.ID_Facturacao)
                      else next.delete(row.ID_Facturacao)
                      onSelectionChange(next)
                    }}
                  />
                </td>
                <td className="px-2.5 py-1.5 text-[11px]">{row.SAP_Order_Number ?? '—'}</td>
                <td className="px-2.5 py-1.5 text-[11px]">{row.Client_Name ?? '—'}</td>
                <td className="px-2.5 py-1.5 text-[11px]">{formatOrderDate(row.DT_Doc_FT)}</td>
                <td className="px-2.5 py-1.5 text-[11px]">{row.ID_Tp_Doc_FT ?? '—'}</td>
                <td className="px-2.5 py-1.5 text-[11px]">{row.N_Doc_FT ?? '—'}</td>
                <td className="px-2.5 py-1.5 text-[11px]">
                  <div className="flex items-center gap-1">
                    <div>
                      <span className="truncate">
                        {pdfFiles[row.ID_Facturacao]?.name || (missing ? '—' : expected)}
                      </span>
                      {missing && (
                        <p className="text-[10px] text-danger">PDF not found: {expected}</p>
                      )}
                    </div>
                    <label className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-foreground/5">
                      <FileUp className="size-3.5 text-foreground/60" aria-hidden />
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        aria-label={`Choose PDF for document ${row.ID_Facturacao}`}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) onPdfChange(row, file)
                        }}
                      />
                    </label>
                  </div>
                </td>
                <td className="px-2.5 py-1.5">
                  <RecipientPicker
                    row={row}
                    selected={
                      recipientSelections[row.ID_Facturacao] ?? parseOrderEmails(row.Order_Email)
                    }
                    onChange={(values) => onRecipientChange(row, values)}
                  />
                </td>
                <td className="px-2.5 py-1.5 text-right text-[11px]">
                  {formatPrice(row.Valor_Doc_FT)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RecipientPicker({
  row,
  selected,
  onChange,
}: {
  row: DocumentoFaturacao
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const emails = parseOrderEmails(row.Order_Email)
  const allSelected = emails.length > 0 && selected.length === emails.length
  if (emails.length === 0)
    return <span className="text-[10px] text-danger">No email configured</span>
  function toggle() {
    if (!open) {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen((value) => !value)
  }
  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        className="h-7 max-w-[190px] truncate rounded-md border border-border bg-surface px-2 text-left text-[10px] text-foreground hover:bg-foreground/5"
        aria-label={`Email recipients for document ${row.ID_Facturacao}`}
        onClick={toggle}
      >
        {allSelected
          ? 'All emails'
          : selected.length
            ? `${selected.length} selected`
            : 'Select emails'}
      </button>
      {open &&
        createPortal(
          <div
            className="fixed z-[70] min-w-[220px] rounded-md border border-border bg-surface p-2 shadow-xl"
            style={{ top: position.top, left: position.left }}
          >
            <label className="flex items-center gap-2 border-b border-border pb-2 text-[10px] font-semibold">
              <input
                type="checkbox"
                aria-label={`Select all emails for document ${row.ID_Facturacao}`}
                checked={allSelected}
                onChange={(event) => onChange(event.target.checked ? emails : [])}
              />{' '}
              Select all emails
            </label>
            <div className="mt-2 space-y-1">
              {emails.map((email) => (
                <label key={email} className="flex items-center gap-2 text-[10px]">
                  <input
                    type="checkbox"
                    aria-label={`${email} for document ${row.ID_Facturacao}`}
                    checked={selected.includes(email)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...selected, email]
                          : selected.filter((value) => value !== email),
                      )
                    }
                  />{' '}
                  <span className="truncate">{email}</span>
                </label>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
