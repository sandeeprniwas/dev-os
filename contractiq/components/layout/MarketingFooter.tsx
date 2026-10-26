export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-6 py-8 text-body-sm text-fg-muted md:flex-row md:items-center md:justify-between md:px-28">
        <p>Powered by OpenAI GPT-4o</p>
        <p>ContractIQ is an AI-assisted review tool, not legal advice.</p>
        <p>© {new Date().getFullYear()} ContractIQ</p>
      </div>
    </footer>
  )
}
