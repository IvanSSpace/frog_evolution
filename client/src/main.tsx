import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startGame } from './game/index'
import './index.css'

// Phaser монтируем один раз вне React — иначе пересоздаётся при ре-рендере
startGame()

ReactDOM.createRoot(document.getElementById('ui-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
