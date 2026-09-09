import type { InvoicingSnapshot } from '@/domain/models/invoicing'
import type { InvoicingRepository } from '@/services/contracts/invoicing.repository'
import {
  getJsonReadOnly,
  toRepositoryErrorReadOnly,
  type ApiFailure,
} from '@/services/http/_shared'

interface OkInvoicingResponse {
  ok: true
  invoicing: InvoicingSnapshot
}

export class HttpInvoicingRepository implements InvoicingRepository {
  async getSnapshot(): Promise<InvoicingSnapshot> {
    const data = await getJsonReadOnly<OkInvoicingResponse | ApiFailure>('/invoicing')
    if (!data.ok) throw toRepositoryErrorReadOnly(data)
    return {
      amountToInvoice: data.invoicing.amountToInvoice,
      notFullyInvoiced: data.invoicing.notFullyInvoiced.map((row) => ({ ...row })),
      warrantyMissing: data.invoicing.warrantyMissing.map((row) => ({ ...row })),
      pendingRecognition: data.invoicing.pendingRecognition?.map((row) => ({ ...row })) ?? [],
      pendingRecognitionTotal: data.invoicing.pendingRecognitionTotal,
    }
  }
}
