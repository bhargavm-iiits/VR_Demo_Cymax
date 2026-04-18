import axios from 'axios'

const DEMO_PREMIUM_TOKEN = 'demo-premium-access-token'
const DEMO_PAIRING_KEY = 'cymax_demo_pairing'
const DEMO_PREMIUM_USER = {
    id: 'demo-premium-user',
    username: 'demo_premium',
    email: 'premium@cymax.demo',
    subscription_tier: 'premium',
    role: 'premium_demo',
}

const isDemoToken = (token) => token === DEMO_PREMIUM_TOKEN
const isJwtLikeToken = (token) => typeof token === 'string' && token.split('.').length === 3
const getStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem('vr_user') || 'null')
    } catch {
        return null
    }
}
const shouldBypassBackendAuth = (token) => !!token && !isJwtLikeToken(token)
const generateDemoPairingCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
const getDemoPairing = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(DEMO_PAIRING_KEY) || 'null')
        if (!stored) return null
        if (stored.expires_at && Date.now() > stored.expires_at) {
            localStorage.removeItem(DEMO_PAIRING_KEY)
            return null
        }
        return stored
    } catch {
        return null
    }
}
const setDemoPairing = (pairing) => localStorage.setItem(DEMO_PAIRING_KEY, JSON.stringify(pairing))

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('vr_token')
    if (token && !shouldBypassBackendAuth(token)) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (res) => res,
    (err) => {
        const token = localStorage.getItem('vr_token')
        if (err.response?.status === 401 && !shouldBypassBackendAuth(token)) {
            localStorage.removeItem('vr_token')
            localStorage.removeItem('vr_user')
            localStorage.removeItem('vr_sub_tier')
            window.location.href = '/login'
        }
        return Promise.reject(err)
    }
)

export default api

export { DEMO_PREMIUM_TOKEN, DEMO_PREMIUM_USER, isDemoToken, isJwtLikeToken }

// ── Auth ─────────────────────────────────────────────────────
export const authAPI = {
    login: (data) => api.post('/auth/login', data),
    register: (data) => api.post('/auth/register', data),
    me: () => {
        const token = localStorage.getItem('vr_token')
        if (shouldBypassBackendAuth(token)) {
            return Promise.resolve({ data: { user: getStoredUser() || DEMO_PREMIUM_USER } })
        }
        return api.get('/auth/me')
    },
    logout: () => {
        const token = localStorage.getItem('vr_token')
        if (shouldBypassBackendAuth(token)) {
            return Promise.resolve({ data: { success: true } })
        }
        return api.post('/auth/logout')
    },
}

// ── Movies ───────────────────────────────────────────────────
export const moviesAPI = {
    list: (params) => api.get('/movies/', { params }),
    detail: (id) => api.get(`/movies/${id}`),
}

// ── Streaming ────────────────────────────────────────────────
export const streamAPI = {
    getToken: (movieId) => {
        const token = localStorage.getItem('vr_token')
        if (shouldBypassBackendAuth(token)) {
            return Promise.resolve({ data: { stream_token: `demo-stream-${movieId}` } })
        }
        return api.post(`/stream/${movieId}/token`)
    },
    getStatus: () => {
        const token = localStorage.getItem('vr_token')
        if (shouldBypassBackendAuth(token)) {
            const pairing = getDemoPairing()
            return Promise.resolve({
                data: pairing ? {
                    has_active_session: true,
                    pairing_status: pairing.device_id ? 'paired' : 'waiting',
                    paired: !!pairing.device_id,
                    device_id: pairing.device_id || null,
                    pairing_code: pairing.pairing_code,
                    device: {
                        vr_paired: !!pairing.device_id,
                        vr_device_id: pairing.device_id || null,
                        pairing_code: pairing.pairing_code,
                    },
                } : {
                    has_active_session: false,
                    pairing_status: 'idle',
                    paired: false,
                    device_id: null,
                    pairing_code: null,
                },
            })
        }
        return api.get('/stream/session/status')
    },
    getPairingCode: () => {
        const token = localStorage.getItem('vr_token')
        if (shouldBypassBackendAuth(token)) {
            const pairing = {
                pairing_code: generateDemoPairingCode(),
                device_id: null,
                expires_at: Date.now() + (10 * 60 * 1000),
            }
            setDemoPairing(pairing)
            return Promise.resolve({ data: { pairing_code: pairing.pairing_code, expires_in: 600 } })
        }
        return api.post('/stream/session/pair')
    },
    sendCommand: (cmd) => {
        const token = localStorage.getItem('vr_token')
        if (shouldBypassBackendAuth(token)) {
            return Promise.resolve({ data: { status: 'ok', command: cmd.command, session_state: cmd.command } })
        }
        return api.post('/stream/session/command', cmd)
    },
    getSystemOverview: () => {
        const token = localStorage.getItem('vr_token')
        if (shouldBypassBackendAuth(token)) {
            const pairing = getDemoPairing()
            return Promise.resolve({
                data: {
                    active_users: 1,
                    connected_headsets: pairing?.device_id ? 1 : 0,
                    active_sessions: pairing ? 1 : 0,
                    active_pairings: pairing && !pairing.device_id ? 1 : 0,
                    current_session: pairing ? {
                        has_active_session: true,
                        pairing_status: pairing.device_id ? 'paired' : 'waiting',
                        paired: !!pairing.device_id,
                        device_id: pairing.device_id || null,
                        pairing_code: pairing.pairing_code,
                    } : {
                        has_active_session: false,
                        pairing_status: 'idle',
                        paired: false,
                        device_id: null,
                        pairing_code: null,
                    },
                },
            })
        }
        return api.get('/stream/system/overview')
    },
}
