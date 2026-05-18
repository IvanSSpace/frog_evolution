import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppShell } from '@/components/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { Toaster } from '@/components/ui/toaster'

// Placeholder pages — Wave 3 will implement
function DashboardPage() {
  return (
    <div className="text-foreground">
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>
      <p className="text-muted-foreground">Analytics coming soon.</p>
    </div>
  )
}

function UsersPage() {
  return (
    <div className="text-foreground">
      <h1 className="text-xl font-bold">Users</h1>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Routes>
                    <Route index element={<DashboardPage />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route
                      path="users/:id"
                      element={<div className="text-foreground">User Detail — Wave 3</div>}
                    />
                  </Routes>
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}
