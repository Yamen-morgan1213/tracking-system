import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Admin from './pages/Admin'
import Player from './pages/Player'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen text-gray-100 antialiased font-sans">
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/player" element={<Player />} />
          <Route path="*" element={<Navigate to="/player" replace />} />
        </Routes>
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(17, 24, 39, 0.85)',
              color: '#fff',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '15px',
              padding: '12px 20px',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            },
          }}
        />
      </div>
    </BrowserRouter>
  )
}

export default App
