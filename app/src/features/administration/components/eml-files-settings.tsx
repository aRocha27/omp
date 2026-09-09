export function EmlFilesSettings() {
  return (
    <details open className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold">Send Invoice Type</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-foreground/60">EML Files</p>
        <p className="text-xs text-foreground/60">Choose the EML folder when sending invoices.</p>
      </div>
    </details>
  )
}
