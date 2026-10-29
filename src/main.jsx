import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// only the character sets we use (keeps the APK small)
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/noto-nastaliq-urdu/arabic-400.css'
import '@fontsource/noto-nastaliq-urdu/arabic-700.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
