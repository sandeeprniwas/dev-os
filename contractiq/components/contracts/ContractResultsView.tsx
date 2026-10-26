'use client'

import { MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { MobileBrowserBanner } from '@/components/layout/MobileBrowserBanner'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { ContractViewer } from '@/components/viewer/ContractViewer'
import { useContract } from '@/hooks/use-contract'
import { useIsDesktop } from '@/hooks/use-is-desktop'
import { publicEnv } from '@/lib/public-env'
import { confidenceLevel } from '@/lib/utils/confidence'
import { useReviewStore, type MobileTab, type PanelTab } from '@/stores/review-store'
import type { ContractDetailDTO, KeyTermDTO } from '@/types/api'
import { CalibrationBanner, LegalDisclaimerBanner, TypeMismatchBanner } from './Banners'
import { FeedbackWidget } from './FeedbackWidget'
import { KeyTermsPanel } from './KeyTermsPanel'
import { ReprocessPanel } from './ReprocessPanel'
import { ResultsHeader } from './ResultsHeader'

export function ContractResultsView({ initialData }: { initialData: ContractDetailDTO }) {
  const contractId = initialData.contract.id
  const { data } = useContract(contractId, initialData)
  const detail = data ?? initialData
  const { contract, keyTerms, customTerms, feedback } = detail

  const isDesktop = useIsDesktop()
  const { focusTerm, goToPage, activeTab, setActiveTab, mobileTab, setMobileTab, reset } = useReviewStore()
  const autoFocused = useRef(false)

  useEffect(() => () => reset(), [reset])

  const handleFocusTerm = useCallback(
    (term: KeyTermDTO) => {
      focusTerm(term.id, term.pageNumber, term.sourceSentence)
      if (!isDesktop) setMobileTab('document')
    },
    [focusTerm, isDesktop, setMobileTab],
  )

  const handleCite = useCallback(
    (page: number) => {
      goToPage(page)
      if (!isDesktop) setMobileTab('document')
    },
    [goToPage, isDesktop, setMobileTab],
  )

  // PRD Flow 3 step 8: on load, jump to the first low-confidence term so it can be verified.
  useEffect(() => {
    if (autoFocused.current || contract.status !== 'completed') return
    autoFocused.current = true
    const firstLow = keyTerms.find((term) => confidenceLevel(term.confidenceScore) === 'low' && term.pageNumber)
    if (firstLow) focusTerm(firstLow.id, firstLow.pageNumber, firstLow.sourceSentence)
  }, [contract.status, keyTerms, focusTerm])

  if (contract.status !== 'completed') {
    return (
      <div className="flex flex-col gap-6">
        <ResultsHeader contract={contract} />
        <LegalDisclaimerBanner />
        <ReprocessPanel contract={contract} customTerms={customTerms} />
      </div>
    )
  }

  const viewer = (
    <ContractViewer
      contractId={contract.id}
      signedUrl={contract.signedUrl}
      contractText={contract.contractText}
      pageCount={contract.pageCount}
      title={contract.title}
    />
  )
  const termsPanel = (
    <div className="flex flex-col gap-6">
      <KeyTermsPanel contractId={contract.id} contractType={contract.contractType} terms={keyTerms} onFocusTerm={handleFocusTerm} />
      <FeedbackWidget contractId={contract.id} initial={feedback} />
    </div>
  )
  const chatPanel = <ChatPanel contractId={contract.id} contractType={contract.contractType} onCite={handleCite} />

  return (
    <div className="flex flex-col gap-4">
      <MobileBrowserBanner />
      <ResultsHeader contract={contract} />
      <LegalDisclaimerBanner />
      <TypeMismatchBanner contractId={contract.id} selected={contract.contractType} detected={contract.detectedType} />
      {publicEnv.calibrationWarning && <CalibrationBanner />}

      {isDesktop ? (
        <PanelGroup direction="horizontal" className="h-[calc(100vh-14rem)] min-h-[560px] rounded-lg border border-border bg-surface">
          <Panel defaultSize={60} minSize={35} className="overflow-hidden rounded-l-lg">
            {viewer}
          </Panel>
          <PanelResizeHandle
            className="w-1.5 bg-border transition-colors duration-micro hover:bg-brand-200 data-[resize-handle-state=drag]:bg-brand"
            aria-label="Resize panels"
          />
          <Panel defaultSize={40} minSize={28} className="flex flex-col">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PanelTab)} className="flex h-full flex-col">
              <TabsList className="shrink-0 px-2">
                <TabsTrigger value="terms">Key terms ({keyTerms.length})</TabsTrigger>
                <TabsTrigger value="chat" data-tour="chat">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Chat
                </TabsTrigger>
              </TabsList>
              <TabsContent value="terms" className="flex-1 overflow-y-auto bg-page p-4">
                {termsPanel}
              </TabsContent>
              <TabsContent value="chat" className="min-h-0 flex-1 p-4">
                {chatPanel}
              </TabsContent>
            </Tabs>
          </Panel>
        </PanelGroup>
      ) : (
        <Tabs value={mobileTab} onValueChange={(value) => setMobileTab(value as MobileTab)} className="flex flex-col">
          <TabsList className="sticky top-16 z-10 bg-surface">
            <TabsTrigger value="document">Document</TabsTrigger>
            <TabsTrigger value="terms">Key terms</TabsTrigger>
            <TabsTrigger value="chat" data-tour="chat">
              Chat
            </TabsTrigger>
          </TabsList>
          <TabsContent value="document" forceMount className="h-[75vh] data-[state=inactive]:hidden">
            {viewer}
          </TabsContent>
          <TabsContent value="terms" className="pt-4">
            {termsPanel}
          </TabsContent>
          <TabsContent value="chat" className="h-[75vh] pt-4">
            {chatPanel}
          </TabsContent>
        </Tabs>
      )}

      {!isDesktop && mobileTab !== 'chat' && (
        <button
          type="button"
          onClick={() => setMobileTab('chat')}
          aria-label="Chat with contract"
          className="fixed bottom-6 right-6 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-fg-inverse hover:bg-brand-600"
        >
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      <OnboardingTour />
    </div>
  )
}
