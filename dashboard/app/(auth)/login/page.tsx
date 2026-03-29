import { LoginForm } from "../components/LoginForm"
import { LoginLeftPanel } from "../components/LoginLeftPanel"

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full">
      {/* Left panel - branding/testimonials */}
      <div className="hidden lg:block lg:w-1/2 border-r border-white/[0.08]">
        <LoginLeftPanel />
      </div>

      {/* Vertical divider line */}
      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />

      {/* Right panel - login form */}
      <div
        className="flex-1 flex items-center justify-center p-8 lg:p-12"
        style={{ background: "var(--panel-right)" }}
      >
        <LoginForm />
      </div>
    </div>
  )
}
