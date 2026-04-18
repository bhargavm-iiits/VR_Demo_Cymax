import { create } from 'zustand'

const useStore = create((set, get) => ({
  // ── Auth ─────────────────────────────────────────────────
  user:  JSON.parse(localStorage.getItem('vr_user') || 'null'),
  token: localStorage.getItem('vr_token') || null,

  setUser:  (user)  => {
    localStorage.setItem('vr_user', JSON.stringify(user))
    set({ user })
  },
  setToken: (token) => {
    localStorage.setItem('vr_token', token)
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('vr_token')
    localStorage.removeItem('vr_user')
    localStorage.removeItem('vr_sub_tier')
    localStorage.removeItem('vr_profiles')
    localStorage.removeItem('vr_active_profile')
    set({ user: null, token: null, session: null, profiles: [], activeProfile: null, subscriptionTier: 'free' })
  },

  // ── Profiles ──────────────────────────────────────────────
  profiles: JSON.parse(localStorage.getItem('vr_profiles') || '[]'),
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
  subscriptionTier: localStorage.getItem('vr_sub_tier') || 'free', // free | basic | premium
  setSubscriptionTier: (tier) => {
    localStorage.setItem('vr_sub_tier', tier)
    set({ subscriptionTier: tier })
  },

  // ── Movies ────────────────────────────────────────────────
  movies:        [],
  selectedMovie: null,
  setMovies:        (movies)        => set({ movies }),
  setSelectedMovie: (selectedMovie) => set({ selectedMovie }),

  // ── Session / Pairing ────────────────────────────────────
  session:       null,
  pairingCode:   null,
  pairingStatus: 'idle',   // idle | waiting | paired | error
  connectedDevice: null,

  setSession:        (session)        => set({ session }),
  setPairingCode:    (pairingCode)    => set({ pairingCode }),
  setPairingStatus:  (pairingStatus)  => set({ pairingStatus }),
  setConnectedDevice:(connectedDevice)=> set({ connectedDevice }),

  // ── Playback ─────────────────────────────────────────────
  playbackState:   'idle',  // idle | playing | paused | stopped
  currentPosition: 0,
  volume:          80,
  streamToken:     null,

  setPlaybackState:   (playbackState)   => set({ playbackState }),
  setCurrentPosition: (currentPosition) => set({ currentPosition }),
  setVolume:          (volume)          => set({ volume }),
  setStreamToken:     (streamToken)     => set({ streamToken }),

  // ── WebSocket ────────────────────────────────────────────
  socket:       null,
  wsConnected:  false,
  setSocket:      (socket)      => set({ socket }),
  setWsConnected: (wsConnected) => set({ wsConnected }),

  // ── UI ───────────────────────────────────────────────────
  notification: null,
  setNotification: (notification) => set({ notification }),
  clearNotification: () => set({ notification: null }),
}))

export default useStore
