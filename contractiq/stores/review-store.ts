import { create } from 'zustand'

export type ViewerTarget = { page: number | null; text: string | null; termId: string | null; nonce: number }
export type MobileTab = 'document' | 'terms' | 'chat'
export type PanelTab = 'terms' | 'chat'
export type TermSortMode = 'document' | 'confidence'

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 2
export const ZOOM_STEP = 0.25

type ReviewState = {
  target: ViewerTarget
  activeTab: PanelTab
  mobileTab: MobileTab
  zoom: number
  sortMode: TermSortMode
  focusTerm: (termId: string | null, page: number | null, text: string | null) => void
  goToPage: (page: number) => void
  setActiveTab: (tab: PanelTab) => void
  setMobileTab: (tab: MobileTab) => void
  setZoom: (zoom: number) => void
  setSortMode: (mode: TermSortMode) => void
  reset: () => void
}

const initialTarget: ViewerTarget = { page: null, text: null, termId: null, nonce: 0 }

export const useReviewStore = create<ReviewState>((set, get) => ({
  target: initialTarget,
  activeTab: 'terms',
  mobileTab: 'terms',
  zoom: 1,
  sortMode: 'document',
  // A new nonce on every call forces the viewer to re-scroll even when the same page is clicked twice.
  focusTerm: (termId, page, text) => set({ target: { termId, page, text, nonce: get().target.nonce + 1 } }),
  goToPage: (page) => set({ target: { termId: null, page, text: null, nonce: get().target.nonce + 1 } }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom / ZOOM_STEP) * ZOOM_STEP)) }),
  setSortMode: (sortMode) => set({ sortMode }),
  reset: () => set({ target: initialTarget, activeTab: 'terms', mobileTab: 'terms', zoom: 1, sortMode: 'document' }),
}))
