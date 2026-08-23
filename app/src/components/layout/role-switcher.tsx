import { useRoleSwitcher } from '@/app/providers/user-provider'

/**
 * Development-only role switcher.
 *
 * Lets the UI be exercised under Viewer/Editor/Admin. Hidden buttons elsewhere
 * rely on this for UX testing — the server remains the authorization authority.
 */
export function RoleSwitcher() {
  const { role, setRole, roles } = useRoleSwitcher()
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Switch demo role">
      <span className="text-[11px] font-medium uppercase tracking-wider text-foreground/50">Role</span>
      <div className="flex rounded-md border border-border p-0.5">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className="rounded-[5px] px-2 py-1 text-xs font-medium capitalize transition-colors aria-pressed:bg-primary aria-pressed:text-white"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}