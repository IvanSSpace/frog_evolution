import './i18n/index'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startGame } from './game/index'
import { initTelegram } from './utils/telegram'
import './index.css'

// Telegram SDK инициализируем до Phaser — чтобы expand/ready отработали
// до первой отрисовки канваса
initTelegram()

// Phaser монтируем один раз вне React — иначе пересоздаётся при ре-рендере
startGame()

ReactDOM.createRoot(document.getElementById('ui-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
