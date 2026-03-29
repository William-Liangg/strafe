'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  message = 'Failed to load data',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="bg-white rounded-3xl p-8 text-center shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
      <div className="w-2 h-2 rounded-full bg-[#9f403d] mx-auto mb-4" />
      <p className="text-[#2d3526] font-medium mb-4 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-2xl transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  )
}
