import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, User, AlertCircle, Zap } from 'lucide-react'
import { authAPI } from '../api/axios'
import useStore from '../store/useStore'

export default function LoginForm() {
    const [mode, setMode] = useState('login')
    const [form, setForm] = useState({ username: '', email: '', password: '' })
    const [showPwd, setShowPwd] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const { setUser, setToken } = useStore()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const fn = mode === 'login' ? authAPI.login : authAPI.register
            const data = mode === 'login'
                ? { username: form.username, password: form.password }
                : { username: form.username, email: form.email, password: form.password }
            const res = await fn(data)
            setToken(res.data.access_token)
            setUser(res.data.user)
            navigate('/dashboard')
        } catch (err) {
            setError(err.response?.data?.detail || 'Authentication failed. Check credentials.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ width: '100%', maxWidth: '420px' }}
        >
            {/* ── Card ─────────────────────────────────────────── */}
            <div
                style={{
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: '24px',
                    padding: '40px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Gradient top glow */}
                <div style={{
                    position: 'absolute',
                    top: '-60px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '200px',
                    height: '120px',
                    background: 'radial-gradient(ellipse, rgba(123,97,255,0.3), transparent)',
                    pointerEvents: 'none',
                }} />

                {/* Logo */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
                    <div
                        className="btn-primary animate-glow"
                        style={{ width: '64px', height: '64px', borderRadius: '18px' }}
                    >
                        <Zap size={28} color="white" />
                    </div>
                </div>

                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <h1 style={{
                        fontSize: '26px',
                        fontWeight: '800',
                        color: '#ffffff',
                        marginBottom: '8px',
                        letterSpacing: '-0.5px',
                    }}>
                        {mode === 'login' ? 'Welcome back' : 'Create account'}
                    </h1>
                    <p style={{ color: '#707070', fontSize: '14px' }}>
                        {mode === 'login'
                            ? 'Sign in to your VR Cinema dashboard'
                            : 'Join the next generation of VR streaming'
                        }
                    </p>
                </div>

                {/* Mode Toggle */}
                <div style={{
                    display: 'flex',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '4px',
                    marginBottom: '24px',
                }}>
                    {['login', 'register'].map((m) => (
                        <button
                            key={m}
                            onClick={() => { setMode(m); setError('') }}
                            style={{
                                flex: '1',
                                padding: '9px',
                                borderRadius: '9px',
                                border: 'none',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: mode === m
                                    ? 'linear-gradient(90deg, #7B61FF, #00D1FF)'
                                    : 'transparent',
                                color: mode === m ? '#fff' : '#707070',
                                boxShadow: mode === m ? '0 0 20px rgba(123,97,255,0.3)' : 'none',
                            }}
                        >
                            {m === 'login' ? 'Sign In' : 'Register'}
                        </button>
                    ))}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>

                    {/* Username */}
                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <User
                            size={16}
                            color="#606060"
                            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                        />
                        <input
                            type="text"
                            placeholder="Username"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            className="vr-input"
                            required
                        />
                    </div>

                    {/* Email (register only) */}
                    <AnimatePresence>
                        {mode === 'register' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden', marginBottom: '12px' }}
                            >
                                <div style={{ position: 'relative' }}>
                                    <User
                                        size={16}
                                        color="#606060"
                                        style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="vr-input"
                                        required={mode === 'register'}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Password */}
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                        <Lock
                            size={16}
                            color="#606060"
                            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                        />
                        <input
                            type={showPwd ? 'text' : 'password'}
                            placeholder="Password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="vr-input"
                            style={{ paddingRight: '48px' }}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPwd(!showPwd)}
                            style={{
                                position: 'absolute',
                                right: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#606060',
                                padding: '4px',
                            }}
                        >
                            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    borderRadius: '10px',
                                    padding: '12px',
                                    marginBottom: '14px',
                                    color: '#fca5a5',
                                    fontSize: '13px',
                                }}
                            >
                                <AlertCircle size={15} />
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.button
                        type="submit"
                        disabled={loading}
                        whileTap={{ scale: 0.97 }}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: '700',
                            letterSpacing: '-0.2px',
                        }}
                    >
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                                    style={{
                                        display: 'block',
                                        width: '16px',
                                        height: '16px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTop: '2px solid white',
                                        borderRadius: '50%',
                                    }}
                                />
                                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                            </span>
                        ) : (
                            mode === 'login' ? 'Sign In →' : 'Create Account →'
                        )}
                    </motion.button>
                </form>

                {/* Footer note */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '20px',
                    color: '#505050',
                    fontSize: '12px',
                }}>
                    <Lock size={11} />
                    AES-256 encrypted · JWT secured · Argon2id hashed
                </div>
            </div>
        </motion.div>
    )
}