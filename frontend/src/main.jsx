import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import Maintenance from "./Maintenance";

const MAINTENANCE = import.meta.env.VITE_MAINTENANCE === "true";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {MAINTENANCE ? <Maintenance /> : <App />}
  </StrictMode>,
)
