"use client"

import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useIntegrationStatus } from "@/lib/hooks"
import { disconnectIntegration, getIntegrationConnectUrl } from "@/lib/api"
import type { ServiceStatus } from "@/lib/types"
import { mutate } from "swr"

interface IntegrationsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function IntegrationsModal({ isOpen, onClose }: IntegrationsModalProps) {
  const { data, isLoading } = useIntegrationStatus()
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const handleDisconnect = async (service: string) => {
    setDisconnecting(service)
    try {
      await disconnectIntegration(service)
      await mutate("integrations")
    } catch (error) {
      console.error("Failed to disconnect:", error)
    } finally {
      setDisconnecting(null)
    }
  }

  const handleConnect = (service: string) => {
    window.location.href = getIntegrationConnectUrl(service)
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700/50 rounded-xl w-full max-w-md p-6 z-50 shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">
                Integrations
              </Dialog.Title>
              <Dialog.Description className="text-sm text-zinc-400 mt-1">
                Connect your tools to power the Strafe agent
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="text-zinc-400 hover:text-white transition-colors p-1 -mr-1 -mt-1">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          {/* Integration Cards */}
          <div className="space-y-3">
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <IntegrationCard
                  icon={<JiraIcon />}
                  name="Jira"
                  description="Create and sync tickets automatically"
                  status={data?.jira}
                  statusLabel={data?.jira.workspace}
                  onConnect={() => handleConnect("jira")}
                  onDisconnect={() => handleDisconnect("jira")}
                  isDisconnecting={disconnecting === "jira"}
                />
                <IntegrationCard
                  icon={<GitHubIcon />}
                  name="GitHub"
                  description="Build expertise map from PR history"
                  status={data?.github}
                  statusLabel={data?.github.org}
                  onConnect={() => handleConnect("github")}
                  onDisconnect={() => handleDisconnect("github")}
                  isDisconnecting={disconnecting === "github"}
                />
                <IntegrationCard
                  icon={<GoogleCalendarIcon />}
                  name="Google Calendar"
                  description="Check engineer availability before assigning"
                  status={data?.google_calendar}
                  statusLabel={data?.google_calendar.user || (data?.google_calendar.connected ? "Connected" : undefined)}
                  onConnect={() => handleConnect("google_calendar")}
                  onDisconnect={() => handleDisconnect("google_calendar")}
                  isDisconnecting={disconnecting === "google_calendar"}
                />
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface IntegrationCardProps {
  icon: React.ReactNode
  name: string
  description: string
  status?: ServiceStatus
  statusLabel?: string
  onConnect: () => void
  onDisconnect: () => void
  isDisconnecting: boolean
}

function IntegrationCard({
  icon,
  name,
  description,
  status,
  statusLabel,
  onConnect,
  onDisconnect,
  isDisconnecting,
}: IntegrationCardProps) {
  const isConnected = status?.connected ?? false

  return (
    <div
      className={`bg-zinc-800/50 border rounded-lg p-4 ${
        isConnected
          ? "border-zinc-700/50 border-l-2 border-l-green-500"
          : "border-zinc-700/50 border-l-2 border-l-zinc-600"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-zinc-700/50 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-white">{name}</h3>
            {isConnected ? (
              <button
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
              >
                {isDisconnecting ? "..." : "Disconnect"}
              </button>
            ) : (
              <button
                onClick={onConnect}
                className="px-3 py-1 text-xs font-medium bg-white text-black rounded hover:bg-zinc-200 transition-colors"
              >
                Connect
              </button>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-0.5">{description}</p>

          {/* Status */}
          <div className="flex items-center gap-1.5 mt-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-zinc-500"
              }`}
            />
            <span className="text-xs text-zinc-400">
              {isConnected ? statusLabel || "Connected" : "Not connected"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-700/50" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="h-5 w-20 bg-zinc-700/50 rounded" />
            <div className="h-6 w-16 bg-zinc-700/50 rounded" />
          </div>
          <div className="h-4 w-48 bg-zinc-700/50 rounded mt-2" />
          <div className="h-3 w-24 bg-zinc-700/50 rounded mt-3" />
        </div>
      </div>
    </div>
  )
}

function JiraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53Z" fill="url(#jira-grad-1)"/>
      <path d="M6.77 6.8a4.36 4.36 0 0 0 4.34 4.38h1.8v1.7c0 2.4 1.93 4.35 4.33 4.36V7.65a.84.84 0 0 0-.84-.84H6.77Z" fill="url(#jira-grad-2)"/>
      <path d="M2 11.6c0 2.4 1.95 4.34 4.35 4.36h1.78v1.7A4.36 4.36 0 0 0 12.47 22v-9.56a.84.84 0 0 0-.84-.84H2Z" fill="url(#jira-grad-3)"/>
      <defs>
        <linearGradient id="jira-grad-1" x1="12.36" y1="2.04" x2="17.67" y2="7.3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC"/>
          <stop offset="1" stopColor="#2684FF"/>
        </linearGradient>
        <linearGradient id="jira-grad-2" x1="7.63" y1="6.86" x2="12.95" y2="12.15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC"/>
          <stop offset="1" stopColor="#2684FF"/>
        </linearGradient>
        <linearGradient id="jira-grad-3" x1="2.83" y1="11.66" x2="8.19" y2="16.96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC"/>
          <stop offset="1" stopColor="#2684FF"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function GoogleCalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 2H17.5C18.88 2 20 3.12 20 4.5V6H4V4.5C4 3.12 5.12 2 6.5 2Z" fill="#EA4335"/>
      <path d="M20 6V17.5C20 18.88 18.88 20 17.5 20H15V6H20Z" fill="#FBBC04"/>
      <path d="M15 20H6.5C5.12 20 4 18.88 4 17.5V15H15V20Z" fill="#34A853"/>
      <path d="M4 6V15H9V6H4Z" fill="#4285F4"/>
      <path d="M9 6H15V15H9V6Z" fill="white"/>
      <path d="M9 6H15V8H9V6Z" fill="#4285F4" fillOpacity="0.2"/>
      <text x="12" y="13.5" textAnchor="middle" fill="#1A73E8" fontSize="6" fontWeight="bold" fontFamily="Arial">31</text>
    </svg>
  )
}
