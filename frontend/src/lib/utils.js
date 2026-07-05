import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names.
 * Accepts the same inputs as clsx and dedupes conflicting utilities
 * via tailwind-merge.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
