import { useState, type FormEvent } from 'react'
import { useAuth } from '@/app/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginPage() {
  const auth = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [firstLogin, setFirstLogin] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setBusy(true); try { if (firstLogin) await auth.completeFirstLogin(username, password, confirmation); else setFirstLogin((await auth.login(username, password)).firstLogin) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid username or password.') } finally { setBusy(false) } }
  return <main className="flex min-h-full items-center justify-center bg-background p-4"><form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border bg-surface p-7 shadow-lg"><div className="mb-8"><img src="/paperfold-logo.svg" alt="Paperfold Stationery" className="mb-6 h-16 w-full object-contain object-left" /><h1 className="text-2xl font-semibold">{firstLogin ? 'Define a sua password' : 'Login'}</h1><p className="mt-2 text-sm text-foreground-muted">{firstLogin ? 'Este é o seu primeiro acesso.' : 'Access the Order Platform'}</p></div><label className="mb-4 block text-sm font-medium">Username<Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" disabled={firstLogin} required /></label><label className="mb-4 block text-sm font-medium">{firstLogin ? 'Nova password' : 'Password'}<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={firstLogin ? 'new-password' : 'current-password'} required={firstLogin} /></label>{firstLogin && <label className="mb-5 block text-sm font-medium">Confirmar password<Input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" required /></label>}{error && <p role="alert" className="mb-4 rounded-md bg-danger-muted px-3 py-2 text-sm text-danger">{error}</p>}<Button type="submit" className="w-full" disabled={busy}>{busy ? 'A validar...' : firstLogin ? 'Criar password' : 'Login'}</Button></form></main>
}
