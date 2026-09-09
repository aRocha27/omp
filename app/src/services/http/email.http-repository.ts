import type { Role } from '@/domain/models/user'
import type { EmailRepository } from '@/services/contracts/email.repository'
import { postJson, unwrapApiFailure, type ApiFailure } from './_shared'

export class HttpEmailRepository implements EmailRepository {
  async sendOrderDocuments(
    orderId: number,
    documentIds: number[],
    role: Role,
    attachments?: Record<number, string>,
  ) {
    const data = await postJson<{ ok: true; sent: number; recipient: string } | ApiFailure>(
      '/orders/email',
      { orderId, documentIds, attachments },
      role,
    )
    const result = unwrapApiFailure(data)
    return { sent: result.sent, recipient: result.recipient }
  }

  async sendDocuments(
    documentIds: number[],
    role: Role,
    attachments?: Record<number, string>,
    attachmentNames?: Record<number, string>,
    recipients?: Record<number, string[]>,
  ) {
    const data = await postJson<{ ok: true; sent: number; recipient: string } | ApiFailure>(
      '/orders/email-all',
      { documentIds, attachments, attachmentNames, recipients },
      role,
    )
    const result = unwrapApiFailure(data)
    return { sent: result.sent, recipient: result.recipient }
  }
}
