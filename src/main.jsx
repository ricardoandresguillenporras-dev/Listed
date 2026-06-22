import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerBackButtonHandler } from './capacitorBack'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register Capacitor Android back-button handler (no-op on web)
registerBackButtonHandler();
