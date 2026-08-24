import { useId, type ReactNode } from 'react'
import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ConnectionFormValues } from './connection-form-schema'

interface ConnectionConfigFormProps {
  register: UseFormRegister<ConnectionFormValues>
  errors: FieldErrors<ConnectionFormValues>
  disabled?: boolean
}

export function ConnectionConfigForm({
  register,
  errors,
  disabled = false,
}: ConnectionConfigFormProps) {
  return (
    <fieldset disabled={disabled} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <legend className="sr-only">Ad-hoc SQL Server connection</legend>

      <LabeledField label="Profile name" error={errors.name?.message}>
        {(id, errorId) => (
          <Input
            id={id}
            placeholder="Portugal Office Production"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errorId}
            {...register('name')}
          />
        )}
      </LabeledField>

      <LabeledField label="Network" error={errors.networkMode?.message}>
        {(id, errorId) => (
          <Select
            id={id}
            aria-invalid={Boolean(errors.networkMode)}
            aria-describedby={errorId}
            {...register('networkMode')}
          >
            <option value="lan">LAN</option>
            <option value="private-remote">Private remote / VPN</option>
            <option value="cloud">Approved cloud network</option>
          </Select>
        )}
      </LabeledField>

      <LabeledField label="Server" error={errors.server?.message}>
        {(id, errorId) => (
          <Input
            id={id}
            placeholder="sql-orders.internal"
            autoComplete="off"
            aria-invalid={Boolean(errors.server)}
            aria-describedby={errorId}
            {...register('server')}
          />
        )}
      </LabeledField>

      <LabeledField label="Port" error={errors.port?.message}>
        {(id, errorId) => (
          <Input
            id={id}
            type="number"
            min={1}
            max={65535}
            inputMode="numeric"
            aria-invalid={Boolean(errors.port)}
            aria-describedby={errorId}
            {...register('port', { valueAsNumber: true })}
          />
        )}
      </LabeledField>

      <LabeledField label="Database" optional error={errors.database?.message}>
        {(id, errorId) => (
          <Input
            id={id}
            placeholder="Orders"
            autoComplete="off"
            aria-invalid={Boolean(errors.database)}
            aria-describedby={errorId}
            {...register('database')}
          />
        )}
      </LabeledField>

      <LabeledField label="Username" error={errors.user?.message}>
        {(id, errorId) => (
          <Input
            id={id}
            placeholder="orders_app"
            autoComplete="off"
            aria-invalid={Boolean(errors.user)}
            aria-describedby={errorId}
            {...register('user')}
          />
        )}
      </LabeledField>

      <LabeledField label="Password" error={errors.password?.message}>
        {(id, errorId) => (
          <Input
            id={id}
            type="password"
            autoComplete="off"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errorId}
            {...register('password')}
          />
        )}
      </LabeledField>

      <LabeledField label="Table name" optional error={errors.table?.message}>
        {(id, errorId) => (
          <Input
            id={id}
            placeholder="V_Order_List"
            autoComplete="off"
            aria-invalid={Boolean(errors.table)}
            aria-describedby={errorId}
            {...register('table')}
          />
        )}
      </LabeledField>
    </fieldset>
  )
}

function LabeledField({
  label,
  optional = false,
  error,
  children,
}: {
  label: string
  optional?: boolean
  error?: string
  children: (id: string, errorId: string | undefined) => ReactNode
}) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={id}
        className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-foreground/50"
      >
        {label}
        {optional && (
          <span className="normal-case tracking-normal text-foreground/40">(optional)</span>
        )}
      </label>
      {children(id, errorId)}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  )
}
