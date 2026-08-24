import { useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createApplicationUser, listApplicationUsers, type ApplicationUser } from '@/features/administration/api/admin-api'
import { useCurrentUser } from '@/app/providers/user-provider'

export function ProfileCreator() {
  const user = useCurrentUser()
  const [users, setUsers] = useState<ApplicationUser[]>([])
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [admin, setAdmin] = useState(false)
  const [obs, setObs] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = async () => { setLoading(true); setError(null); try { setUsers(await listApplicationUsers(user.role)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar perfis.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!name.trim()) return
    setSaving(true); setError(null)
    try { const created = await createApplicationUser({ ID_User: id.trim(), User_Name: name.trim(), Admin: admin, Obs: obs || null }, user.role); setUsers((current) => [...current, created].sort((a, b) => (a.User_Name ?? '').localeCompare(b.User_Name ?? ''))); setId(''); setName(''); setObs(''); setAdmin(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar o perfil.') }
    finally { setSaving(false) }
  }
  return <section className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold">Perfis de utilizador</h2><p className="text-xs text-foreground-muted">Perfis reais da tabela Utilizador. Existem apenas USER e ADMIN.</p></div><Button size="sm" variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /> Atualizar</Button></div>
    <form onSubmit={save} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_1fr_auto] sm:items-end"><label className="text-xs font-semibold">ID de acesso<Input required value={id} onChange={(e) => setId(e.target.value)} /></label><label className="text-xs font-semibold">Nome<Input required value={name} onChange={(e) => setName(e.target.value)} /></label><label className="flex items-center gap-2 pb-2 text-xs"><input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> ADMIN</label><label className="text-xs font-semibold">Observações<Input value={obs} onChange={(e) => setObs(e.target.value)} /></label><Button type="submit" disabled={saving}><Plus className="size-4" /> Criar perfil</Button></form>
    {error && <p role="alert" className="mt-3 rounded-md bg-danger/10 p-2 text-xs text-danger">{error}</p>}
    <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[10px] uppercase text-foreground-muted"><th className="p-2">Utilizador</th><th className="p-2">Perfil</th><th className="p-2">Estado</th></tr></thead><tbody>{users.map((entry) => <tr key={entry.ID_User} className="border-b border-border/50"><td className="p-2">{entry.User_Name ?? `Utilizador ${entry.ID_User}`}</td><td className="p-2"><Badge tone={entry.Admin ? 'warning' : 'success'}>{entry.Admin ? 'ADMIN' : 'USER'}</Badge></td><td className="p-2">{entry.Cancelado ? 'Cancelado' : 'Ativo'}</td></tr>)}</tbody></table></div>
  </section>
}
