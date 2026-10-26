'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type { ViewerTarget } from '@/stores/review-store'

/**
 * Shared by the PDF and text viewers: registers page elements, scrolls to the target page on every
 * new target (nonce), and tracks which page is most visible (toolbar indicator + lazy rendering).
 */
export function usePageNavigation(target: ViewerTarget) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef(new Map<number, HTMLElement>())
  const ratios = useRef(new Map<number, number>())
  const [visiblePage, setVisiblePage] = useState(1)
  const [nearPages, setNearPages] = useState<Set<number>>(() => new Set([1, 2]))
  const reducedMotion = useReducedMotion()
  const observer = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page)
          ratios.current.set(page, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        let best = 1
        let bestRatio = -1
        const near = new Set<number>()
        ratios.current.forEach((ratio, page) => {
          if (ratio > 0) {
            near.add(page)
            near.add(page - 1)
            near.add(page + 1)
          }
          if (ratio > bestRatio) {
            best = page
            bestRatio = ratio
          }
        })
        setVisiblePage(best)
        setNearPages((previous) => {
          const merged = new Set(previous)
          near.forEach((page) => merged.add(page))
          return merged.size === previous.size ? previous : merged
        })
      },
      { root, rootMargin: '100% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    pageRefs.current.forEach((element) => observer.current?.observe(element))
    return () => observer.current?.disconnect()
  }, [])

  const registerPage = useCallback(
    (page: number) => (element: HTMLElement | null) => {
      const previous = pageRefs.current.get(page)
      if (previous && previous !== element) observer.current?.unobserve(previous)
      if (element) {
        element.dataset.page = String(page)
        pageRefs.current.set(page, element)
        observer.current?.observe(element)
      } else {
        pageRefs.current.delete(page)
      }
    },
    [],
  )

  const scrollToPage = useCallback(
    (page: number) => {
      setNearPages((previous) => new Set(previous).add(page).add(page + 1))
      pageRefs.current.get(page)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    },
    [reducedMotion],
  )

  useEffect(() => {
    if (target.page) scrollToPage(target.page)
  }, [target.nonce, target.page, scrollToPage])

  return { containerRef, registerPage, visiblePage, nearPages, scrollToPage, reducedMotion }
}
