import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge must know the design system's custom type scale; otherwise it treats `text-body-lg`
 * as a text *colour* and drops a real colour such as `text-fg-inverse` from the same element.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['h1', 'h2', 'h3', 'h4', 'h5', 'body-lg', 'body', 'body-sm'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
