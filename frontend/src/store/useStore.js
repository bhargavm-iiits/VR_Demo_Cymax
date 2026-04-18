import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────
//  Hardcoded user roles (client-side auth, no backend needed)
//  "full"    → Bhargav_Cymax — all routes including /media
//  "limited" → premiumdemo   — all routes EXCEPT /media
// ─────────────────────────────────────────────────────────────
export const HARDCODED_USERS = {
  Bhargav_Cymax: { password: 'Bhar@1234$.', role: 'full' },
  premiumdemo:   { password: 'cymax@premium', role: 'limited' },
}

// Read role synchronously — used in ProtectedRoute to prevent flicker
export function getUserRole() {
  return localStorage.getItem('userRole') || null
}

const useStore = create((set) => ({
  // ── Auth ─────────────────────────────────────────────────
  user:     JSON.parse(localStorage.getItem('vr_user') || 'null'),
  token:    localStorage.getItem('vr_token') || null,
  userRole: localStorage.getItem('userRole') || null,  // "full" | "limited" | null

  setUser: (user) => {
    localStorage.setItem('vr_user', JSON.stringify(user))
    set({ user })
  },
  setToken: (token) => {
    localStorage.setItem('vr_token', token)
    set({ token })
  },
  setUserRole: (role) => {
    if (role) localStorage.setItem('userRole', role)
    else      localStorage.removeItem('userRole')
    set({ userRole: role })
  },

  logout: () => {
    localStorage.removeItem('vr_token')
    localStorage.removeItem('vr_user')
    localStorage.removeItem('vr_sub_tier')
    localStorage.removeItem('vr_profiles')
    localStorage.removeItem('vr_active_profile')
    localStorage.removeItem('userRole')
    // Legacy keys
    localStorage.removeItem('vr_media_admin')
    set({
      user: null, token: null, userRole: null,
      session: null, profiles: [], activeProfile: null,
      subscriptionTier: 'free', isMediaAdmin: false,
    })
  },

  // ── Profiles ──────────────────────────────────────────────
  profiles:      JSON.parse(localStorage.getItem('vr_profiles') || '[]'),
  activeProfile: JSON.parse(localStorage.getItem('vr_active_profile') || 'null'),
  setProfiles: (profiles) => {
    localStorage.setItem('vr_profiles', JSON.stringify(profiles))
    set({ profiles })
  },
  setActiveProfile: (profile) => {
    localStorage.setItem('vr_active_profile', JSON.stringify(profile))
    set({ activeProfile: profile })
  },

  // ── Subscription ──────────────────────────────────────────
  subscriptionTier: localStorage.getItem('vr_sub_tier') || 'free',
  setSubscriptionTier: (tier) => {
    localStorage.setItem('vr_sub_tier', tier)
    set({ subscriptionTier: tier })
  },

  // ── Movies ────────────────────────────────────────────────
  movies:           [],
  selectedMovie:    null,
  setMovies:        (movies)        => set({ movies }),
  setSelectedMovie: (selectedMovie) => set({ selectedMovie }),

  // ── Session / Pairing ────────────────────────────────────
  session:         null,
  pairingCode:     null,
  pairingStatus:   'idle',
  connectedDevice: null,
  setSession:         (session)         => set({ session }),
  setPairingCode:     (pairingCode)     => set({ pairingCode }),
  setPairingStatus:   (pairingStatus)   => set({ pairingStatus }),
  setConnectedDevice: (connectedDevice) => set({ connectedDevice }),

  // ── Playback ─────────────────────────────────────────────
  playbackState:      'idle',
  currentPosition:    0,
  volume:             80,
  streamToken:        null,
  setPlaybackState:   (playbackState)   => set({ playbackState }),
  setCurrentPosition: (currentPosition) => set({ currentPosition }),
  setVolume:          (volume)          => set({ volume }),
  setStreamToken:     (streamToken)     => set({ streamToken }),

  // ── WebSocket ────────────────────────────────────────────
  socket:         null,
  wsConnected:    false,
  setSocket:      (socket)      => set({ socket }),
  setWsConnected: (wsConnected) => set({ wsConnected }),

  // ── UI ───────────────────────────────────────────────────
  notification:       null,
  setNotification:    (notification) => set({ notification }),
  clearNotification:  ()             => set({ notification: null }),
}))

export default useStore
