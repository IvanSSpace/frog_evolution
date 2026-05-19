import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ELEMENTS = [
  'fire',
  'water',
  'earth',
  'air',
  'lightning',
  'ice',
  'shadow',
  'light',
  'nature',
  'metal',
  'poison',
  'psychic',
  'cosmic',
  'time',
  'void',
  'crystal',
] as const

type Element = (typeof ELEMENTS)[number]

type AdminUserDetail = {
  id: number
  telegramId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  currentLocation: number
  maxLevel: number
  gold: string
  essence: number
  lastSeen: string
  banned: boolean
  createdAt: string
  upgrades: Record<string, number>
  discoveredLevels: number[]
  magnetEnabled: boolean
  cosmic: unknown
  boxOpenCount: number
  incomePerSec: number
}

const grantGoldSchema = z.object({
  amount: z.coerce.number().int().positive('Must be a positive integer'),
})

const grantEssenceSchema = z.object({
  amount: z.coerce.number().int().positive('Must be a positive integer'),
})

const grantSerumSchema = z.object({
  element: z.enum(ELEMENTS, { errorMap: () => ({ message: 'Select an element' }) }),
  amount: z.coerce.number().int().positive('Must be a positive integer'),
})

type GrantGoldForm = z.infer<typeof grantGoldSchema>
type GrantEssenceForm = z.infer<typeof grantEssenceSchema>
type GrantSerumForm = z.infer<typeof grantSerumSchema>

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [cosmicExpanded, setCosmicExpanded] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: user, isLoading, isError } = useQuery<AdminUserDetail>({
    queryKey: ['user', id],
    queryFn: async () => {
      const res = await api.get<AdminUserDetail>(`/admin/users/${id}`)
      return res.data
    },
    enabled: !!id,
  })

  const grantMutation = useMutation({
    mutationFn: (body: {
      kind: 'gold' | 'essence' | 'serum'
      element?: Element
      amount: number
    }) => api.post(`/admin/users/${id}/grant`, body),
    onSuccess: (_data, vars) => {
      toast({ title: `Granted ${vars.kind} successfully` })
      void queryClient.invalidateQueries({ queryKey: ['user', id] })
    },
    onError: () => {
      toast({ title: 'Grant failed', variant: 'destructive' })
    },
  })

  const banMutation = useMutation({
    mutationFn: (banned: boolean) =>
      api.post(`/admin/users/${id}/ban`, { banned }),
    onSuccess: (_data, banned) => {
      toast({ title: banned ? 'User banned' : 'User unbanned' })
      void queryClient.invalidateQueries({ queryKey: ['user', id] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => {
      toast({ title: 'Ban action failed', variant: 'destructive' })
    },
  })

  const resetProgressMutation = useMutation({
    mutationFn: () => api.post(`/admin/users/${id}/reset-progress`, {}),
    onSuccess: () => {
      toast({ title: 'Progress reset successfully' })
      void queryClient.invalidateQueries({ queryKey: ['user', id] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => {
      toast({ title: 'Reset failed', variant: 'destructive' })
    },
  })

  const goldForm = useForm<GrantGoldForm>({ resolver: zodResolver(grantGoldSchema) })
  const essenceForm = useForm<GrantEssenceForm>({ resolver: zodResolver(grantEssenceSchema) })
  const serumForm = useForm<GrantSerumForm>({ resolver: zodResolver(grantSerumSchema) })

  if (isLoading) return <p className="text-muted-foreground">Loading user...</p>
  if (isError || !user) return <p className="text-destructive">User not found.</p>

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link to="/users" className="text-muted-foreground hover:text-foreground text-sm">
          &larr; Users
        </Link>
        <h1 className="text-xl font-bold text-foreground">
          {user.username ?? user.telegramId}
        </h1>
        {user.banned ? (
          <Badge variant="destructive">Banned</Badge>
        ) : (
          <Badge variant="secondary">Active</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column — GameState info */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Game State</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Telegram ID</dt>
                <dd className="text-foreground">{user.telegramId}</dd>

                <dt className="text-muted-foreground">Username</dt>
                <dd className="text-foreground">{user.username ?? '—'}</dd>

                <dt className="text-muted-foreground">Name</dt>
                <dd className="text-foreground">
                  {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
                </dd>

                <dt className="text-muted-foreground">Location</dt>
                <dd className="text-foreground">{user.currentLocation}</dd>

                <dt className="text-muted-foreground">Max Level</dt>
                <dd className="text-foreground">{user.maxLevel}</dd>

                <dt className="text-muted-foreground">Gold</dt>
                <dd className="text-foreground">{Number(user.gold).toLocaleString()}</dd>

                <dt className="text-muted-foreground">Essence</dt>
                <dd className="text-foreground">{user.essence}</dd>

                <dt className="text-muted-foreground">Boxes Opened</dt>
                <dd className="text-foreground">{user.boxOpenCount}</dd>

                <dt className="text-muted-foreground">Income/sec</dt>
                <dd className="text-foreground">{user.incomePerSec.toFixed(1)}</dd>

                <dt className="text-muted-foreground">Magnet</dt>
                <dd className="text-foreground">{user.magnetEnabled ? 'On' : 'Off'}</dd>

                <dt className="text-muted-foreground">Last Seen</dt>
                <dd className="text-foreground">{new Date(user.lastSeen).toLocaleString()}</dd>

                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </dd>
              </dl>
            </CardContent>
          </Card>

          {/* Cosmic blob — collapsible */}
          <Card>
            <CardHeader>
              <button
                type="button"
                className="text-left w-full flex items-center justify-between"
                onClick={() => setCosmicExpanded((v) => !v)}
              >
                <CardTitle className="text-base">Cosmic Blob</CardTitle>
                <span className="text-muted-foreground text-sm">
                  {cosmicExpanded ? '▲ collapse' : '▼ expand'}
                </span>
              </button>
            </CardHeader>
            {cosmicExpanded && (
              <CardContent>
                <pre className="text-xs text-muted-foreground bg-muted p-3 rounded overflow-auto max-h-64">
                  {JSON.stringify(user.cosmic, null, 2)}
                </pre>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right column — Actions */}
        <div className="flex flex-col gap-4">
          {/* Grant gold */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grant Gold</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={goldForm.handleSubmit((d) =>
                  grantMutation.mutate({ kind: 'gold', amount: d.amount }),
                )}
                className="flex gap-2"
              >
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Amount"
                    {...goldForm.register('amount')}
                  />
                  {goldForm.formState.errors.amount && (
                    <p className="text-xs text-destructive mt-1">
                      {goldForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>
                <Button type="submit" size="sm" disabled={grantMutation.isPending}>
                  Grant
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Grant essence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grant Essence</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={essenceForm.handleSubmit((d) =>
                  grantMutation.mutate({ kind: 'essence', amount: d.amount }),
                )}
                className="flex gap-2"
              >
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Amount"
                    {...essenceForm.register('amount')}
                  />
                  {essenceForm.formState.errors.amount && (
                    <p className="text-xs text-destructive mt-1">
                      {essenceForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>
                <Button type="submit" size="sm" disabled={grantMutation.isPending}>
                  Grant
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Grant serum */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grant Serum</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={serumForm.handleSubmit((d) =>
                  grantMutation.mutate({ kind: 'serum', element: d.element, amount: d.amount }),
                )}
                className="flex flex-col gap-2"
              >
                <div>
                  <Label htmlFor="serum-element">Element</Label>
                  <select
                    id="serum-element"
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...serumForm.register('element')}
                  >
                    <option value="">Select element...</option>
                    {ELEMENTS.map((el) => (
                      <option key={el} value={el}>
                        {el.charAt(0).toUpperCase() + el.slice(1)}
                      </option>
                    ))}
                  </select>
                  {serumForm.formState.errors.element && (
                    <p className="text-xs text-destructive mt-1">
                      {serumForm.formState.errors.element.message}
                    </p>
                  )}
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Amount"
                    {...serumForm.register('amount')}
                  />
                  {serumForm.formState.errors.amount && (
                    <p className="text-xs text-destructive mt-1">
                      {serumForm.formState.errors.amount.message}
                    </p>
                  )}
                </div>
                <Button type="submit" size="sm" disabled={grantMutation.isPending}>
                  Grant Serum
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Ban toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {user.banned
                    ? 'This user is currently banned.'
                    : 'This user is active.'}
                </p>
                <Button
                  type="button"
                  variant={user.banned ? 'outline' : 'destructive'}
                  size="sm"
                  disabled={banMutation.isPending}
                  onClick={() => banMutation.mutate(!user.banned)}
                >
                  {user.banned ? 'Unban' : 'Ban'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Reset progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reset Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Wipes all game progress: gold, upgrades, frogs, discovered
                  locations, serums, cosmic state, and pity counters. Preserves
                  the Telegram link, username, ban status, and account creation
                  date.
                </p>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                  >
                    Reset Progress
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <h2 className="text-lg font-bold text-foreground mb-2">
              Reset account progress?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              This will wipe all game progress for{' '}
              <strong>{user.username ?? user.telegramId}</strong>: gold,
              upgrades, frogs, discovered locations, cosmic state
              (serums/essence), and pity counters. Telegram link, username, ban
              status, and account history are preserved.
              <br />
              <br />
              <strong className="text-destructive">
                This action cannot be undone.
              </strong>
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={resetProgressMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={resetProgressMutation.isPending}
                onClick={() => {
                  resetProgressMutation.mutate(undefined, {
                    onSettled: () => setConfirmOpen(false),
                  })
                }}
              >
                {resetProgressMutation.isPending ? 'Resetting...' : 'Yes, reset'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
