import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Key, Lock, Unlock, Copy, Check, RefreshCw, AlertTriangle, Monitor, Smartphone, Tv, Clock, ChevronRight, Play, X } from 'lucide-react'
import BackButton from '../components/BackButton'

/* ── Crypto Helpers ─────────────────────────────────────────── */
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
    return bytes
}

async function generateContentKey() {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const raw = await crypto.subtle.exportKey('raw', key)
    return bytesToHex(new Uint8Array(raw))
}

async function generateLicenseBlob(contentKeyHex, policy) {
    const data = JSON.stringify({ contentKey: contentKeyHex, policy, issued: Date.now(), version: '1.0' })
    const encoded = new TextEncoder().encode(data)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const licenseKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt'])
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, licenseKey, encoded)
    const rawKey = await crypto.subtle.exportKey('raw', licenseKey)
    return {
        blob: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: bytesToHex(iv),
        licenseKey: bytesToHex(new Uint8Array(rawKey)),
    }
}

/* ── Copy Button ────────────────────────────────────────────── */
function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false)
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} className="text-white/40" />}
        </button>
    )
}

/* ── Key Exchange Animation ─────────────────────────────────── */
const EXCHANGE_STEPS = [
    { label: 'Client Request', desc: 'Browser sends license request with content ID + device certificate', icon: <Monitor size={18} />, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30' },
    { label: 'Server Auth', desc: 'License server validates JWT token, checks subscription tier & device limit', icon: <ShieldCheck size={18} />, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30' },
    { label: 'License Issue', desc: 'Server generates encrypted license blob containing AES content key + policy', icon: <Key size={18} />, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/30' },
    { label: 'Key Delivery', desc: 'License blob encrypted with device-specific public key, sent over TLS', icon: <Lock size={18} />, color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/30' },
    { label: 'Decrypt & Play', desc: 'CDM decrypts license → extracts content key → decrypts video segments in memory', icon: <Play size={18} />, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30' },
]

function KeyExchangeVisualizer() {
    const [activeStep, setActiveStep] = useState(-1)
    const [running, setRunning] = useState(false)

    const runAnimation = () => {
        setRunning(true)
        setActiveStep(-1)
        let i = 0
        const interval = setInterval(() => {
            setActiveStep(i)
            i++
            if (i >= EXCHANGE_STEPS.length) {
                clearInterval(interval)
                setTimeout(() => setRunning(false), 1000)
            }
        }, 900)
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#00E6FF]/20 border border-[#00E6FF]/30 flex items-center justify-center">
                        <ChevronRight size={12} className="text-[#00E6FF]" />
                    </div>
                    DRM Key Exchange Flow
                </h3>
                <button onClick={runAnimation} disabled={running}
                    className="flex items-center gap-2 px-4 py-2 bg-[#7B61FF] hover:bg-[#6a52e0] text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50">
                    <Play size={12} /> {running ? 'Running…' : 'Simulate Exchange'}
                </button>
            </div>

            <div className="relative">
                {/* Connection line */}
                <div className="absolute left-6 top-6 bottom-6 w-px bg-white/10" />

                <div className="space-y-3">
                    {EXCHANGE_STEPS.map((step, i) => {
                        const isActive = i <= activeStep
                        const isCurrent = i === activeStep
                        return (
                            <motion.div
                                key={i}
                                animate={isCurrent ? { scale: [1, 1.02, 1], x: [0, 4, 0] } : {}}
                                transition={{ duration: 0.4 }}
                                className={`relative flex items-start gap-4 rounded-2xl border p-4 transition-all duration-500 ${isActive ? step.bg : 'bg-white/[0.02] border-white/8'}`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-500 ${isActive ? step.bg + ' ' + step.color : 'bg-white/5 border-white/10 text-white/30'}`}>
                                    {step.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold uppercase tracking-widest ${isActive ? step.color : 'text-white/30'}`}>Step {i + 1}</span>
                                        {isCurrent && <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />}
                                    </div>
                                    <p className={`font-bold text-sm mt-1 ${isActive ? 'text-white' : 'text-white/40'}`}>{step.label}</p>
                                    <p className={`text-xs mt-1 leading-relaxed ${isActive ? 'text-white/60' : 'text-white/20'}`}>{step.desc}</p>
                                </div>
                                {isActive && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                        className="w-6 h-6 rounded-full bg-green-400/20 border border-green-400/40 flex items-center justify-center shrink-0">
                                        <Check size={12} className="text-green-400" />
                                    </motion.div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/* ── DRM Policy Editor ──────────────────────────────────────── */
const DRM_SYSTEMS = [
    { name: 'Widevine', vendor: 'Google', level: 'L1 (Hardware)', color: '#4285f4', desc: 'Android, Chrome, Chromecast' },
    { name: 'FairPlay', vendor: 'Apple', level: 'Hardware TEE', color: '#a8a8a8', desc: 'Safari, iOS, Apple TV' },
    { name: 'PlayReady', vendor: 'Microsoft', level: 'SL3000', color: '#00a4ef', desc: 'Edge, Xbox, Windows' },
    { name: 'CYMAX DRM', vendor: 'CYMAX VR', level: 'AES-256-GCM', color: '#7B61FF', desc: 'Custom VR headset protection' },
]

/* ── Main Component ─────────────────────────────────────────── */
export default function DRM() {
    // Content key generation
    const [contentKey, setContentKey] = useState('')
    const [keyLoading, setKeyLoading] = useState(false)

    // License generation
    const [policy, setPolicy] = useState({ maxDevices: 2, offlineHours: 48, hdcpRequired: true, outputProtection: 'hdcp2.2' })
    const [license, setLicense] = useState(null)
    const [licLoading, setLicLoading] = useState(false)

    // License management
    const [licenses, setLicenses] = useState([])

    const handleGenKey = async () => {
        setKeyLoading(true)
        const key = await generateContentKey()
        setContentKey(key)
        setKeyLoading(false)
    }

    const handleIssueLicense = async () => {
        if (!contentKey) return
        setLicLoading(true)
        const t0 = performance.now()
        const result = await generateLicenseBlob(contentKey, policy)
        const elapsed = (performance.now() - t0).toFixed(2)
        const lic = {
            id: `LIC-${Date.now().toString(36).toUpperCase()}`,
            ...result,
            contentKey,
            policy: { ...policy },
            issuedAt: new Date().toLocaleString(),
            expiresAt: new Date(Date.now() + policy.offlineHours * 3600000).toLocaleString(),
            status: 'active',
            elapsed,
        }
        setLicense(lic)
        setLicenses(prev => [lic, ...prev])
        setLicLoading(false)
    }

    const revokeLicense = (id) => {
        setLicenses(prev => prev.map(l => l.id === id ? { ...l, status: 'revoked' } : l))
    }

    const inputCls = "w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#7B61FF]/50"
    const labelCls = "text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5 block"

    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">
            <div className="max-w-7xl mx-auto mb-6"><BackButton /></div>

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                    DRM <span className="text-[#7B61FF]">Protection</span>
                </h1>
                <p className="text-white/50 text-sm uppercase tracking-widest">Digital Rights Management · License Server · Key Exchange</p>
            </motion.div>

            {/* DRM Systems Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {DRM_SYSTEMS.map((sys, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                        <div className="w-2.5 h-2.5 rounded-full mb-3" style={{ backgroundColor: sys.color, boxShadow: `0 0 12px ${sys.color}` }} />
                        <h3 className="text-white font-black text-sm">{sys.name}</h3>
                        <p className="text-white/30 text-xs mt-1">{sys.vendor}</p>
                        <p className="text-xs mt-2 font-mono px-2 py-1 rounded-lg bg-white/5 border border-white/8 inline-block" style={{ color: sys.color }}>{sys.level}</p>
                        <p className="text-white/40 text-xs mt-2">{sys.desc}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">

                {/* Left: Key Exchange Visualizer */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <KeyExchangeVisualizer />
                </motion.div>

                {/* Right: Content Key + License Generator */}
                <div className="space-y-6">

                    {/* Step 1: Content Key */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                        <h2 className="text-white font-bold flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-[#00E6FF] text-black text-xs font-black flex items-center justify-center">1</span>
                            Generate Content Encryption Key
                        </h2>
                        <button onClick={handleGenKey} disabled={keyLoading}
                            className="w-full py-3 bg-[#00E6FF] hover:bg-[#00c4da] text-black font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            <RefreshCw size={14} className={keyLoading ? 'animate-spin' : ''} /> Generate AES-256-GCM Key
                        </button>
                        {contentKey && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className={labelCls}>Content Key (HEX)</label>
                                    <CopyBtn text={contentKey} />
                                </div>
                                <div className="bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-xs text-[#00E6FF] break-all">{contentKey}</div>
                            </div>
                        )}
                    </motion.div>

                    {/* Step 2: Policy + License */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                        <h2 className="text-white font-bold flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-yellow-400 text-black text-xs font-black flex items-center justify-center">2</span>
                            DRM Policy & License
                        </h2>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Max Devices</label>
                                <input type="number" value={policy.maxDevices} onChange={e => setPolicy(p => ({ ...p, maxDevices: Number(e.target.value) }))} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Offline Hours</label>
                                <input type="number" value={policy.offlineHours} onChange={e => setPolicy(p => ({ ...p, offlineHours: Number(e.target.value) }))} className={inputCls} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Output Protection</label>
                                <select value={policy.outputProtection} onChange={e => setPolicy(p => ({ ...p, outputProtection: e.target.value }))} className={inputCls + ' cursor-pointer'}>
                                    <option value="none">None</option>
                                    <option value="hdcp1.4">HDCP 1.4</option>
                                    <option value="hdcp2.2">HDCP 2.2</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full">
                                    <span className="text-white/60 text-sm">HDCP Required</span>
                                    <button onClick={() => setPolicy(p => ({ ...p, hdcpRequired: !p.hdcpRequired }))}
                                        className={`w-10 h-5 rounded-full transition-all ml-auto ${policy.hdcpRequired ? 'bg-green-400' : 'bg-white/10'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform mx-0.5 ${policy.hdcpRequired ? 'translate-x-5' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleIssueLicense} disabled={licLoading || !contentKey}
                            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                            <Key size={14} /> {licLoading ? 'Issuing…' : '🔐 Issue DRM License'}
                        </button>

                        {license && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className={labelCls}>License ID</label>
                                    <CopyBtn text={license.id} />
                                </div>
                                <div className="bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white/70 font-mono space-y-1">
                                    <p><span className="text-white/30">ID       :</span> <span className="text-[#7B61FF]">{license.id}</span></p>
                                    <p><span className="text-white/30">Status   :</span> <span className="text-green-400">✅ Active</span></p>
                                    <p><span className="text-white/30">Issued   :</span> {license.issuedAt}</p>
                                    <p><span className="text-white/30">Expires  :</span> {license.expiresAt}</p>
                                    <p><span className="text-white/30">Devices  :</span> {license.policy.maxDevices}</p>
                                    <p><span className="text-white/30">HDCP     :</span> {license.policy.outputProtection}</p>
                                    <p><span className="text-white/30">Crypto   :</span> {license.elapsed}ms</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className={labelCls}>Encrypted License Blob</label>
                                    <CopyBtn text={license.blob} />
                                </div>
                                <textarea readOnly rows={3} value={license.blob}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-[#7B61FF] text-xs font-mono resize-none focus:outline-none" />
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* License Management Table */}
            {licenses.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-10 bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-green-400 text-black text-xs font-black flex items-center justify-center">3</span>
                        License Management Console
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-white/30 uppercase tracking-widest border-b border-white/10">
                                    <th className="text-left py-3 px-3">License ID</th>
                                    <th className="text-left py-3 px-3">Issued</th>
                                    <th className="text-left py-3 px-3">Expires</th>
                                    <th className="text-left py-3 px-3">Devices</th>
                                    <th className="text-left py-3 px-3">Status</th>
                                    <th className="text-right py-3 px-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {licenses.map((lic) => (
                                    <tr key={lic.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                        <td className="py-3 px-3 font-mono text-[#7B61FF]">{lic.id}</td>
                                        <td className="py-3 px-3 text-white/60">{lic.issuedAt}</td>
                                        <td className="py-3 px-3 text-white/60">{lic.expiresAt}</td>
                                        <td className="py-3 px-3 text-white/60">{lic.policy.maxDevices}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${lic.status === 'active' ? 'bg-green-400/15 text-green-400 border border-green-400/30' : 'bg-red-400/15 text-red-400 border border-red-400/30'}`}>
                                                {lic.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            {lic.status === 'active' && (
                                                <button onClick={() => revokeLicense(lic.id)}
                                                    className="text-red-400/60 hover:text-red-400 text-[10px] font-bold uppercase transition-colors">
                                                    Revoke
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </div>
    )
}
