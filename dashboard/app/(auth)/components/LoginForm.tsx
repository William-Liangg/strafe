"use client"

import { useState } from "react"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<"signin" | "signup">("signin")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1400))
    setLoading(false)
  }

  return (
    <div className="flex flex-col w-full max-w-[380px] gap-8">
      {/* Header */}
      <div>
        <h1 className="text-[var(--foreground)] text-2xl font-semibold tracking-tight mb-1">
          {tab === "signin" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">
          {tab === "signin"
            ? "Sign in to continue to Strafe"
            : "Start your journey with Strafe"}
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1 gap-1">
        {(["signin", "signup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ease-out ${
              tab === t
                ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/5"
            }`}
          >
            {t === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      {/* OAuth + Divider */}
      <div className="flex flex-col gap-5">
        <OAuthButton
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
              <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
              <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" fill="#2EB67D"/>
              <path d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.528 2.528 0 0 1-2.521-2.522 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z" fill="#ECB22E"/>
            </svg>
          }
          label="Continue with Slack"
        />
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-[var(--muted-foreground)] text-xs font-mono">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[var(--foreground)] text-xs font-medium uppercase tracking-widest font-mono"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none transition-all duration-200 ease-out hover:border-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20 focus:shadow-[0_0_0_4px_rgba(255,255,255,0.03)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[var(--foreground)] text-xs font-medium uppercase tracking-widest font-mono"
            >
              Password
            </label>
            {tab === "signin" && (
              <a
                href="#"
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              >
                Forgot?
              </a>
            )}
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={tab === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3.5 py-2.5 pr-10 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none transition-all duration-200 ease-out hover:border-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20 focus:shadow-[0_0_0_4px_rgba(255,255,255,0.03)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="relative mt-1 w-full rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 ease-out hover:shadow-[0_4px_16px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] active:shadow-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2 overflow-hidden"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>{tab === "signin" ? "Signing in..." : "Creating account..."}</span>
            </>
          ) : (
            <span>{tab === "signin" ? "Sign in" : "Create account"}</span>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-xs text-[var(--muted-foreground)]">
        By continuing, you agree to our{" "}
        <a href="#" className="text-[var(--foreground)] hover:underline underline-offset-2 transition-colors">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="text-[var(--foreground)] hover:underline underline-offset-2 transition-colors">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}

function OAuthButton({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      className="group flex items-center justify-center gap-2.5 w-full rounded-lg border border-[var(--border)] bg-[var(--secondary)] py-2.5 text-sm text-[var(--foreground)] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent)] hover:border-[var(--ring)] hover:shadow-[0_0_0_3px_rgba(255,255,255,0.03)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
    >
      <span className="transition-transform duration-200 group-hover:scale-110">{icon}</span>
      {label}
    </button>
  )
}
