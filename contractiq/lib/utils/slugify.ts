/** Lowercase ASCII slug: letters, digits and single hyphens. Returns '' when nothing usable remains. */
export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
}

export function stripPdfExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, '').trim()
}
