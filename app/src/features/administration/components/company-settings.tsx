import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth, useCurrentUser } from '@/app/providers/user-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fetchMasterData, updateMasterData, type ConnectionSource, type SyncResult } from '@/features/administration/api/admin-api'
import { Input } from '@/components/ui/input'

const fields = [
  ['Nome', 'Nome'],
  ['Morada', 'Morada'],
  ['Localidade', 'Localidade'],
  ['Postal Code', 'Codigo_Postal_Num'],
  ['Telefone', 'Telefone'],
  ['Email', 'Mail'],
  ['Website', 'Site'],
  ['Contribuinte', 'Contribuinte'],
] as const

export function CompanySettings({ source }: { source?: ConnectionSource | null }) {
  const { role } = useCurrentUser()
  const { accountIsAdmin } = useAuth()
  const apiRole = accountIsAdmin ? 'admin' : role
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
       setResult(await fetchMasterData('Identificacao', apiRole, source))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load company identification.')
    } finally {
      setLoading(false)
    }
  }

  // Load the company record when the active role changes; refresh reuses the same request path.
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
    // `load` intentionally follows the effective API role selected above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRole, source])

  const company = result?.rows[0]

  function startEditing() {
    if (!company) return
    setValues(Object.fromEntries(fields.map(([, key]) => [key, String(company[key] ?? '')])))
    setEditing(true)
    setError(null)
  }

  async function save() {
    if (!company || !result?.columns[0] || company[result.columns[0]] == null) return
    setLoading(true)
    setError(null)
    try {
      const payload = Object.fromEntries(fields.map(([, key]) => [key, values[key]?.trim() || null]))
       setResult(await updateMasterData('Identificacao', result.columns[0], String(company[result.columns[0]]), payload, apiRole, source))
      setEditing(false)
      setValues({})
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save company identification.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Company application settings</h2>
            <Badge tone="neutral">dbo.Identificacao</Badge>
          </div>
          <p className="mt-1 text-xs text-foreground/60">
            Main company record from the connected Orders database.
          </p>
        </div>
         <div className="flex gap-2">
           {company && !editing && <Button size="sm" onClick={startEditing} disabled={loading}>Edit</Button>}
           {editing && <Button size="sm" onClick={() => void save()} disabled={loading}>Save changes</Button>}
           {editing && <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setValues({}) }} disabled={loading}>Cancel</Button>}
           <Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
             <RefreshCw className="size-4" /> Refresh
           </Button>
         </div>
      </div>

      {loading && (
        <p className="mt-3 text-xs text-foreground/60">Loading company identification...</p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded bg-danger/10 p-2 text-xs text-danger">
          {error}
        </p>
      )}
      {company && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
           {fields.map(([label, key]) => (
             <div key={key} className="min-w-0 rounded-md border border-border bg-surface p-2.5">
              <span className="block text-[9px] uppercase tracking-wide text-foreground-muted">
                {label}
              </span>
               {editing ? (
                 <Input
                   className="mt-1"
                   value={values[key] ?? ''}
                   aria-label={label}
                   onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                 />
               ) : (
                 <span
                   className="mt-1 block truncate text-xs font-medium text-foreground"
                   title={String(company[key] ?? '')}
                 >
                   {company[key] == null || company[key] === '' ? '—' : String(company[key])}
                 </span>
               )}
            </div>
          ))}
        </div>
      )}
      {!loading && !error && !company && (
        <p className="mt-3 text-xs text-foreground/60">
          No company identification record was returned.
        </p>
      )}
    </section>
  )
}
