import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Headphones, ArrowLeft, RefreshCw, Copy, Check, Wifi, AlertTriangle, ShieldAlert, RotateCcw, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { streamAPI } from '../api/axios'
import useStore from '../store/useStore'
import DashboardStats from '../components/DashboardStats'
import BackButton from '../components/BackButton'

/* ── Pairing Rejected Banner (Req 6) ───────────────────────────── */
function PairingRejectedBanner({ deviceId, onRepair, onDismiss }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mb-6 rounded-[20px] border border-yellow-500/30 bg-yellow-500/10 px-6 py-5 flex items-start gap-4"
        >
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert size={20} className="text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-yellow-400 font-black text-sm uppercase tracking-wide mb-1">Headset Already Paired</p>
                <p className="text-white/55 text-xs leading-relaxed">
                    The headset <span className="text-white/80 font-mono">{deviceId ? deviceId.slice(0, 14) + '…' : 'requested'}</span> is
                    already connected to another controller session. Only one controller can pair with a headset at a time.
                </p>
                <div className="flex gap-3 mt-3">
                    <button
                        onClick={onRepair}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold hover:bg-yellow-500/30 transition-all"
                    >
                        <RotateCcw size={12} /> Force Re-Pair
                    </button>
                    <button
                        onClick={onDismiss}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-bold hover:bg-white/8 transition-all"
                    >
                        <XCircle size={12} /> Dismiss
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

/* ── Disconnect Countdown (Req 7) ──────────────────────────────── */
function DisconnectCountdown({ onReconnect, onAbandon }) {
    const [secs, setSecs] = useState(30)
    useEffect(() => {
        if (secs <= 0) { onAbandon(); return }
        const t = setTimeout(() => setSecs(s => s - 1), 1000)
        return () => clearTimeout(t)
    }, [secs])
    const pct = (secs / 30) * 100
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="mb-6 rounded-[20px] border border-red-500/25 bg-red-500/8 px-6 py-5"
        >
            <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 shrink-0">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="4" />
                        <circle
                            cx="24" cy="24" r="20" fill="none"
                            stroke="#ef4444" strokeWidth="4"
                            strokeDasharray={`${2 * Math.PI * 20}`}
                            strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 1s linear' }}
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-red-400 font-black text-sm">{secs}</span>
                </div>
                <div className="flex-1">
                    <p className="text-red-400 font-black text-sm uppercase tracking-wide mb-0.5">WebSocket Disconnected</p>
                    <p className="text-white/50 text-xs leading-relaxed">
                        Controller session lost. Reconnecting automatically in <span className="text-white/80 font-bold">{secs}s</span>. Session will terminate if not restored.
                    </p>
                </div>
            </div>
            <div className="flex gap-3 mt-4">
                <button
                    onClick={onReconnect}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-black text-xs font-black hover:opacity-90 transition-all"
                >
                    <Wifi size={12} /> Reconnect Now
                </button>
                <button
                    onClick={onAbandon}
                    className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs font-bold hover:bg-white/8 transition-all"
                >
                    End Session
                </button>
            </div>
        </motion.div>
    )
}

function AmbientDots() {
    const dots = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 6,
    }))

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {dots.map((dot) => (
                <motion.div
                    key={dot.id}
                    className="absolute rounded-full bg-[#00E6FF]"
                    style={{ left: `${dot.x}%`, top: `${dot.y}%`, width: dot.size, height: dot.size, opacity: 0 }}
                    animate={{ opacity: [0, 0.4, 0], y: [0, -30, -60], scale: [1, 1.5, 0] }}
                    transition={{ duration: dot.duration, delay: dot.delay, repeat: Infinity, ease: 'easeOut' }}
                />
            ))}
        </div>
    )
}

function CodeScreen({ code, onBack }) {
    const [copied, setCopied] = useState(false)
    const characters = code.split('')

    const copy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <motion.div
            key="code-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-[#050505] flex flex-col items-center justify-center text-white overflow-hidden"
        >
            <AmbientDots />
            <div className="absolute w-[600px] h-[600px] rounded-full bg-[#7B61FF] opacity-[0.08] blur-[120px] -top-40 left-1/2 -translate-x-1/2 pointer-events-none" />
            <div className="absolute w-[400px] h-[400px] rounded-full bg-[#00E6FF] opacity-[0.06] blur-[100px] bottom-0 left-1/2 -translate-x-1/2 pointer-events-none" />

            <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                onClick={onBack}
                className="absolute top-8 left-8 flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold"
            >
                <ArrowLeft size={16} /> Generate New Code
            </motion.button>

            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: 'spring' }}
                className="mb-8"
            >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#7B61FF]/30 to-[#00E6FF]/20 border border-[#7B61FF]/30 flex items-center justify-center shadow-[0_0_40px_rgba(123,97,255,0.3)]">
                    <Headphones size={36} className="text-[#00E6FF]" />
                </div>
            </motion.div>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-white/40 text-sm uppercase tracking-[0.3em] font-bold mb-3"
            >
                VR Pairing Code
            </motion.p>

            <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white font-black text-2xl mb-10 tracking-tight"
            >
                Enter this code in your headset
            </motion.h1>

            <div className="flex items-center gap-3 mb-10">
                {characters.map((character, index) => (
                    <motion.div
                        key={`${character}-${index}`}
                        initial={{ opacity: 0, y: 40, rotateX: -90 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{ delay: 0.4 + index * 0.08, type: 'spring', stiffness: 200 }}
                        className="w-16 h-20 md:w-20 md:h-24 flex items-center justify-center rounded-2xl text-4xl md:text-5xl font-black text-white bg-white/[0.06] border border-white/10 shadow-[0_0_20px_rgba(0,230,255,0.08)]"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                        {character}
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="flex flex-col items-center gap-4"
            >
                <button
                    onClick={copy}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm font-bold text-white/70 hover:text-white"
                >
                    {copied ? <><Check size={14} className="text-green-400" /> Copied!</> : <><Copy size={14} /> Copy Code</>}
                </button>

                <p className="text-white/25 text-xs">
                    Expires in <span className="text-white/50 font-bold">10 minutes</span>
                </p>
            </motion.div>

            <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00E6FF]/30 to-transparent pointer-events-none"
                animate={{ top: ['10%', '90%', '10%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
        </motion.div>
    )
}

function StatActionModal({ stat, onClose, onGenerate, onRefresh, onSubscription }) {
    if (!stat) return null

    const actionMap = {
        Controller: {
            title: 'Controller Status',
            description: 'Check whether the web controller session is active and refresh its current state.',
            actionLabel: 'Refresh Console',
            action: onRefresh,
        },
        'Active Users': {
            title: 'Active Users',
            description: 'See the current user load for the live controller environment and refresh the numbers.',
            actionLabel: 'Refresh Console',
            action: onRefresh,
        },
        Headsets: {
            title: 'Connected Headsets',
            description: 'Review current headset connection state and generate a new pairing code for another device.',
            actionLabel: 'Generate Pairing Code',
            action: onGenerate,
        },
        Pairings: {
            title: 'Pairing Status',
            description: 'Open a fresh pairing flow and link a new headset to this controller session.',
            actionLabel: 'Generate Pairing Code',
            action: onGenerate,
        },
        Sessions: {
            title: 'Live Sessions',
            description: 'Refresh the console to inspect active controller sessions and current runtime health.',
            actionLabel: 'Refresh Console',
            action: onRefresh,
        },
        Access: {
            title: 'Subscription Access',
            description: 'Open the subscription screen to manage the current access tier and premium feature state.',
            actionLabel: 'Manage Subscription',
            action: onSubscription,
        },
    }

    const meta = actionMap[stat.label] || {
        title: stat.label,
        description: 'Inspect the current state for this metric.',
        actionLabel: 'Close',
        action: onClose,
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d0d0d] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className={`mb-4 ${stat.color}`}>{stat.icon}</div>
                <p className="text-white/35 text-xs uppercase tracking-[0.28em] font-bold mb-2">{meta.title}</p>
                <h3 className={`text-3xl font-black capitalize ${stat.color}`}>{stat.value}</h3>
                <p className="text-white/80 text-sm font-bold mt-2">{stat.label}</p>
                <p className="text-white/40 text-sm leading-relaxed mt-4">{meta.description}</p>
                <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-white/30 text-[10px] uppercase tracking-[0.24em] font-bold mb-2">Current Detail</p>
                    <p className="text-white/65 text-sm">{stat.sub}</p>
                </div>
                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-white/70 hover:bg-white/[0.05] hover:text-white transition-all"
                    >
                        Close
                    </button>
                    <button
                        onClick={meta.action}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] px-4 py-3 text-sm font-black text-black transition-all hover:shadow-[0_0_40px_rgba(0,230,255,0.28)]"
                    >
                        {meta.actionLabel}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

export default function HeadsetControl() {
    const [code, setCode] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [selectedStat, setSelectedStat] = useState(null)
    const [refreshToken, setRefreshToken] = useState(0)
    const [rejectedDevice, setRejectedDevice] = useState(null)   // Req 6 — pairing rejection
    const [showDisconnect, setShowDisconnect] = useState(false)  // Req 7 — disconnect timer
    const wsWasConnected = useRef(false)
    const navigate = useNavigate()
    const { wsConnected, pairingStatus } = useStore()

    const steps = [
        { n: '01', title: 'Open VR Cinema App', desc: 'Launch the app on your Quest, Pico, or Vision Pro headset.' },
        { n: '02', title: 'Go to Pair Screen', desc: 'Open settings and choose Pair with Web Controller.' },
        { n: '03', title: 'Generate Code Here', desc: 'Create a fresh 6-character pairing code from this page.' },
        { n: '04', title: 'Enter Code in VR', desc: 'Type the code using the headset controller to complete pairing.' },
    ]

    /* ── Req 6: detect pairing rejection from server error ── */
    const generate = async () => {
        setLoading(true)
        setError('')
        setRejectedDevice(null)
        try {
            const res = await streamAPI.getPairingCode()
            setCode(res.data.pairing_code)
            setSelectedStat(null)
        } catch (e) {
            const detail = e.response?.data?.detail || ''
            if (detail.toLowerCase().includes('already paired') || detail.toLowerCase().includes('in use') || e.response?.status === 409) {
                // Backend specifically signalled headset already paired
                setRejectedDevice(e.response?.data?.device_id || 'unknown')
            } else {
                setError(detail || 'Backend is not reachable. Please ensure the server is running.')
            }
        } finally {
            setLoading(false)
        }
    }

    /* ── Req 7: watch WS for disconnect → start countdown ── */
    useEffect(() => {
        if (wsConnected) {
            wsWasConnected.current = true
            setShowDisconnect(false)
        } else if (wsWasConnected.current) {
            // Was connected, now dropped → show countdown
            setShowDisconnect(true)
        }
    }, [wsConnected])

    const handleRefresh = () => {
        setSelectedStat(null)
        setRefreshToken((value) => value + 1)
    }

    const handleSubscription = () => {
        setSelectedStat(null)
        navigate('/subscription')
    }

    return (
        <div className="w-full min-h-screen bg-[#050505] text-white relative overflow-hidden">
            <motion.div
                animate={{ scale: [1, 1.15, 1], x: [0, 30, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-[600px] h-[600px] rounded-full bg-[#7B61FF] opacity-[0.06] blur-[120px] -top-60 -left-60 pointer-events-none"
            />
            <motion.div
                animate={{ scale: [1, 1.2, 1], x: [0, -30, 0] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
                className="absolute w-[500px] h-[500px] rounded-full bg-[#00E6FF] opacity-[0.05] blur-[100px] -bottom-40 -right-20 pointer-events-none"
            />
            <AmbientDots />

            <AnimatePresence>
                {rejectedDevice && (
                    <div className="relative z-10 px-6 lg:px-10 pt-6">
                        <div className="max-w-7xl mx-auto">
                            <PairingRejectedBanner
                                deviceId={rejectedDevice}
                                onRepair={() => { setRejectedDevice(null); generate() }}
                                onDismiss={() => setRejectedDevice(null)}
                            />
                        </div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showDisconnect && (
                    <div className="relative z-10 px-6 lg:px-10 pt-6">
                        <div className="max-w-7xl mx-auto">
                            <DisconnectCountdown
                                onReconnect={() => { setShowDisconnect(false); setRefreshToken(t => t + 1) }}
                                onAbandon={() => { setShowDisconnect(false); navigate('/dashboard') }}
                            />
                        </div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {code && <CodeScreen code={code} onBack={() => setCode(null)} />}
            </AnimatePresence>

            <AnimatePresence>
                {selectedStat && (
                    <StatActionModal
                        stat={selectedStat}
                        onClose={() => setSelectedStat(null)}
                        onGenerate={generate}
                        onRefresh={handleRefresh}
                        onSubscription={handleSubscription}
                    />
                )}
            </AnimatePresence>

            <div className="relative z-10 px-6 lg:px-10 pt-12 pb-16">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-6">
                        <BackButton />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <p className="text-white/35 text-xs uppercase tracking-[0.32em] font-bold mb-3">
                            Headset Control
                        </p>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
                                    Live <span className="text-[#00E6FF]">Pairing Console</span>
                                </h1>
                                <p className="text-white/45 text-sm uppercase tracking-[0.18em] mt-2">
                                    Monitor controller, headset, pairing, and session state in one place
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    <div className="mb-10">
                        <DashboardStats interactive onStatSelect={setSelectedStat} refreshToken={refreshToken} />
                    </div>

                    <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] items-start">
                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] backdrop-blur-xl overflow-hidden"
                        >
                            <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
                                <div className="p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-white/8">
                                    <motion.div
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                        className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#7B61FF]/25 to-[#00E6FF]/15 border border-[#7B61FF]/30 flex items-center justify-center shadow-[0_0_60px_rgba(123,97,255,0.25)] mb-8"
                                    >
                                        <Headphones size={44} className="text-[#00E6FF]" />
                                    </motion.div>

                                    <h2 className="text-3xl font-black uppercase tracking-tight mb-3">
                                        Headset <span className="text-[#00E6FF]">Pairing</span>
                                    </h2>
                                    <p className="text-white/45 text-sm leading-relaxed mb-6">
                                        Generate a fresh controller-to-headset code, then complete the secure one-to-one link from inside the VR app.
                                    </p>

                                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/30 font-bold">
                                        <Wifi size={13} className="text-[#00E6FF]" />
                                        AES-256 • WebSocket • Session Bound
                                    </div>
                                </div>

                                <div className="p-8 lg:p-10">
                                    <div className="space-y-4">
                                        {steps.map((step, index) => (
                                            <motion.div
                                                key={step.n}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 + index * 0.08 }}
                                                className="flex gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4"
                                            >
                                                <span className="text-[#00E6FF] font-black text-sm w-7 shrink-0 pt-0.5">{step.n}</span>
                                                <div>
                                                    <p className="text-white text-sm font-bold">{step.title}</p>
                                                    <p className="text-white/35 text-xs mt-1 leading-relaxed">{step.desc}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(123,97,255,0.14),rgba(0,230,255,0.06))] backdrop-blur-xl p-8 lg:p-10"
                        >
                            <p className="text-white/35 text-xs uppercase tracking-[0.28em] font-bold mb-3">
                                Generate New Pairing
                            </p>
                            <h3 className="text-2xl font-black uppercase tracking-tight mb-3">
                                Create a secure headset code
                            </h3>
                            <p className="text-white/45 text-sm leading-relaxed mb-6">
                                The code stays valid for 10 minutes and is tied to the active controller session.
                            </p>

                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="mb-5 px-5 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm"
                                    >
                                        <p className="font-bold mb-1">Connection Error</p>
                                        <p className="text-red-400/70 text-xs">{error}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={generate}
                                disabled={loading}
                                className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-black font-black text-lg flex items-center justify-center gap-3 tracking-wide shadow-[0_0_40px_rgba(123,97,255,0.35)] hover:shadow-[0_0_60px_rgba(0,230,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        >
                                            <RefreshCw size={20} />
                                        </motion.div>
                                        Generating Code...
                                    </>
                                ) : (
                                    <>
                                        <Wifi size={20} />
                                        Generate Pairing Code
                                    </>
                                )}
                            </motion.button>

                            <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 px-5 py-4">
                                <p className="text-white/30 text-xs uppercase tracking-[0.22em] font-bold mb-2">
                                    What happens next
                                </p>
                                <p className="text-white/55 text-sm leading-relaxed">
                                    After code generation, this page will open a full-screen pairing view so the user can copy the code and enter it directly inside the VR headset.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    )
}
