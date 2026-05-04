import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from './ui/components/Header'
import { BottomBar } from './ui/components/BottomBar'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="w-full h-full flex flex-col">
        <div style={{ height: '12%' }}>
          <Header />
        </div>
        <div className="flex-1" />
        <div style={{ height: '20%' }}>
          <BottomBar />
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App
