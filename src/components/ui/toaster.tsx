'use client'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  Toast, ToastClose, ToastDescription, ToastProvider,
  ToastTitle, ToastViewport,
} from '@/components/ui/toast'

type Variant = 'default' | 'destructive' | 'success' | 'warning' | 'info'

const ICON: Record<Variant, React.ReactNode> = {
  default: <Info className="h-4 w-4 text-[#1e3a5f] flex-shrink-0 mt-0.5" />,
  destructive: <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />,
  info: <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />,
}

export function Toaster() {
  const { toasts } = useToast()
  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, action, variant, ...props }) => {
        const v = (variant ?? 'default') as Variant
        return (
          <Toast key={id} variant={variant} {...props}>
            {ICON[v]}
            <div className="flex-1 min-w-0">
              {title && (
                <ToastTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
