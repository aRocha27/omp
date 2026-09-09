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
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Switch view">
      <div className="flex rounded-md border border-white/30 p-0.5">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className="rounded-[5px] px-2 py-1 text-xs font-medium capitalize text-white/80 transition-colors hover:text-white aria-pressed:bg-white aria-pressed:text-primary"
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
