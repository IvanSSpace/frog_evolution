import { buildApp, checkDatabase } from './app'
import { initBot } from './bot'
import { config } from './config'

async function start() {
  const dbOk = await checkDatabase()
  if (!dbOk) {
    console.error('❌ Cannot start without database')
    process.exit(1)
  }

  initBot(config.clientUrl)

  const app = await buildApp()

  try {
    const address = await app.listen({ port: config.port, host: '0.0.0.0' })
    console.log(`🚀 Server running on ${address}`)
    console.log(`📋 Health: ${address}/health`)
  } catch (error) {
    console.error('❌ Failed to start:', error)
    process.exit(1)
  }
}

start()
