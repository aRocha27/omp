import { clsx, type ClassValue } from 'clsx'

/**
 * Merge conditional class names.
 *
 * Thin wrapper over `clsx` so call sites stay agnostic of the implementation;
 * if `tailwind-merge` is added later to de-duplicate Tailwind classes, this is
 * the single seam to update.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}