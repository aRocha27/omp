import type { Role } from '@/domain/models/user'

export interface EmailRepository {
  sendOrderDocuments(
    orderId: number,
    documentIds: number[],
    role: Role,
    attachments?: Record<number, string>,
  ): Promise<{ sent: number; recipient: string }>
  sendDocuments(
    documentIds: number[],
    role: Role,
    attachments?: Record<number, string>,
    attachmentNames?: Record<number, string>,
    recipients?: Record<number, string[]>,
  ): Promise<{ sent: number; recipient: string }>
}
