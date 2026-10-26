import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Trash2 } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FieldError } from '@/components/ui/FieldError'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'

describe('Button', () => {
  it('defaults to type="button" and calls onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'button')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and busy while loading', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders its child with button styling when asChild', () => {
    render(
      <Button asChild>
        <a href="/dashboard">Go</a>
      </Button>,
    )
    expect(screen.getByRole('link', { name: 'Go' })).toHaveClass('bg-brand')
  })
})

describe('IconButton', () => {
  it('requires and exposes an accessible label', () => {
    render(<IconButton label="Delete contract" icon={<Trash2 />} />)
    expect(screen.getByRole('button', { name: 'Delete contract' })).toBeInTheDocument()
  })
})

describe('Badge', () => {
  it.each([
    ['success', 'text-success-700'],
    ['warning', 'text-warning-900'],
    ['danger', 'text-danger-700'],
  ] as const)('%s tone uses AA-compliant text colour', (tone, textClass) => {
    render(<Badge tone={tone}>Label</Badge>)
    expect(screen.getByText('Label')).toHaveClass(textClass)
  })
})

describe('Input + FieldError', () => {
  it('marks invalid inputs and links the error', () => {
    render(
      <>
        <Input aria-label="Email" invalid aria-describedby="email-error" />
        <FieldError id="email-error">Enter a valid email address</FieldError>
      </>,
    )
    const input = screen.getByRole('textbox', { name: 'Email' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a valid email address')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address')
  })

  it('FieldError renders nothing without a message', () => {
    const { container } = render(<FieldError id="x" />)
    expect(container).toBeEmptyDOMElement()
  })
})
