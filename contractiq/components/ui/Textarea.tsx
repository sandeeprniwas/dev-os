'use client'

import { forwardRef, useCallback, useEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'
import { fieldBaseClass, fieldInvalidClass } from './Input'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
  /** Grow with content up to `maxRows`, then scroll. */
  autoGrow?: boolean
  maxRows?: number
}

const LINE_HEIGHT_PX = 20 // text-body line height
const VERTICAL_PADDING_PX = 16 // py-2 top + bottom
const BORDER_PX = 2

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, autoGrow = false, maxRows = 6, rows = 1, className, onInput, value, ...props },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )

  const resize = useCallback(() => {
    const node = innerRef.current
    if (!node || !autoGrow) return
    const maxHeight = maxRows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX + BORDER_PX
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight + BORDER_PX, maxHeight)}px`
    node.style.overflowY = node.scrollHeight + BORDER_PX > maxHeight ? 'auto' : 'hidden'
  }, [autoGrow, maxRows])

  useEffect(resize, [resize, value])

  return (
    <textarea
      ref={setRefs}
      rows={rows}
      value={value}
      aria-invalid={invalid || undefined}
      onInput={(event) => {
        resize()
        onInput?.(event)
      }}
      className={cn(fieldBaseClass, 'resize-none py-2', invalid && fieldInvalidClass, className)}
      {...props}
    />
  )
})
