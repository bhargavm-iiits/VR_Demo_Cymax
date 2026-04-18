import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Eye, EyeOff, Fingerprint, Monitor, AlertTriangle, Check, X, Lock, Zap, Camera, Tv, Usb } from 'lucide-react'
import BackButton from '../components/BackButton'

/* ── Fingerprint Generator ──────────────────────────────────── */
async function generateFingerprint(userId = 'user_42') {
    const components = [
        userId,
        navigator.userAgent,
        navigator.language,
        `${screen.width}x${screen.height}`,
        new Date().toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.hardwareConcurrency || 'unknown',
    ]
    const raw = components.join('|')
    const encoded = new TextEncoder().encode(raw)
    const hash = await crypto.subtle.digest('SHA-256', encoded)
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
    return { fingerprint: hex, components, raw }
}

/* ── Threat Model Data ──────────────────────────────────────── */
const THREAT_VECTORS = [
    {
        id: 'screen_record', icon: <Camera size={18} />, name: 'Screen Recording',
        desc: 'User attempts to record screen using OS tools (OBS, ScreenCapture)',
        risk: 'high', blocked: true,
        layers: ['HDCP 2.2 Output Protection', 'Visibility API Detection', 'DRM CDM Enforcement'],
        mitigation: 'CDM-enforced HDCP prevents capture of protected content. Visibility change triggers playback pause.',
    },
    {
        id: 'direct_download', icon: <Monitor size={18} />, name: 'Direct File Download',
        desc: 'User tries to access raw video files via URL manipulation',
        risk: 'high', blocked: true,
        layers: ['HLS Segmentation', 'AES-128 Segment Encryption', 'Token-Based Access', 'No Direct File Paths'],
        mitigation: 'Video served as encrypted HLS segments. No raw MP4 endpoints exist. Each segment requires valid stream token.',
    },
    {
        id: 'hdmi_capture', icon: <Tv size={18} />, name: 'HDMI Capture Card',
        desc: 'User connects external capture device to intercept video signal',
        risk: 'medium', blocked: true,
        layers: ['HDCP 2.2 Enforcement', 'Hardware DRM (Widevine L1)', 'Forensic Watermarking'],
        mitigation: 'HDCP 2.2 prevents unprotected HDMI output. Even if bypassed, forensic watermark identifies the source.',
    },
    {
        id: 'token_theft', icon: <Lock size={18} />, name: 'Token/Session Hijack',
        desc: 'Attacker steals JWT or stream token to access content',
        risk: 'medium', blocked: true,
        layers: ['JWT Expiry (24h)', 'Stream Token Expiry (60m)', 'Device Binding', 'Session Invalidation'],
        mitigation: 'Tokens are short-lived and bound to device fingerprint. Stolen tokens expire quickly and cannot be reused.',
    },
    {
        id: 'usb_rip', icon: <Usb size={18} />, name: 'USB/Storage Rip',
        desc: 'User tries to copy decrypted content from device storage',
        risk: 'low', blocked: true,
        layers: ['Memory-Only Decryption', 'No Temp File Storage', 'CDM Secure Buffer'],
        mitigation: 'Decrypted content exists only in CDM secure buffer (TEE). Never written to disk or accessible storage.',
    },
]

/* ── Watermark Demo ─────────────────────────────────────────── */
function WatermarkDemo() {
    const [visible, setVisible] = useState(false)
    const [userId] = useState('BHARGAV_M')
    const [sessionId] = useState(() => `SES-${Date.now().toString(36).toUpperCase().slice(-6)}`)
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        canvas.width = 600
        canvas.height = 340

        // Draw demo "video frame"
        const grad = ctx.createLinearGradient(0, 0, 600, 340)
        grad.addColorStop(0, '#1a0a3e')
        grad.addColorStop(0.5, '#0a1628')
        grad.addColorStop(1, '#0a2a1a')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 600, 340)

        // Draw some scene elements
        ctx.fillStyle = 'rgba(123, 97, 255, 0.15)'
        ctx.beginPath()
        ctx.arc(300, 170, 120, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(0, 230, 255, 0.1)'
        ctx.beginPath()
        ctx.arc(180, 200, 80, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.font = 'bold 28px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('🎬 VR Scene Frame', 300, 160)

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.font = '14px system-ui'
        ctx.fillText('Simulated video frame for watermark demo', 300, 190)

        // Draw watermark
        if (visible) {
            ctx.save()
            ctx.globalAlpha = 0.12
            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 16px monospace'
            ctx.textAlign = 'left'

            for (let y = 30; y < 340; y += 60) {
                for (let x = 20; x < 600; x += 240) {
                    ctx.save()
                    ctx.translate(x, y)
                    ctx.rotate(-0.3)
                    ctx.fillText(`${userId} | ${sessionId}`, 0, 0)
                    ctx.restore()
                }
            }
            ctx.restore()
        } else {
            // Invisible watermark (encoded in pixel data — conceptual)
            ctx.save()
            ctx.globalAlpha = 0.008
            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 12px monospace'
            for (let y = 50; y < 340; y += 80) {
                for (let x = 30; x < 600; x += 200) {
                    ctx.fillText(`${userId}:${sessionId}`, x, y)
                }
            }
            ctx.restore()
        }

        // Overlay badge
        ctx.fillStyle = visible ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)'
        ctx.beginPath()
        const badgeX = 10, badgeY = 310
        const radius = 8
        ctx.moveTo(badgeX + radius, badgeY)
        ctx.lineTo(badgeX + 180, badgeY)
        ctx.quadraticCurveTo(badgeX + 188, badgeY, badgeX + 188, badgeY + radius)
        ctx.lineTo(badgeX + 188, badgeY + 22)
        ctx.quadraticCurveTo(badgeX + 188, badgeY + 30, badgeX + 180, badgeY + 30)
        ctx.lineTo(badgeX + radius, badgeY + 30)
        ctx.quadraticCurveTo(badgeX, badgeY + 30, badgeX, badgeY + 22)
        ctx.lineTo(badgeX, badgeY + radius)
        ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY)
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px system-ui'
        ctx.textAlign = 'left'
        ctx.fillText(visible ? '👁 VISIBLE WATERMARK' : '🔒 INVISIBLE WATERMARK', badgeX + 10, badgeY + 19)

    }, [visible, userId, sessionId])

    return (
        <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-white/10">
                <canvas ref={canvasRef} className="w-full h-auto" />
            </div>

            <div className="flex items-center justify-between">
                <div className="flex gap-3">
                    <button onClick={() => setVisible(false)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${!visible ? 'bg-green-400/15 border border-green-400/30 text-green-400' : 'bg-white/5 border border-white/10 text-white/40'}`}>
                        <EyeOff size={13} /> Invisible (Forensic)
                    </button>
                    <button onClick={() => setVisible(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${visible ? 'bg-red-400/15 border border-red-400/30 text-red-400' : 'bg-white/5 border border-white/10 text-white/40'}`}>
                        <Eye size={13} /> Visible (Deterrent)
                    </button>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-white/30 font-mono">User: {userId}</p>
                    <p className="text-[10px] text-white/30 font-mono">Session: {sessionId}</p>
                </div>
            </div>
        </div>
    )
}

/* ── Screen Capture Detection ───────────────────────────────── */
function ScreenCaptureDetector() {
    const [detections, setDetections] = useState([])
    const [monitoring, setMonitoring] = useState(false)

    useEffect(() => {
        if (!monitoring) return

        const handleVisChange = () => {
            if (document.hidden) {
                setDetections(prev => [...prev, {
                    type: 'visibility_change',
                    label: '⚠️ Tab hidden / app switched',
                    time: new Date().toLocaleTimeString(),
                    severity: 'warning',
                }])
            }
        }

        const handleBlur = () => {
            setDetections(prev => [...prev, {
                type: 'window_blur',
                label: '🔍 Window lost focus',
                time: new Date().toLocaleTimeString(),
                severity: 'info',
            }])
        }

        const handleKeyDown = (e) => {
            // Detect PrintScreen
            if (e.key === 'PrintScreen') {
                e.preventDefault()
                setDetections(prev => [...prev, {
                    type: 'print_screen',
                    label: '🚨 PrintScreen key detected!',
                    time: new Date().toLocaleTimeString(),
                    severity: 'critical',
                }])
            }
            // Detect screen recording shortcuts
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
                setDetections(prev => [...prev, {
                    type: 'screenshot_shortcut',
                    label: '🚨 Screenshot shortcut detected!',
                    time: new Date().toLocaleTimeString(),
                    severity: 'critical',
                }])
            }
        }

        document.addEventListener('visibilitychange', handleVisChange)
        window.addEventListener('blur', handleBlur)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('visibilitychange', handleVisChange)
            window.removeEventListener('blur', handleBlur)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [monitoring])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <button onClick={() => { setMonitoring(!monitoring); if (!monitoring) setDetections([]) }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${monitoring ? 'bg-red-500/15 border border-red-500/30 text-red-400' : 'bg-green-400/15 border border-green-400/30 text-green-400'}`}>
                    {monitoring ? <><X size={14} /> Stop Monitoring</> : <><Zap size={14} /> Start Monitoring</>}
                </button>
                {monitoring && (
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
                )}
            </div>

            {monitoring && (
                <div className="text-xs text-white/40 bg-white/[0.03] border border-white/8 rounded-xl p-3">
                    💡 Try: Switch tabs, click outside window, or press PrintScreen to trigger detections.
                </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                <AnimatePresence>
                    {detections.map((d, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-center gap-3 text-xs rounded-xl px-4 py-3 border ${d.severity === 'critical' ? 'bg-red-400/10 border-red-400/30 text-red-400' : d.severity === 'warning' ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400' : 'bg-blue-400/10 border-blue-400/30 text-blue-400'}`}
                        >
                            <AlertTriangle size={14} />
                            <span className="flex-1 font-bold">{d.label}</span>
                            <span className="text-white/30 font-mono">{d.time}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {detections.length === 0 && monitoring && (
                    <p className="text-white/20 text-xs text-center py-4">No detections yet. Try switching tabs…</p>
                )}
            </div>
        </div>
    )
}

/* ── Main Component ─────────────────────────────────────────── */
export default function AntiPiracy() {
    const [fingerprint, setFingerprint] = useState(null)
    const [fingerprintLoading, setFingerprintLoading] = useState(false)
    const [selectedThreat, setSelectedThreat] = useState(null)

    const handleGenFingerprint = async () => {
        setFingerprintLoading(true)
        const result = await generateFingerprint('bhargav_m')
        setFingerprint(result)
        setFingerprintLoading(false)
    }

    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">
            <div className="max-w-7xl mx-auto mb-6"><BackButton /></div>

            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                    Anti-<span className="text-red-400">Piracy</span>
                </h1>
                <p className="text-white/50 text-sm uppercase tracking-widest">Content Protection · Watermarking · Forensic Fingerprinting</p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Left: Watermark + Screen Detection */}
                <div className="space-y-8">
                    {/* Watermark Demo */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <Eye size={16} className="text-[#7B61FF]" /> Forensic Watermarking
                        </h2>
                        <p className="text-white/30 text-xs mb-5">User ID + session embedded into every video frame</p>
                        <WatermarkDemo />
                    </motion.div>

                    {/* Screen Capture Detection */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <Camera size={16} className="text-red-400" /> Screen Capture Detection
                        </h2>
                        <p className="text-white/30 text-xs mb-5">Real-time monitoring for screen recording attempts</p>
                        <ScreenCaptureDetector />
                    </motion.div>
                </div>

                {/* Right: Threats + Fingerprint */}
                <div className="space-y-8">
                    {/* Threat Simulator */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <ShieldAlert size={16} className="text-yellow-400" /> Threat Simulator
                        </h2>
                        <p className="text-white/30 text-xs mb-5">Click an attack vector to see which protection layers block it</p>

                        <div className="space-y-2">
                            {THREAT_VECTORS.map((threat) => (
                                <div key={threat.id}>
                                    <button
                                        onClick={() => setSelectedThreat(selectedThreat?.id === threat.id ? null : threat)}
                                        className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${selectedThreat?.id === threat.id ? 'bg-white/8 border-white/20' : 'bg-white/[0.02] border-white/8 hover:bg-white/[0.05]'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${threat.risk === 'high' ? 'bg-red-400/10 border-red-400/30 text-red-400' : threat.risk === 'medium' ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400' : 'bg-blue-400/10 border-blue-400/30 text-blue-400'}`}>
                                            {threat.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-white font-bold text-sm">{threat.name}</p>
                                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${threat.risk === 'high' ? 'bg-red-400/15 text-red-400' : threat.risk === 'medium' ? 'bg-yellow-400/15 text-yellow-400' : 'bg-blue-400/15 text-blue-400'}`}>
                                                    {threat.risk}
                                                </span>
                                            </div>
                                            <p className="text-white/35 text-xs mt-0.5 truncate">{threat.desc}</p>
                                        </div>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${threat.blocked ? 'bg-green-400/15 text-green-400' : 'bg-red-400/15 text-red-400'}`}>
                                            {threat.blocked ? <Check size={14} /> : <X size={14} />}
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {selectedThreat?.id === threat.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="ml-5 mt-2 mb-3 pl-4 border-l-2 border-green-400/30 space-y-3">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Protection Layers</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {threat.layers.map((layer, i) => (
                                                                <motion.span key={i}
                                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    transition={{ delay: i * 0.08 }}
                                                                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
                                                                    ✓ {layer}
                                                                </motion.span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <p className="text-white/50 text-xs leading-relaxed">{threat.mitigation}</p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Fingerprint Generator */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                        <h2 className="text-white font-bold text-sm flex items-center gap-2">
                            <Fingerprint size={16} className="text-[#00E6FF]" /> Session Fingerprint
                        </h2>
                        <p className="text-white/30 text-xs">Generate a unique device + session hash for forensic tracking</p>

                        <button onClick={handleGenFingerprint} disabled={fingerprintLoading}
                            className="w-full py-3 bg-[#00E6FF] hover:bg-[#00c4da] text-black font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            <Fingerprint size={14} /> {fingerprintLoading ? 'Generating…' : 'Generate Fingerprint'}
                        </button>

                        {fingerprint && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5 block">SHA-256 Fingerprint</label>
                                    <div className="bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-xs text-[#00E6FF] break-all">
                                        {fingerprint.fingerprint}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5 block">Components</label>
                                    <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-1">
                                        {fingerprint.components.map((c, i) => (
                                            <p key={i} className="text-xs text-white/50 font-mono">
                                                <span className="text-white/25">[{i}]</span> {c.length > 60 ? c.slice(0, 60) + '…' : c}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
