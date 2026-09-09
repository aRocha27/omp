import type { Role } from '@/domain/models/user'
import { RepositoryError } from '@/services/contracts/orders.repository'

export function assertMockMutationRole(role: Role, message: string): void {
  if (role !== 'user' && role !== 'editor' && role !== 'admin') {
    throw new RepositoryError('forbidden', message)
  }
}
