import type { Role } from '@/domain/models/user'
import type { EmailRepository } from '@/services/contracts/email.repository'
import type { MockDataStore } from './mock-data-store'

export class MockEmailRepository implements EmailRepository {
  constructor(private readonly store?: MockDataStore) {}

  async sendOrderDocuments(
    _orderId: number,
    documentIds: number[],
    _role: Role,
    _attachments?: Record<number, string>,
  ) {
    this.markSent(documentIds)
    return { sent: documentIds.length, recipient: 'test@example.com' }
  }

  async sendDocuments(
    documentIds: number[],
    _role: Role,
    _attachments?: Record<number, string>,
    _attachmentNames?: Record<number, string>,
    _recipients?: Record<number, string[]>,
  ) {
    this.markSent(documentIds)
    return { sent: documentIds.length, recipient: 'test@example.com' }
  }

  private markSent(documentIds: number[]): void {
    if (!this.store) return
    const selected = new Set(documentIds)
    for (const document of this.store.facturacao) {
      if (selected.has(document.ID_Facturacao)) document.Imprimiu = true
    }
  }
}
