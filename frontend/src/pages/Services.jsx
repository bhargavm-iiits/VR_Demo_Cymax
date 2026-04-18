import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Cpu, Radio, Key, Film, Link, ChevronRight, Zap, Lock } from 'lucide-react'

const PIPELINE_LAYERS = [
    { layer: 1, name: 'HTTPS/WSS', desc: 'Transport Encryption', icon: <Shield size={16}/>, color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
    { layer: 2, name: 'Argon2id', desc: 'Password Hashing', icon: <Key size={16}/>, color: 'text-purple-400 border-purple-400/30 bg-purple-400/10' },
    { layer: 3, name: 'JWT HS256', desc: 'Authentication', icon: <Lock size={16}/>, color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' },
    { layer: 4, name: 'Subscription', desc: 'Authorization Check', icon: <Cpu size={16}/>, color: 'text-green-400 border-green-400/30 bg-green-400/10' },
    { layer: 5, name: 'Stream Token', desc: 'Time-Limited Access (AES)', icon: <Radio size={16}/>, color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10' },
    { layer: 6, name: 'AES-256 Files', desc: 'Content Encryption at Rest', icon: <Film size={16}/>, color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
    { layer: 7, name: 'HLS Segments', desc: 'No Direct File Access', icon: <Zap size={16}/>, color: 'text-pink-400 border-pink-400/30 bg-pink-400/10' },
    { layer: 8, name: 'Memory-Only', desc: 'No Local Storage of Decrypted Content', icon: <Shield size={16}/>, color: 'text-red-400 border-red-400/30 bg-red-400/10' },
]

const TECH_STACK = [
    { name: 'FastAPI', desc: 'REST API Framework', color: '#00E6FF' },
    { name: 'python-socketio', desc: 'WebSocket Protocol', color: '#7B61FF' },
    { name: 'SQLAlchemy', desc: 'ORM / Database Layer', color: '#10b981' },
    { name: 'pycryptodome', desc: 'AES-256-CBC Encryption', color: '#f59e0b' },
    { name: 'argon2-cffi', desc: 'Password Hashing (OWASP 2024)', color: '#ef4444' },
    { name: 'python-jose', desc: 'JWT Tokens (HS256)', color: '#8b5cf6' },
]

const UPLOAD_STEPS = [
    'Raw Video (MP4/MKV)',
    '[FFmpeg] → Convert to HLS segments (.ts files)',
    '[AES-256-CBC] → Encrypt each .ts segment',
    '[Key Vault] → Store encryption keys (key_id in DB)',
    '[Content Vault] → /vault/encrypted/*.enc',
]

const PLAYBACK_STEPS = [
    'User Browser (Web Controller)',
    'POST /api/auth/login → Argon2id verify → JWT issued',
    'User selects movie from catalog',
    'POST /api/stream/{id}/token → subscription check',
    '[StreamingService] → AES-encrypted stream token',
    '[WebSocket] → send token to VR headset',
    '[VR Headset] → GET manifest.m3u8 → HLS player',
    '[Segment requests] → AES-128 decryption in memory',
    '🥽 VR PLAYBACK',
]

export default function Services() {
    const [activeTab, setActiveTab] = useState('overview')

    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                    System <span className="text-[#00E6FF]">Architecture</span>
                </h1>
                <p className="text-white/50 text-sm uppercase tracking-widest">VR Cinema Secure Streaming — Complete Pipeline</p>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-2 mb-10 border-b border-white/10">
                {[
                    { id: 'overview', label: '📊 Overview' },
                    { id: 'upload', label: '⬆️ Upload Flow' },
                    { id: 'playback', label: '▶️ Playback Flow' },
                    { id: 'security', label: '🔒 Security Layers' },
                    { id: 'stack', label: '⚙️ Tech Stack' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-[2px]
                            ${activeTab === tab.id 
                                ? 'border-[#00E6FF] text-[#00E6FF]' 
                                : 'border-transparent text-white/40 hover:text-white/70'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview */}
            {activeTab === 'overview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid lg:grid-cols-3 gap-6">
                    {[
                        { icon: '🔐', title: 'AES-256 Encryption', desc: 'All video content encrypted at rest using AES-256-CBC with unique keys per movie.', color: 'from-yellow-500/20 to-orange-500/10' },
                        { icon: '🎫', title: 'JWT Authentication', desc: 'Stateless authentication with HS256 signed tokens. User identity verified on every request.', color: 'from-purple-500/20 to-indigo-500/10' },
                        { icon: '📡', title: 'HLS Streaming', desc: 'Adaptive video delivery in encrypted .ts segments. No raw file access ever exposed.', color: 'from-cyan-500/20 to-blue-500/10' },
                        { icon: '🥽', title: 'VR Device Pairing', desc: '6-digit cryptographic pairing codes to bridge Web Controller ↔ VR Headset via WebSocket.', color: 'from-green-500/20 to-teal-500/10' },
                        { icon: '🔑', title: 'Argon2id Hashing', desc: 'OWASP 2024 recommended password hashing. Memory-hard, GPU-resistant.', color: 'from-red-500/20 to-rose-500/10' },
                        { icon: '⏱️', title: 'Token Expiry', desc: 'Stream tokens valid for 60 min. JWT tokens configurable. Single-use pairing codes (10 min).', color: 'from-pink-500/20 to-purple-500/10' },
                    ].map((card, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className={`bg-gradient-to-br ${card.color} border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all`}
                        >
                            <span className="text-3xl">{card.icon}</span>
                            <h3 className="text-white font-bold mt-4 mb-2">{card.title}</h3>
                            <p className="text-white/50 text-sm leading-relaxed">{card.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Upload Flow */}
            {activeTab === 'upload' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
                    <h2 className="text-white/60 uppercase tracking-widest text-xs font-bold mb-8">Content Upload Flow (Admin)</h2>
                    <div className="flex flex-col gap-0">
                        {UPLOAD_STEPS.map((step, i) => (
                            <div key={i} className="flex gap-4 items-start">
                                <div className="flex flex-col items-center">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0
                                        ${i === 0 ? 'bg-white text-black' : i === UPLOAD_STEPS.length - 1 ? 'bg-[#00E6FF] text-black' : 'border border-white/20 text-white/60'}`}>
                                        {i === 0 ? '▶' : i + 1}
                                    </div>
                                    {i < UPLOAD_STEPS.length - 1 && <div className="w-px h-10 bg-white/10 mt-1 mb-1" />}
                                </div>
                                <div className="pb-10">
                                    <p className={`font-mono text-sm ${i === 0 ? 'text-white font-bold' : i === UPLOAD_STEPS.length - 1 ? 'text-[#00E6FF] font-bold' : 'text-white/70'}`}>
                                        {step}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Playback Flow */}
            {activeTab === 'playback' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
                    <h2 className="text-white/60 uppercase tracking-widest text-xs font-bold mb-8">User Playback Flow</h2>
                    <div className="flex flex-col gap-0">
                        {PLAYBACK_STEPS.map((step, i) => (
                            <div key={i} className="flex gap-4 items-start">
                                <div className="flex flex-col items-center">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0
                                        ${i === PLAYBACK_STEPS.length - 1 ? 'bg-[#00E6FF] text-black text-lg' : 'border border-white/20 text-white/60 text-xs'}`}>
                                        {i === PLAYBACK_STEPS.length - 1 ? '🥽' : i + 1}
                                    </div>
                                    {i < PLAYBACK_STEPS.length - 1 && <div className="w-px h-10 bg-white/10 mt-1 mb-1" />}
                                </div>
                                <div className="pb-10">
                                    <p className={`font-mono text-sm ${i === PLAYBACK_STEPS.length - 1 ? 'text-[#00E6FF] font-bold' : 'text-white/70'}`}>
                                        {step}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Security Layers */}
            {activeTab === 'security' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-4">
                    {PIPELINE_LAYERS.map((layer, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 transition-all"
                        >
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${layer.color}`}>
                                {layer.icon}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-white/30 text-xs font-bold">Layer {layer.layer}</span>
                                </div>
                                <p className="text-white font-bold text-sm">{layer.name}</p>
                                <p className="text-white/50 text-xs">{layer.desc}</p>
                            </div>
                            <Shield size={14} className="text-green-400 shrink-0" />
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Tech Stack */}
            {activeTab === 'stack' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-3 gap-6">
                    {TECH_STACK.map((tech, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.08 }}
                            className="group bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 hover:border-white/25 transition-all"
                        >
                            <div className="w-2 h-2 rounded-full mb-4" style={{ backgroundColor: tech.color, boxShadow: `0 0 10px ${tech.color}` }} />
                            <h3 className="text-white font-black text-lg mb-1">{tech.name}</h3>
                            <p className="text-white/50 text-sm">{tech.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    )
}
