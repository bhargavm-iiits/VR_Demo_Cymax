import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, useState } from 'react'
import useStore, { getUserRole } from './store/useStore'
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
import VRPlayer from './pages/VRPlayer'
import SystemMonitor from './pages/SystemMonitor'

// ─────────────────────────────────────────────────────────────
//  PrivateRoute — any authenticated user (including limited)
// ─────────────────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const token = useStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <MainLayout>{children}</MainLayout>
}

// ─────────────────────────────────────────────────────────────
//  PlayerRoute — full or premium users only
// ─────────────────────────────────────────────────────────────
function PlayerRoute({ children }) {
  const token = useStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />

  const role = getUserRole()
  // Block 'limited' users from playing anything
  if (role === 'limited') return <Navigate to="/home" replace />

  return <MainLayout>{children}</MainLayout>
}

// ─────────────────────────────────────────────────────────────
//  ProtectedRoute — strict admin access (full role only)
// ─────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const token = useStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />

  const role = getUserRole()
  if (role !== 'full') return <Navigate to="/home" replace />

  return <MainLayout>{children}</MainLayout>
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
        {/* Public */}
        <Route path="/login"        element={<Login />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/payment"      element={<Payment />} />

        {/* Standard private routes (any authenticated user) */}
        <Route path="/home"       element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/movies"     element={<PrivateRoute><Movies /></PrivateRoute>} />
        <Route path="/pairing"    element={<PrivateRoute><Pairing /></PrivateRoute>} />
        <Route path="/services"   element={<PrivateRoute><Services /></PrivateRoute>} />
        <Route path="/headset"    element={<PrivateRoute><HeadsetControl /></PrivateRoute>} />
        <Route path="/about"      element={<PrivateRoute><About /></PrivateRoute>} />
        <Route path="/monitor"    element={<PrivateRoute><SystemMonitor /></PrivateRoute>} />

        {/* Restricted to Full/Premium */}
        <Route path="/player"     element={<PlayerRoute><Player /></PlayerRoute>} />
        <Route path="/vr-player"  element={<PlayerRoute><VRPlayer /></PlayerRoute>} />

        {/* Protected route (Full role only) */}
        <Route path="/media" element={<ProtectedRoute><Media /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="/"  element={<Navigate to={token ? '/home' : '/login'} replace />} />
        <Route path="*"  element={<Navigate to={token ? '/home' : '/login'} replace />} />
      </Routes>
    </Suspense>
  )
}