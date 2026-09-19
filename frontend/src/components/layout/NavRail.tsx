import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { FlaskConical, MessagesSquare, Database, Bot } from 'lucide-react'
import { getHealth } from '../../api/client'
import { cn } from '../../lib/cn'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '../../ui/tooltip'

const NAV_ITEMS = [
  { to: '/', label: 'Chat', icon: MessagesSquare, end: true },
  { to: '/stores', label: 'Knowledge Bases', icon: Database, end: false },
  { to: '/benchmarks', label: 'Benchmark Lab', icon: FlaskConical, end: false },
]

type HealthState = 'checking' | 'ok' | 'down'

export function NavRail() {
  const [health, setHealth] = useState<HealthState>('checking')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        await getHealth()
        if (!cancelled) setHealth('ok')
      } catch {
        if (!cancelled) setHealth('down')
      }
    }
    check()
    const id = setInterval(check, 15000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="flex h-full w-16 shrink-0 flex-col items-center border-r border-border bg-surface py-4">
        <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Bot className="h-5 w-5" />
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <TooltipRoot key={to}>
              <TooltipTrigger asChild>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors',
                      isActive ? 'bg-primary/15 text-primary' : 'hover:bg-border/50 hover:text-primary',
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </TooltipRoot>
          ))}
        </div>

        <TooltipRoot>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  health === 'ok' && 'bg-accent-emerald shadow-[0_0_8px] shadow-accent-emerald/60',
                  health === 'down' && 'bg-danger',
                  health === 'checking' && 'bg-accent-amber',
                )}
              />
              <span className="text-[9px] font-medium uppercase tracking-wide text-faint">API</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {health === 'ok' ? 'Django 5.2 · FastAPI online' : health === 'down' ? 'Backend unreachable' : 'Checking…'}
          </TooltipContent>
        </TooltipRoot>
      </nav>
    </TooltipProvider>
  )
}