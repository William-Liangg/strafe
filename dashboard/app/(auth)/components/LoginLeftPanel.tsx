"use client"

import { useEffect, useRef } from "react"

const testimonials = [
  {
    quote: "Finally, a tool that actually understands how engineering teams work. Our sprint planning is 10x better.",
    author: "Sarah Chen",
    role: "CS Student at Yale",
  },
  {
    quote: "We built this for our hackathon and now use it daily. The auto-classification is scary accurate.",
    author: "Marcus Rivera",
    role: "CS Student at Harvard",
  },
  {
    quote: "Strafe caught scope creep we didn't even notice. Saved our capstone project.",
    author: "Emily Park",
    role: "CS Student at Princeton",
  },
]

export function LoginLeftPanel() {
  return (
    <div
      className="relative hidden lg:flex flex-col justify-between h-full overflow-hidden select-none"
      style={{ background: "var(--panel-left)" }}
    >
      {/* Noise texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px",
        }}
      />

      {/* Subtle radial glow top-left */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full z-0"
        style={{
          background:
            "radial-gradient(circle, oklch(0.75 0 0 / 0.045) 0%, transparent 70%)",
        }}
      />

      {/* Logo / Brand */}
      <div className="relative z-10 p-10">
        <div className="flex items-center gap-2.5 group cursor-default">
          <div className="w-7 h-7 rounded-md bg-[var(--foreground)] flex items-center justify-center transition-transform duration-200 ease-out group-hover:scale-110">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </div>
          <span className="text-[var(--foreground)] text-[15px] font-semibold tracking-tight transition-colors duration-200">
            strafe
          </span>
        </div>
      </div>

      {/* Center headline */}
      <div className="relative z-10 px-10">
        <p className="text-[var(--muted-foreground)] text-xs font-mono uppercase tracking-widest mb-5">
          Sprint Intelligence
        </p>
        <h2 className="text-[var(--foreground)] text-4xl font-semibold leading-[1.15] tracking-tight text-balance">
          Detect.
          <br />
          Classify.
          <br />
          <span className="text-[var(--muted-foreground)]">Assign.</span>
        </h2>

        {/* Floating pill stats */}
        <div className="flex flex-wrap gap-3 mt-10">
          {[
            { label: "Teams", value: "850+" },
            { label: "Tickets triaged", value: "2.1M" },
            { label: "Hours saved", value: "47k" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3 transition-all duration-200 ease-out hover:border-[var(--muted-foreground)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] cursor-default"
            >
              <span className="text-[var(--foreground)] text-lg font-semibold tabular-nums">
                {s.value}
              </span>
              <span className="text-[var(--muted-foreground)] text-[11px] font-mono uppercase tracking-wider">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonial ticker */}
      <div className="relative z-10 pb-10 overflow-hidden">
        <div className="mb-4 px-10">
          <div className="h-px bg-[var(--divider)]" />
        </div>
        <div className="px-10">
          <RotatingTestimonial />
        </div>
      </div>
    </div>
  )
}

function RotatingTestimonial() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let current = 0
    const rotate = () => {
      current = (current + 1) % testimonials.length
      const t = testimonials[current]
      el.style.opacity = "0"
      el.style.transform = "translateY(8px)"
      setTimeout(() => {
        const quoteEl = el.querySelector("[data-quote]")
        const authorEl = el.querySelector("[data-author]")
        const roleEl = el.querySelector("[data-role]")
        if (quoteEl) quoteEl.textContent = `"${t.quote}"`
        if (authorEl) authorEl.textContent = t.author
        if (roleEl) roleEl.textContent = t.role
        el.style.transition = "opacity 0.5s ease, transform 0.5s ease"
        el.style.opacity = "1"
        el.style.transform = "translateY(0)"
      }, 350)
    }

    el.style.transition = "opacity 0.5s ease, transform 0.5s ease"

    const interval = setInterval(rotate, 4500)
    return () => clearInterval(interval)
  }, [])

  const t = testimonials[0]

  return (
    <div ref={containerRef}>
      <p
        data-quote
        className="text-[var(--foreground)] text-sm leading-relaxed mb-3"
      >
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex items-center gap-2 group cursor-default">
        <div className="w-5 h-5 rounded-full bg-[var(--accent)] border border-[var(--border)] transition-transform duration-200 group-hover:scale-110" />
        <span data-author className="text-[var(--foreground)] text-xs font-medium">
          {t.author}
        </span>
        <span className="text-[var(--muted-foreground)] text-xs">·</span>
        <span data-role className="text-[var(--muted-foreground)] text-xs">
          {t.role}
        </span>
      </div>
    </div>
  )
}
