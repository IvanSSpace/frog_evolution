import { Link, useNavigate, useLocation } from 'react-router-dom'
import { clearToken } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Users', href: '/users' },
  { label: 'Race Chains', href: '/chains' },
  { label: 'Экспедиция', href: '/expedition' },
]

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
        <span className="font-bold text-foreground">Frog Evolution Admin</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 border-r border-border py-4 shrink-0">
          <nav className="flex flex-col gap-1 px-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  pathname === item.href
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
