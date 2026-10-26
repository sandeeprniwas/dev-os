'use client'

import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { Input, type InputProps } from '@/components/ui/Input'

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className="pr-12" {...props} />
      <IconButton
        label={visible ? 'Hide password' : 'Show password'}
        icon={visible ? <EyeOff /> : <Eye />}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1"
        aria-pressed={visible}
      />
    </div>
  )
})
