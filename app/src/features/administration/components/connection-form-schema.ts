import { z } from 'zod'

export const connectionFormSchema = z.object({
  name: z.string().trim().min(1, 'Profile name is required.'),
  networkMode: z.enum(['lan', 'private-remote', 'cloud']),
  server: z.string().trim().min(1, 'Server is required.'),
  port: z
    .number({ error: 'Port is required.' })
    .int('Port must be a whole number.')
    .min(1, 'Port must be between 1 and 65535.')
    .max(65535, 'Port must be between 1 and 65535.'),
  database: z.string(),
  user: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
  table: z.string(),
})

export type ConnectionFormValues = z.infer<typeof connectionFormSchema>
