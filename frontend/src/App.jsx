import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, useState } from 'react'
import useStore from './store/useStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Movies from './pages/Movies'
import Player from './pages/Player'
import Pairing from './pages/Pairing'
import Subscription from './pages/Subscription'
import Payment from './pages/Payment'
import Splash from './components/Splash'
import MainLayout from './components/MainLayout'
import About from './pages/About'
import Services from './pages/Services'
import HeadsetControl from './pages/HeadsetControl'
import Media from './pages/Media'
import SecurityPage from './pages/SecurityPage'
import VRPlayer from './pages/VRPlayer'
import SystemMonitor from './pages/SystemMonitor'


function PrivateRoute({ children }) {
  const token = useStore(s => s.token)
  return token ? <MainLayout>{children}</MainLayout> : <Navigate to="/login" replace />
}

function Loading() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#7B61FF]/30 border-t-[#7B61FF]
                        rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#A0A0A0] text-sm">Loading VR Cinema...</p>
      </div>
    </div>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const token = useStore(s => s.token)

  if (showSplash) {
    return <Splash onComplete={() => setShowSplash(false)} />
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/movies" element={<PrivateRoute><Movies /></PrivateRoute>} />
        <Route path="/player" element={<PrivateRoute><Player /></PrivateRoute>} />
        <Route path="/pairing" element={<PrivateRoute><Pairing /></PrivateRoute>} />
        
        {/* Fully functional CYMAX pages */}
        <Route path="/services" element={<PrivateRoute><Services /></PrivateRoute>} />
        <Route path="/media" element={<PrivateRoute><Media /></PrivateRoute>} />
        <Route path="/headset" element={<PrivateRoute><HeadsetControl /></PrivateRoute>} />
        <Route path="/about" element={<PrivateRoute><About /></PrivateRoute>} />

        <Route path="/vr-player" element={<PrivateRoute><VRPlayer /></PrivateRoute>} />
        <Route path="/monitor" element={<PrivateRoute><SystemMonitor /></PrivateRoute>} />

        
        <Route path="/" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </Suspense>
  )
}