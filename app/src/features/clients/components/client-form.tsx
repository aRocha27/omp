import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { tpClientes } from '@/fixtures/reference-data'

const ALL_TYPES = ''

/**
 * Form draft — strings only, so `<input>` and `<select>` can own the input value.
 * Shared between Create (empty initial state) and Edit (pre-filled from the client row).
 */
export type ClientFormDraft = {
  nome: string
  morada: string
  local: string
  codpost: string
  no_PHC: string
  ncont: string
  ID_Tp_Cliente: string
  telefone: string
  contacto: string
  fax: string
  zona: string
}

export const emptyClientDraft: ClientFormDraft = {
  nome: '',
  morada: '',
  local: '',
  codpost: '',
  no_PHC: '',
  ncont: '',
  ID_Tp_Cliente: '',
  telefone: '',
  contacto: '',
  fax: '',
  zona: '',
}

interface ClientFormFieldsProps {
  draft: ClientFormDraft
  onChange: <K extends keyof ClientFormDraft>(key: K, value: ClientFormDraft[K]) => void
}

/**
 * The 11-field client form body. Used by both the create page and the inline edit
 * mode on the detail page. All seven user-required fields are marked `required` so
 * the browser enforces them — the create page converts the draft to a typed
 * `ClientCreateInput` on submit.
 */
export function ClientFormFields({ draft, onChange }: ClientFormFieldsProps) {
  return (
    <div className="mb-5 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold sm:col-span-2">
        Name *
        <Input
          required
          value={draft.nome}
          onChange={(e) => onChange('nome', e.target.value)}
          aria-label="Name"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold sm:col-span-2">
        Address *
        <Input
          required
          value={draft.morada}
          onChange={(e) => onChange('morada', e.target.value)}
          aria-label="Address"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold">
        Location *
        <Input
          required
          value={draft.local}
          onChange={(e) => onChange('local', e.target.value)}
          aria-label="Location"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold">
        Postal Code *
        <Input
          required
          value={draft.codpost}
          onChange={(e) => onChange('codpost', e.target.value)}
          aria-label="Postal Code"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold">
        SAP number *
        <Input
          required
          type="number"
          min="0"
          step="1"
          value={draft.no_PHC}
          onChange={(e) => onChange('no_PHC', e.target.value)}
          aria-label="SAP number"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold">
        Tax Number *
        <Input
          required
          value={draft.ncont}
          onChange={(e) => onChange('ncont', e.target.value)}
          aria-label="Tax Number"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold sm:col-span-2">
        Type *
        <Select
          required
          value={draft.ID_Tp_Cliente}
          onChange={(e) => onChange('ID_Tp_Cliente', e.target.value)}
          aria-label="Type"
          className="mt-1"
        >
          <option value={ALL_TYPES}>Select</option>
          {tpClientes.map((o) => (
            <option key={String(o.id)} value={String(o.id)}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>

      <div className="sm:col-span-2 mt-2 text-[11px] font-medium uppercase tracking-wider text-foreground/50">
        Optional
      </div>

      <label className="text-xs font-semibold">
        Phone
        <Input
          value={draft.telefone}
          onChange={(e) => onChange('telefone', e.target.value)}
          aria-label="Phone"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold">
        Fax
        <Input
          value={draft.fax}
          onChange={(e) => onChange('fax', e.target.value)}
          aria-label="Fax"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold">
        Contact name
        <Input
          value={draft.contacto}
          onChange={(e) => onChange('contacto', e.target.value)}
          aria-label="Contact name"
          className="mt-1"
        />
      </label>
      <label className="text-xs font-semibold">
        Zone
        <Input
          value={draft.zona}
          onChange={(e) => onChange('zona', e.target.value)}
          aria-label="Zone"
          className="mt-1"
        />
      </label>
    </div>
  )
}

/**
 * Convert a form draft to the typed `ClientCreateInput` shape the repository
 * expects. Returns `null` when a numeric field can't be coerced (e.g. the user
 * submitted an empty SAP field); the caller treats null as a no-op.
 */
export function draftToCreateInput(draft: ClientFormDraft) {
  const idTpCliente = draft.ID_Tp_Cliente === '' ? NaN : Number(draft.ID_Tp_Cliente)
  const noPhc = draft.no_PHC === '' ? NaN : Number(draft.no_PHC)
  if (Number.isNaN(idTpCliente) || Number.isNaN(noPhc)) return null
  return {
    nome: draft.nome.trim(),
    morada: draft.morada.trim(),
    local: draft.local.trim(),
    codpost: draft.codpost.trim(),
    no_PHC: noPhc,
    ncont: draft.ncont.trim(),
    ID_Tp_Cliente: idTpCliente,
    telefone: draft.telefone.trim() === '' ? null : draft.telefone.trim(),
    contacto: draft.contacto.trim() === '' ? null : draft.contacto.trim(),
    fax: draft.fax.trim() === '' ? null : draft.fax.trim(),
    zona: draft.zona.trim() === '' ? null : draft.zona.trim(),
  }
}
