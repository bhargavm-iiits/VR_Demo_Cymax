import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, User, Mail, AlertCircle, ArrowRight, Headphones, X, RefreshCw } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI, DEMO_PREMIUM_TOKEN, DEMO_PREMIUM_USER } from '../api/axios'
import useStore, { HARDCODED_USERS } from '../store/useStore'

// ─── Google Client ID ─────────────────────────────────────────────
// Replace these with your real provider credentials from each console.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1075556940848-hlkee74cpk7c9j471a4uvp5rat9jifbh.apps.googleusercontent.com'
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID || ''
const APPLE_REDIRECT_URI = import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin
// Media Admin Gate — credentials kept private, no UI hint shown
const MEDIA_ADMIN_CREDENTIALS = {
    username: 'Bhargav_Cymax',
    password: 'Bhar@1234$.',
}

// ── Google SVG icon ─────────────────────────────────────────────
function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.259c-.806.54-1.837.859-3.047.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963L3.964 7.295C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
    )
}

// ── Apple SVG icon ───────────────────────────────────────────────
function AppleIcon() {
    return (
        <svg width="16" height="18" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46.3 783.7 0 695 0 614.2c0-141.9 93-216.6 184.3-216.6 65 0 119.3 42.8 160.1 42.8 38.8 0 99.7-45.5 168.2-45.5 27.2-.2 144.5 2.9 210.4 105zM549.2 99.5c27.5-35.2 47.7-84.5 47.7-133.8 0-6.4-.5-12.9-1.6-18.4-45.5 1.6-99.5 31.3-131.5 71.5-24.9 29.8-49.5 79.1-49.5 129.1 0 7 1.1 14.1 1.6 16.3 2.7.5 7 1.1 11.3 1.1 40.8 0 89.8-28 121.9-65.7z"/>
        </svg>
    )
}

// ── Google One Tap ───────────────────────────────────────────────
function loadExternalScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve()

    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`)
        if (existing) {
            if (!globalName || window[globalName]) {
                resolve()
                return
            }
            existing.addEventListener('load', () => resolve(), { once: true })
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true })
            return
        }

        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.defer = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(script)
    })
}

function decodeJwtPayload(token) {
    const payload = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (!payload) throw new Error('Invalid token payload')
    return JSON.parse(atob(payload))
}

// ── Social Login Modal (Apple stays manual; Google uses One Tap) ───
function SocialLoginModal({ provider, onClose }) {
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const { setToken, setUser } = useStore()
    const requestInFlight = useRef(false)

    const handleGoogleCredential = async (response) => {
        // response.credential is the JWT ID token
        setLoading(true)
        try {
            // Decode the JWT to get user info (base64 middle section)
            const payload = JSON.parse(atob(response.credential.split('.')[1]))
            const { name, email, sub, picture } = payload

            // Save to store — in production send credential to backend for verification
            setUser({ username: name, email, picture, providerId: sub, provider: 'google' })
            setToken(`google_${sub}`) // Replace with real backend token exchange
            setDone(true)
            setTimeout(() => navigate('/dashboard'), 900)
        } catch (e) {
            console.error('Google credential decode failed', e)
        } finally {
            setLoading(false)
        }
    }

    const handleAppleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        await new Promise(r => setTimeout(r, 1500))
        setLoading(false)
        setDone(true)
        setTimeout(() => navigate('/dashboard'), 1000)
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-sm mx-6 bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#7B61FF]/20 blur-3xl rounded-full pointer-events-none" />
                <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors">
                    <X size={16} />
                </button>

                <div className="flex flex-col items-center mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${provider === 'Google' ? 'bg-white' : 'bg-black border border-white/20'}`}>
                        {provider === 'Google' ? <GoogleIcon /> : <AppleIcon />}
                    </div>
                    <h3 className="text-white font-black text-xl">Continue with {provider}</h3>
                    <p className="text-white/40 text-sm mt-1 text-center">
                        Sign in securely using your {provider} account
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {done ? (
                        <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="text-center py-4">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <p className="text-white font-bold">Authenticated!</p>
                            <p className="text-white/40 text-sm">Redirecting to dashboard…</p>
                        </motion.div>
                    ) : provider === 'Google' ? (
                        <motion.div key="google" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {/* Official Google button renders here */}
                            <div ref={googleButtonRef} className="flex justify-center w-full mb-3" />
                            <p className="text-white/20 text-[10px] text-center mt-2">
                                Your browser will show all your signed-in Google accounts.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.form key="apple" onSubmit={handleAppleLogin} className="space-y-3">
                            <div className="relative">
                                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                <input
                                    type="email"
                                    placeholder="Your Apple ID email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#7B61FF]/60 transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-black border border-white/20 text-white font-black text-sm flex items-center justify-center gap-2 transition-all hover:bg-white/5 disabled:opacity-50"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (<><AppleIcon /> Sign in with Apple</>)}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    )
}

// ── Reset Password Modal ─────────────────────────────────────────
function ResetPasswordModal({ onClose }) {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [err, setErr] = useState('')

    const handleReset = async (e) => {
        e.preventDefault()
        setErr('')
        if (!email.trim()) { setErr('Please enter your email address.'); return }
        setLoading(true)
        await new Promise(r => setTimeout(r, 1500)) // Simulated API call
        setLoading(false)
        setSent(true)
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-sm mx-6 bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-48 h-24 bg-red-500/10 blur-3xl rounded-full pointer-events-none" />
                <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors">
                    <X size={16} />
                </button>

                <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                        <RefreshCw size={20} className="text-red-400" />
                    </div>
                    <h3 className="text-white font-black text-xl">Reset Password</h3>
                    <p className="text-white/40 text-sm mt-1 text-center">
                        Enter your email and we'll send you a reset link
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {sent ? (
                        <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="text-center py-2">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                                <Mail size={16} className="text-green-400" />
                            </div>
                            <p className="text-white font-bold mb-1">Email Sent!</p>
                            <p className="text-white/40 text-sm">
                                Check <span className="text-[#00E6FF]">{email}</span> for a password reset link.
                            </p>
                            <button onClick={onClose}
                                className="mt-5 w-full py-3 rounded-xl border border-white/10 text-white/60 text-sm font-bold hover:bg-white/5 transition-all">
                                Back to Sign In
                            </button>
                        </motion.div>
                    ) : (
                        <motion.form key="form" onSubmit={handleReset} className="space-y-3">
                            <div className="relative">
                                <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                <input
                                    type="email"
                                    placeholder="Your email address"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500/50 transition-all"
                                />
                            </div>
                            {err && (
                                <p className="text-red-400 text-xs flex items-center gap-2">
                                    <AlertCircle size={12} /> {err}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
                            >
                                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Mail size={14} /> Send Reset Link</>}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    )
}

// ── Main Login Page ──────────────────────────────────────────────
export default function Login() {
    const [mode, setMode] = useState('login')
    const [form, setForm] = useState({ username: '', email: '', password: '' })
    const [showPwd, setShowPwd] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showReset, setShowReset] = useState(false)
    const [socialProvider, setSocialProvider] = useState(null) // 'Google' | 'Apple' | null

    const { setUser, setToken, setSubscriptionTier, setUserRole } = useStore()
    const navigate = useNavigate()

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // ── Hardcoded credential lookup ───────────────────
            const match = HARDCODED_USERS[form.username]
            if (match && match.password === form.password) {
                const role = match.role   // 'full' | 'limited'
                setToken(`local_${form.username}`)
                setUser({ username: form.username, role })
                setSubscriptionTier('premium')
                setUserRole(role)         // stored under localStorage key 'userRole'
                navigate('/dashboard', { replace: true })
                return
            }

            // ── Backend fallback (API users get 'limited' role) ─
            if (mode === 'login') {
                try {
                    const res = await authAPI.login({
                        username: form.username,
                        password: form.password,
                    })
                    setToken(res.data.access_token)
                    setUser(res.data.user)
                    setSubscriptionTier(res.data.user?.subscription_tier || 'free')
                    setUserRole('limited')   // API users never get media access
                    navigate('/dashboard', { replace: true })
                    return
                } catch {
                    setError('Invalid credentials. Please try again.')
                    return
                }
            }

            // ── Register mode ─────────────────────────────────
            const res = await authAPI.register({
                username: form.username,
                email:    form.email,
                password: form.password,
            })
            setToken(res.data.access_token)
            setUser(res.data.user)
            setSubscriptionTier(res.data.user?.subscription_tier || 'free')
            setUserRole('limited')
            navigate('/dashboard', { replace: true })

        } catch (err) {
            setError('Invalid credentials. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const isAuthError = error.toLowerCase().includes('invalid') ||
        error.toLowerCase().includes('incorrect') ||
        error.toLowerCase().includes('wrong') ||
        error.toLowerCase().includes('not found') ||
        error.toLowerCase().includes('failed') ||
        error.toLowerCase().includes('credentials')

    return (
        <>
            {/* ── Modals ────────────────────────────────────────── */}
            <AnimatePresence>
                {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} />}
                {socialProvider && <OAuthAccountModal provider={socialProvider} onClose={() => setSocialProvider(null)} />}
            </AnimatePresence>

            <div className="min-h-screen bg-[#050505] flex overflow-hidden relative">

                {/* ── Ambient Blobs ───────────────────────────────── */}
                <div className="absolute w-[700px] h-[700px] rounded-full bg-[#7B61FF] opacity-[0.06] blur-[120px] -top-60 -left-60 pointer-events-none animate-[float_12s_ease-in-out_infinite]" />
                <div className="absolute w-[500px] h-[500px] rounded-full bg-[#00E6FF] opacity-[0.05] blur-[100px] bottom-0 right-0 pointer-events-none animate-[float_9s_ease-in-out_infinite_reverse]" />
                <div className="absolute w-[400px] h-[400px] rounded-full bg-[#ff3366] opacity-[0.04] blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

                {/* ── Left Branding Panel ─────────────────────────── */}
                <div className="hidden lg:flex flex-1 flex-col justify-between p-16 relative z-10 border-r border-white/5">
                    <div className="flex items-center gap-3">
                        <img src="/cymax_logo_icon.png" alt="CYMAX" className="w-12 h-12 rounded-xl object-cover" />
                        <div>
                            <p className="text-white font-black text-lg tracking-tight">CYMAX</p>
                            <p className="text-white/30 text-xs uppercase tracking-widest">VR Cinema</p>
                        </div>
                    </div>

                    <div>
                        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
                            className="text-6xl font-black leading-[1.05] mb-6 tracking-tight">
                            <span className="text-white">The Future of</span><br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00E6FF] via-[#7B61FF] to-[#ff3366]">Immersive Cinema</span>
                        </motion.h1>
                        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}
                            className="text-white/40 text-lg leading-relaxed max-w-sm">
                            Stream protected VR content directly to your headset with military-grade encryption and real-time wireless control.
                        </motion.p>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                            className="flex flex-wrap gap-3 mt-8">
                            {['AES-256 Encrypted', 'JWT Secured', 'HLS Streaming', 'VR Headset Pairing'].map(f => (
                                <span key={f} className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-white/10 text-white/50">{f}</span>
                            ))}
                        </motion.div>
                    </div>

                    <div className="flex items-center gap-4 text-white/20">
                        <Headphones size={20} />
                        <span className="text-sm uppercase tracking-widest">Compatible with Quest · Pico · Vision Pro</span>
                    </div>
                </div>

                {/* ── Right Form Panel ────────────────────────────── */}
                <div className="flex-1 flex items-center justify-center p-6 relative z-10">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                        className="w-full max-w-[420px]">

                        {/* Mobile logo */}
                        <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
                            <img src="/cymax_logo_icon.png" alt="CYMAX" className="w-10 h-10 rounded-xl object-cover" />
                            <span className="text-white font-black text-xl tracking-tight">CYMAX</span>
                        </div>

                        {/* Card */}
                        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-9 shadow-[0_0_80px_rgba(0,0,0,0.5)] relative overflow-hidden">
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-28 bg-[#7B61FF]/25 blur-3xl rounded-full pointer-events-none" />

                            {/* Mode tabs */}
                            <div className="flex bg-white/5 rounded-xl p-1 mb-8 gap-1">
                                {['login', 'register'].map(m => (
                                    <button key={m} onClick={() => { setMode(m); setError('') }}
                                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300
                                            ${mode === m
                                                ? 'bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-white shadow-[0_0_16px_rgba(123,97,255,0.4)]'
                                                : 'text-white/40 hover:text-white/70'}`}>
                                        {m === 'login' ? 'Sign In' : 'Register'}
                                    </button>
                                ))}
                            </div>

                            {/* Heading */}
                            <div className="mb-6">
                                <h2 className="text-2xl font-black text-white">
                                    {mode === 'login' ? 'Welcome back' : 'Create account'}
                                </h2>
                                <p className="text-white/40 text-sm mt-1">
                                    {mode === 'login' ? 'Sign in to access your VR cinema dashboard' : 'Join the next generation of VR streaming'}
                                </p>
                            </div>

                            {/* No public credential hint shown — media admin is private */}

                            {/* ── Social Login Buttons ── */}
                            <div className="flex gap-3 mb-5">
                                <button
                                    type="button"
                                    onClick={() => setSocialProvider('Google')}
                                    className="flex-1 flex items-center justify-center gap-2.5 py-3 bg-white rounded-xl text-[#333] text-sm font-bold hover:bg-gray-100 hover:scale-[1.02] transition-all shadow-sm"
                                >
                                    <GoogleIcon /> Google
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSocialProvider('Apple')}
                                    className="flex-1 flex items-center justify-center gap-2.5 py-3 bg-black border border-white/15 rounded-xl text-white text-sm font-bold hover:bg-white/5 hover:scale-[1.02] transition-all"
                                >
                                    <AppleIcon /> Apple
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-3 mb-5">
                                <div className="flex-1 h-px bg-white/8" />
                                <span className="text-white/25 text-xs font-bold uppercase tracking-widest">or</span>
                                <div className="flex-1 h-px bg-white/8" />
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-3">
                                {/* Username */}
                                <div className="relative">
                                    <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                    <input type="text" placeholder="Username" value={form.username}
                                        onChange={e => set('username', e.target.value)} required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#7B61FF]/60 focus:bg-white/8 transition-all" />
                                </div>

                                {/* Email (register only) */}
                                <AnimatePresence>
                                    {mode === 'register' && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                            <div className="relative pt-0.5">
                                                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                                <input type="email" placeholder="Email address" value={form.email}
                                                    onChange={e => set('email', e.target.value)} required={mode === 'register'}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#7B61FF]/60 transition-all" />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Password */}
                                <div className="relative">
                                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                    <input type={showPwd ? 'text' : 'password'} placeholder="Password" value={form.password}
                                        onChange={e => set('password', e.target.value)} required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-12 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#7B61FF]/60 transition-all" />
                                    <button type="button" onClick={() => setShowPwd(s => !s)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>

                                {/* Error message with Reset option */}
                                <AnimatePresence>
                                    {error && (
                                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                            className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                            <div className="flex items-start gap-2 text-red-400 text-xs">
                                                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                                <span>{error}</span>
                                            </div>
                                            {isAuthError && mode === 'login' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowReset(true)}
                                                    className="mt-2 ml-5 text-[11px] font-bold text-[#00E6FF] hover:underline flex items-center gap-1"
                                                >
                                                    <RefreshCw size={10} /> Reset your password via email
                                                </button>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Forgot password link (always visible in login mode) */}
                                {mode === 'login' && !error && (
                                    <div className="text-right">
                                        <button type="button" onClick={() => setShowReset(true)}
                                            className="text-[11px] text-white/30 hover:text-[#00E6FF] transition-colors font-medium">
                                            Forgot password?
                                        </button>
                                    </div>
                                )}

                                {/* Submit */}
                                <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
                                    className="w-full py-3.5 mt-1 bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-black font-black rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:shadow-[0_0_24px_rgba(123,97,255,0.4)]">
                                    {loading
                                        ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        : <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={15} /></>}
                                </motion.button>
                            </form>

                            {mode === 'register' && (
                                <p className="text-center text-white/30 text-xs mt-5">
                                    After registering, <Link to="/subscription" className="text-[#00E6FF] hover:underline">view subscription plans →</Link>
                                </p>
                            )}

                            <div className="flex items-center justify-center gap-1.5 mt-6 text-white/20 text-[11px]">
                                <Lock size={10} />
                                AES-256 encrypted · JWT secured · Argon2id hashed
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </>
    )
}

function OAuthAccountModal({ provider, onClose }) {
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const { setToken, setUser, setSubscriptionTier } = useStore()
    const requestInFlight = useRef(false)

    useEffect(() => {
        setError('')
    }, [provider])

    const finishLogin = (user, token) => {
        setUser(user)
        setToken(token)
        setSubscriptionTier(user?.subscription_tier || 'premium')
        setDone(true)
        setTimeout(() => navigate('/dashboard', { replace: true }), 900)
    }

    const handleGoogleLogin = async () => {
        if (requestInFlight.current) return
        if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID')) {
            setError('Add VITE_GOOGLE_CLIENT_ID to enable Google account selection.')
            return
        }

        requestInFlight.current = true
        setError('')
        setLoading(true)

        try {
            await loadExternalScript('https://accounts.google.com/gsi/client', 'google')
            const credentialResponse = await new Promise((resolve, reject) => {
                window.google?.accounts?.id?.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: (response) => {
                        if (response?.error) {
                            reject(new Error(response.error))
                            return
                        }
                        resolve(response)
                    },
                    auto_select: false,
                    cancel_on_tap_outside: true,
                    context: 'signin',
                })

                if (!window.google?.accounts?.id) {
                    reject(new Error('Google sign-in is unavailable right now.'))
                    return
                }

                window.google.accounts.id.prompt((notification) => {
                    const notDisplayed = notification?.isNotDisplayed?.()
                    const skipped = notification?.isSkippedMoment?.()
                    if (notDisplayed || skipped) {
                        reject(new Error('Google account chooser could not be displayed. Check your Google OAuth web app origin settings.'))
                    }
                })
            })
            const payload = decodeJwtPayload(credentialResponse.credential)
            finishLogin(
                {
                    username: payload.name || payload.email?.split('@')[0] || 'Google User',
                    email: payload.email || '',
                    picture: payload.picture,
                    providerId: payload.sub,
                    provider: 'google',
                },
                `google_${payload.sub || 'session'}`
            )
        } catch (e) {
            console.error('Google sign-in failed', e)
            setError(e.message || 'Google sign-in failed. Please try again.')
        } finally {
            requestInFlight.current = false
            setLoading(false)
        }
    }

    const handleAppleLogin = async () => {
        if (requestInFlight.current) return
        if (!APPLE_CLIENT_ID) {
            setError('Add VITE_APPLE_CLIENT_ID and VITE_APPLE_REDIRECT_URI to enable Apple account selection.')
            return
        }

        requestInFlight.current = true
        setError('')
        setLoading(true)

        try {
            await loadExternalScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js', 'AppleID')
            window.AppleID?.auth?.init({
                clientId: APPLE_CLIENT_ID,
                scope: 'name email',
                redirectURI: APPLE_REDIRECT_URI,
                state: `apple_${Date.now()}`,
                usePopup: true,
            })

            const response = await window.AppleID.auth.signIn()
            const idToken = response?.authorization?.id_token
            const payload = idToken ? decodeJwtPayload(idToken) : {}
            const rawUser = response?.user || {}
            const fullName = [rawUser?.name?.firstName, rawUser?.name?.lastName].filter(Boolean).join(' ')

            finishLogin(
                {
                    username: fullName || payload.email?.split('@')[0] || 'Apple User',
                    email: payload.email || '',
                    providerId: payload.sub,
                    provider: 'apple',
                },
                `apple_${payload.sub || 'session'}`
            )
        } catch (e) {
            console.error('Apple sign-in failed', e)
            setError(e.message || 'Apple sign-in failed. Please try again.')
        } finally {
            requestInFlight.current = false
            setLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-sm mx-6 bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#7B61FF]/20 blur-3xl rounded-full pointer-events-none" />
                <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors">
                    <X size={16} />
                </button>

                <div className="flex flex-col items-center mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${provider === 'Google' ? 'bg-white' : 'bg-black border border-white/20'}`}>
                        {provider === 'Google' ? <GoogleIcon /> : <AppleIcon />}
                    </div>
                    <h3 className="text-white font-black text-xl">Continue with {provider}</h3>
                    <p className="text-white/40 text-sm mt-1 text-center">
                        Sign in securely using your {provider} account
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {done ? (
                        <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-4">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                            </div>
                            <p className="text-white font-bold">Authenticated!</p>
                            <p className="text-white/40 text-sm">Redirecting to dashboard...</p>
                        </motion.div>
                    ) : (
                        <motion.div key={provider} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                            <button
                                type="button"
                                onClick={provider === 'Google' ? handleGoogleLogin : handleAppleLogin}
                                disabled={loading}
                                className={`w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${provider === 'Google' ? 'bg-white text-[#333] hover:bg-gray-100' : 'bg-black border border-white/20 text-white hover:bg-white/5'}`}
                            >
                                {loading ? (
                                    <div className={`w-4 h-4 border-2 rounded-full animate-spin ${provider === 'Google' ? 'border-black/20 border-t-black' : 'border-white/30 border-t-white'}`} />
                                ) : (
                                    <>{provider === 'Google' ? <GoogleIcon /> : <AppleIcon />} Continue with {provider}</>
                                )}
                            </button>
                            {error && (
                                <p className="text-red-400 text-xs flex items-start gap-2">
                                    <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
                                </p>
                            )}
                            <p className="text-white/20 text-[10px] text-center mt-2">
                                {provider === 'Google'
                                    ? 'Your browser will open the Google account chooser with your signed-in emails.'
                                    : 'Apple will open its account chooser in a popup when Apple OAuth is configured.'}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    )
}
