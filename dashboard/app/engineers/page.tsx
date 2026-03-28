'use client'

import { Monitor, GitCommit, Filter, ArrowUpDown, AlertTriangle } from 'lucide-react'
import { useEngineers } from '@/lib/hooks'
import { getInitials } from '@/lib/utils'

// ─── hardcoded expertise data ────────────────────────────────────────────────

const EXPERTISE_CARDS = [
  {
    name: 'Maya Patel',
    rank: '01',
    accentHex: '#bd9dff',
    role: 'Backend Engineer',
    skills: [
      { name: 'quotes-service', pct: 94 },
      { name: 'billing-api', pct: 71 },
    ],
    prs: 8,
  },
  {
    name: 'Alex Chen',
    rank: '02',
    accentHex: '#d1c4ff',
    role: 'Platform Engineer',
    skills: [{ name: 'auth-service', pct: 88 }],
    prs: 12,
  },
  {
    name: 'Ryan Park',
    rank: '03',
    accentHex: '#ff6e84',
    role: 'DevOps / Infra',
    skills: [{ name: 'quotes-service', pct: 31 }],
    prs: 3,
  },
]

// per-rank styling for the load table
const AVATAR_BG = ['bg-[#b28cff]', 'bg-[#4f319c]', 'bg-[#c3b4fc]', 'bg-[#40485d]']
const AVATAR_TEXT = ['text-[#3c0089]', 'text-[#d7c8ff]', 'text-[#3d306f]', 'text-[#dee5ff]']
const HOURS_COLOR = ['text-[#bd9dff]', 'text-[#a88cfb]', 'text-[#d1c4ff]', 'text-[#6d758c]']

// ─── skeleton / error ────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-8 space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-[#141f38] border-2 border-black h-32" />
      ))}
    </div>
  )
}

function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-8">
      <div className="bg-[#a70138] border-2 border-black p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-[#ffb2b9] shrink-0" />
        <p className="flex-1 text-[#ffb2b9] font-medium">{message}</p>
        <button
          onClick={onRetry}
          className="bg-[#ff6e84] text-[#490013] px-4 py-2 border-2 border-black font-black shadow-[2px_2px_0px_0px_#000]"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

// ─── expertise card ───────────────────────────────────────────────────────────

function ExpertiseCard({ card }: { card: (typeof EXPERTISE_CARDS)[number] }) {
  return (
    <div className="relative group">
      {/* Parallax shadow div */}
      <div
        className="absolute inset-0 opacity-5 translate-x-2 translate-y-2 group-hover:translate-x-3 group-hover:translate-y-3 transition-transform"
        style={{ backgroundColor: card.accentHex }}
      />
      {/* Main card */}
      <div
        className="relative bg-[#0f1930] border-4 border-black p-6 overflow-hidden"
        style={{
          boxShadow: '4px 4px 0px 0px #000',
          background:
            'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%), #0f1930',
        }}
      >
        {/* Left accent strip */}
        <div
          className="absolute top-0 left-0 w-[3px] h-full"
          style={{ backgroundColor: card.accentHex }}
        />

        {/* Header row */}
        <div className="flex items-start justify-between mb-6 pl-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 border-2 border-black flex items-center justify-center font-black text-xl text-[#3c0089] shrink-0"
              style={{ backgroundColor: card.accentHex }}
            >
              {getInitials(card.name)}
            </div>
            <div>
              <h3
                className="text-xl font-black text-white"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {card.name}
              </h3>
              <p
                className="text-xs font-bold uppercase tracking-widest mt-0.5"
                style={{ color: card.accentHex, fontFamily: 'var(--font-space-grotesk)' }}
              >
                {card.role}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <GitCommit className="h-3 w-3 text-[#6d758c]" />
                <span className="text-xs text-[#6d758c]">{card.prs} PRs merged</span>
              </div>
            </div>
          </div>
          {/* Rank ghost */}
          <span
            className="text-3xl font-black text-[#40485d] opacity-20 italic shrink-0"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {card.rank}
          </span>
        </div>

        {/* Skill bars */}
        <div className="pl-4 space-y-4">
          {card.skills.map((skill, i) => (
            <div key={skill.name} className={i === 1 ? 'opacity-40 grayscale' : ''}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#a3aac4]">{skill.name}</span>
                <span
                  className="text-xs font-black"
                  style={{ color: card.accentHex, fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {skill.pct}%
                </span>
              </div>
              <div className="h-3 w-full bg-[#192540] border border-black overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${skill.pct}%`,
                    backgroundColor: card.accentHex,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function EngineersPage() {
  const { data, error, mutate } = useEngineers()

  const isLoading = !data && !error

  if (isLoading) return <PageSkeleton />
  if (error)
    return <PageError message="Failed to load engineer data" onRetry={() => mutate()} />

  const engineers = [...(data?.engineers ?? [])].sort(
    (a, b) => b.adhoc_tickets - a.adhoc_tickets
  )
  const maxPoints = Math.max(...engineers.map((e) => e.adhoc_points), 1)
  const totalTickets = engineers.reduce((sum, e) => sum + e.adhoc_tickets, 0)

  return (
    <div className="flex flex-col min-h-screen bg-[#060e20]">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b-4 border-black bg-slate-900/80 backdrop-blur-md flex justify-between items-center px-8 py-4 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]">
        <span
          className="text-3xl font-black italic tracking-tighter text-slate-50"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Engineers
        </span>
        <button
          onClick={() => mutate()}
          className="bg-[#bd9dff] text-black px-4 py-2 font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Simulate Slack Event
        </button>
      </header>

      <main className="flex-1 p-8 space-y-16">

        {/* ── Expertise Leaderboard ── */}
        <section>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2
                className="text-4xl font-black tracking-tighter uppercase text-white leading-none"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Expertise Leaderboard
              </h2>
              <p className="text-sm text-[#6d758c] mt-2">
                Top contributors by service domain this period
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="p-2 border-2 border-black bg-[#141f38] hover:bg-[#192540] transition-colors"
                style={{ boxShadow: '2px 2px 0px 0px #000' }}
              >
                <Filter className="h-4 w-4 text-[#a3aac4]" />
              </button>
              <button
                className="p-2 border-2 border-black bg-[#141f38] hover:bg-[#192540] transition-colors"
                style={{ boxShadow: '2px 2px 0px 0px #000' }}
              >
                <ArrowUpDown className="h-4 w-4 text-[#a3aac4]" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {EXPERTISE_CARDS.map((card) => (
              <ExpertiseCard key={card.name} card={card} />
            ))}
          </div>
        </section>

        {/* ── Adhoc Load Table ── */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <Monitor className="h-8 w-8 text-[#bd9dff]" />
            <h2
              className="text-3xl font-black uppercase text-white"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Adhoc Load This Sprint
            </h2>
          </div>

          <div
            className="bg-[#091328] border-4 border-black overflow-hidden"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <table className="w-full">
              <thead>
                <tr className="bg-[#192540] border-b-4 border-black">
                  {['Engineer', 'Adhoc Tickets', 'Story Points', 'Hours Absorbed'].map((col) => (
                    <th
                      key={col}
                      className="p-4 font-black uppercase text-xs tracking-widest text-[#bd9dff] italic text-left"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10">
                {engineers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-[#6d758c]">
                      No engineer data
                    </td>
                  </tr>
                ) : (
                  engineers.map((eng, i) => (
                    <tr
                      key={eng.engineer_slack_id ?? eng.engineer_name}
                      className={`hover:bg-[#bd9dff]/5 transition-colors ${
                        eng.adhoc_tickets === 0 ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Engineer */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 border-2 border-black flex items-center justify-center font-black text-xs shrink-0 ${
                              AVATAR_BG[Math.min(i, AVATAR_BG.length - 1)]
                            } ${AVATAR_TEXT[Math.min(i, AVATAR_TEXT.length - 1)]}`}
                            style={{ fontFamily: 'var(--font-space-grotesk)' }}
                          >
                            {getInitials(eng.engineer_name)}
                          </div>
                          <span className="font-bold text-[#dee5ff]">{eng.engineer_name}</span>
                        </div>
                      </td>

                      {/* Tickets badge */}
                      <td className="p-4">
                        <span
                          className="px-2 py-1 bg-[#060e20] border border-black text-xs font-black text-[#dee5ff]"
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {eng.adhoc_tickets}
                        </span>
                      </td>

                      {/* Story points with inline mini bar */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-2 bg-[#0f1930] border border-black overflow-hidden">
                            <div
                              className="h-full bg-[#bd9dff] transition-all"
                              style={{
                                width: `${(eng.adhoc_points / maxPoints) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-[#a3aac4]">{eng.adhoc_points}pts</span>
                        </div>
                      </td>

                      {/* Hours absorbed */}
                      <td className="p-4 text-right">
                        <span
                          className={`font-black text-sm ${
                            HOURS_COLOR[Math.min(i, HOURS_COLOR.length - 1)]
                          }`}
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {(eng.adhoc_points * 2).toFixed(1)}h
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Four stat footer cards ── */}
          <div className="grid grid-cols-4 gap-4 mt-8">
            <div
              className="bg-[#192540] border-2 border-black p-5"
              style={{ boxShadow: '2px 2px 0px 0px #000' }}
            >
              <p
                className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Total Sprint Adhoc
              </p>
              <p
                className="text-3xl font-black text-[#bd9dff]"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {totalTickets}
              </p>
            </div>

            <div
              className="bg-[#192540] border-2 border-black p-5"
              style={{ boxShadow: '2px 2px 0px 0px #000' }}
            >
              <p
                className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Velocity Impact
              </p>
              <p
                className="text-3xl font-black text-[#ff6e84]"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                -12%
              </p>
            </div>

            <div
              className="bg-[#192540] border-2 border-black p-5"
              style={{ boxShadow: '2px 2px 0px 0px #000' }}
            >
              <p
                className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Avg Response Time
              </p>
              <p
                className="text-3xl font-black text-[#dee5ff]"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                2.4h
              </p>
            </div>

            <div
              className="bg-[#b28cff] border-2 border-black p-5"
              style={{ boxShadow: '2px 2px 0px 0px #000' }}
            >
              <p
                className="text-[10px] font-black text-[#2e006c] uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Next Cycle Goal
              </p>
              <p
                className="text-3xl font-black text-[#2e006c]"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                REDUCE
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
