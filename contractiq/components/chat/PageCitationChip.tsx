'use client'

type PageCitationChipProps = { page: number; onSelect: (page: number) => void }

export function PageCitationChip({ page, onSelect }: PageCitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(page)}
      aria-label={`Go to page ${page}`}
      className="mx-0.5 inline-flex items-center rounded-sm bg-brand-50 px-2 py-0.5 align-baseline text-body-sm font-medium text-brand-700 hover:bg-brand-100"
    >
      Page {page}
    </button>
  )
}
