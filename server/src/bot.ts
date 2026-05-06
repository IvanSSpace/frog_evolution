import TelegramBot from 'node-telegram-bot-api'
import { config } from './config'

let bot: TelegramBot | null = null

export function initBot(clientUrl: string): TelegramBot | null {
  if (!config.telegramBotToken) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set, bot disabled')
    return null
  }

  bot = new TelegramBot(config.telegramBotToken)

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id

    bot!.sendMessage(chatId, '🐸 Добро пожаловать в Frog Evolution!', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎮 Играть',
              web_app: { url: clientUrl },
            },
          ],
        ],
      },
    })
  })

  console.log('✅ Telegram bot initialized')
  return bot
}

export function getBot(): TelegramBot | null {
  return bot
}

// Обработка webhook от Telegram
export async function processWebhook(body: any): Promise<void> {
  if (!bot) return

  try {
    bot.processUpdate(body)
  } catch (error) {
    console.error('Webhook processing error:', error)
  }
}
