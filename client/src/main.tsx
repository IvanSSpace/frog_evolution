import './i18n/index'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTelegram } from './utils/telegram'
import './index.css'
// Phase 12 dev-only: window.__addDevCarrier / __listFrogIds (tree-shaken in prod).
import './utils/devCarriers'
// Phase 14 dev-only: window.__addSerum / __listSerums / __clearSerums.
import './utils/devSerums'
// Phase 15 dev-only: window.__addBox / __listBoxes / __clearBoxes.
import './utils/devBoxes'

// Telegram SDK инициализируем до Phaser — чтобы expand/ready отработали
// до первой отрисовки канваса
initTelegram()

ReactDOM.createRoot(document.getElementById('ui-root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
