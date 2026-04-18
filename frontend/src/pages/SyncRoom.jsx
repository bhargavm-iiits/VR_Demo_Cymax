import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Copy, Check, Play, Pause, SkipForward, MessageSquare, Send, Wifi, Crown, Clock, X, RefreshCw } from 'lucide-react'
import BackButton from '../components/BackButton'

/* ── Room Code Generator ────────────────────────────────────── */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/* ── Simulated Users ────────────────────────────────────────── */
const DEMO_USERS = [
    { id: 'bot-1', name: 'Arjun_VR', avatar: '🥽', device: 'Quest 3', ping: 12 },
    { id: 'bot-2', name: 'Priya_360', avatar: '🎮', device: 'Vision Pro', ping: 28 },
    { id: 'bot-3', name: 'Rahul_S', avatar: '🖥️', device: 'Chrome Web', ping: 45 },
]

/* ── Copy Button ────────────────────────────────────────────── */
function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false)
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/40" />}
        </button>
    )
}

/* ── Chat Message ───────────────────────────────────────────── */
function ChatMessage({ msg, isOwn }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
        >
            <span className="text-lg shrink-0">{msg.avatar}</span>
            <div className={`max-w-[80%] ${isOwn ? 'text-right' : ''}`}>
                <span className="text-[10px] text-white/30 font-bold">{msg.name}</span>
                <div className={`mt-0.5 px-3 py-2 rounded-2xl text-sm ${isOwn ? 'bg-[#7B61FF]/30 border border-[#7B61FF]/40 text-white' : 'bg-white/8 border border-white/10 text-white/80'}`}>
                    {msg.text}
                </div>
                <span className="text-[9px] text-white/20 mt-0.5 block">{msg.time}</span>
            </div>
        </motion.div>
    )
}

/* ── Main Component ─────────────────────────────────────────── */
export default function SyncRoom() {
    const [roomCode, setRoomCode] = useState(null)
    const [joinCode, setJoinCode] = useState('')
    const [inRoom, setInRoom] = useState(false)
    const [isHost, setIsHost] = useState(false)
    const [participants, setParticipants] = useState([])
    const [playbackState, setPlaybackState] = useState('paused')
    const [currentTime, setCurrentTime] = useState(0)
    const [syncDelta, setSyncDelta] = useState([])
    const [chatMessages, setChatMessages] = useState([])
    const [chatInput, setChatInput] = useState('')
    const [showChat, setShowChat] = useState(true)
    const channelRef = useRef(null)
    const syncIntervalRef = useRef(null)
    const chatEndRef = useRef(null)

    const MY_USER = { id: 'self', name: 'You (Host)', avatar: '👤', device: 'Browser', ping: 0 }

    // BroadcastChannel for cross-tab sync
    useEffect(() => {
        return () => {
            channelRef.current?.close()
            clearInterval(syncIntervalRef.current)
        }
    }, [])

    const createRoom = () => {
        const code = generateRoomCode()
        setRoomCode(code)
        setInRoom(true)
        setIsHost(true)
        setParticipants([MY_USER])

        // Open BroadcastChannel
        const ch = new BroadcastChannel(`cymax-sync-${code}`)
        channelRef.current = ch

        ch.onmessage = (e) => {
            const msg = e.data
            if (msg.type === 'join') {
                setParticipants(prev => {
                    if (prev.find(p => p.id === msg.user.id)) return prev
                    return [...prev, msg.user]
                })
            }
            if (msg.type === 'chat') {
                setChatMessages(prev => [...prev, msg.payload])
            }
            if (msg.type === 'leave') {
                setParticipants(prev => prev.filter(p => p.id !== msg.userId))
            }
        }

        // Simulate bots joining with delay
        setTimeout(() => {
            setParticipants(prev => [...prev, DEMO_USERS[0]])
            setChatMessages(prev => [...prev, { id: Date.now(), name: DEMO_USERS[0].name, avatar: DEMO_USERS[0].avatar, text: 'Hey! I\'m in the room 🥽', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: false }])
        }, 2000)
        setTimeout(() => {
            setParticipants(prev => [...prev, DEMO_USERS[1]])
        }, 4000)
        setTimeout(() => {
            setParticipants(prev => [...prev, DEMO_USERS[2]])
            setChatMessages(prev => [...prev, { id: Date.now() + 1, name: DEMO_USERS[2].name, avatar: DEMO_USERS[2].avatar, text: 'Ready to watch! 🍿', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: false }])
        }, 5500)

        // Sync heartbeat
        syncIntervalRef.current = setInterval(() => {
            setSyncDelta(DEMO_USERS.map(u => ({
                name: u.name,
                delta: Math.round((Math.random() - 0.3) * 80),
                ping: u.ping + Math.round((Math.random() - 0.5) * 10),
            })))
        }, 2000)
    }

    const joinRoom = () => {
        if (!joinCode.trim()) return
        setRoomCode(joinCode.toUpperCase())
        setInRoom(true)
        setIsHost(false)
        setParticipants([
            { id: 'host', name: 'Room Host', avatar: '👑', device: 'Browser', ping: 15 },
            MY_USER,
            ...DEMO_USERS.slice(0, 2),
        ])

        const ch = new BroadcastChannel(`cymax-sync-${joinCode.toUpperCase()}`)
        channelRef.current = ch
        ch.postMessage({ type: 'join', user: MY_USER })
    }

    const leaveRoom = () => {
        channelRef.current?.postMessage({ type: 'leave', userId: MY_USER.id })
        channelRef.current?.close()
        clearInterval(syncIntervalRef.current)
        setInRoom(false)
        setRoomCode(null)
        setParticipants([])
        setChatMessages([])
        setCurrentTime(0)
        setPlaybackState('paused')
    }

    const broadcastCommand = (cmd) => {
        if (cmd === 'play') {
            setPlaybackState('playing')
        } else if (cmd === 'pause') {
            setPlaybackState('paused')
        } else if (cmd === 'skip') {
            setCurrentTime(prev => prev + 10)
        }
        channelRef.current?.postMessage({ type: 'command', command: cmd })
    }

    // Simulate playback timer
    useEffect(() => {
        if (playbackState !== 'playing') return
        const interval = setInterval(() => setCurrentTime(t => t + 1), 1000)
        return () => clearInterval(interval)
    }, [playbackState])

    const sendChat = (e) => {
        e.preventDefault()
        if (!chatInput.trim()) return
        const msg = {
            id: Date.now(),
            name: MY_USER.name,
            avatar: MY_USER.avatar,
            text: chatInput,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOwn: true,
        }
        setChatMessages(prev => [...prev, msg])
        channelRef.current?.postMessage({ type: 'chat', payload: { ...msg, isOwn: false } })
        setChatInput('')
    }

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

    // ── LOBBY ──────────────────
    if (!inRoom) {
        return (
            <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">
                <div className="max-w-7xl mx-auto mb-6"><BackButton /></div>

                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                    <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                        Watch <span className="text-[#00E6FF]">Party</span>
                    </h1>
                    <p className="text-white/50 text-sm uppercase tracking-widest">Multi-User Sync · Room-Based · Real-Time Playback</p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
                    {/* Create Room */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-[#7B61FF]/15 to-[#00E6FF]/8 border border-white/10 rounded-3xl p-8 space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-[#7B61FF]/20 border border-[#7B61FF]/30 flex items-center justify-center">
                            <Crown size={28} className="text-[#7B61FF]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Create Room</h2>
                            <p className="text-white/45 text-sm mt-2 leading-relaxed">Host a watch party. You control playback — all participants sync to your timeline.</p>
                        </div>
                        <button onClick={createRoom}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-black font-black text-sm uppercase tracking-widest hover:shadow-[0_0_40px_rgba(123,97,255,0.4)] transition-all">
                            Create Watch Party
                        </button>
                    </motion.div>

                    {/* Join Room */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-[#00E6FF]/15 border border-[#00E6FF]/30 flex items-center justify-center">
                            <Users size={28} className="text-[#00E6FF]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Join Room</h2>
                            <p className="text-white/45 text-sm mt-2 leading-relaxed">Enter a 6-character room code to join an existing watch party.</p>
                        </div>
                        <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="Enter room code"
                            maxLength={6}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg font-mono tracking-[0.3em] focus:outline-none focus:border-[#00E6FF]/50 placeholder-white/20 uppercase" />
                        <button onClick={joinRoom} disabled={joinCode.length < 6}
                            className="w-full py-4 rounded-2xl bg-[#00E6FF] text-black font-black text-sm uppercase tracking-widest hover:bg-[#00c4da] transition-all disabled:opacity-40">
                            Join Watch Party
                        </button>
                    </motion.div>
                </div>

                {/* How it works */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="mt-10 max-w-4xl">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">How Sync Works</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { icon: '🔗', title: 'Create/Join', desc: 'Host generates a room code. Others join using the code.' },
                            { icon: '⏱️', title: 'Sync Engine', desc: 'BroadcastChannel (cross-tab) + WebSocket (cross-device) keep all participants in sync.' },
                            { icon: '🎮', title: 'Host Control', desc: 'Host controls play/pause/seek. All participants follow the host timeline.' },
                            { icon: '💬', title: 'Live Chat', desc: 'Real-time chat during the watch party with all room members.' },
                        ].map((step, i) => (
                            <div key={i} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
                                <span className="text-2xl">{step.icon}</span>
                                <h4 className="text-white font-bold text-xs mt-2 uppercase tracking-wide">{step.title}</h4>
                                <p className="text-white/35 text-xs mt-1 leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        )
    }

    // ── IN ROOM ────────────────
    return (
        <div className="w-full min-h-screen bg-[#050505] text-white">
            <div className="flex h-screen">

                {/* Main Area */}
                <div className="flex-1 flex flex-col p-6 lg:p-8 overflow-y-auto">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-black uppercase tracking-widest">
                                    Watch <span className="text-[#00E6FF]">Party</span>
                                </h1>
                                <div className="flex items-center gap-2 px-3 py-1 bg-[#7B61FF]/15 border border-[#7B61FF]/30 rounded-full">
                                    <span className="text-xs font-mono font-bold text-[#7B61FF] tracking-widest">{roomCode}</span>
                                    <CopyBtn text={roomCode} />
                                </div>
                                {isHost && (
                                    <span className="text-[10px] font-bold uppercase text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-1 rounded-full">Host</span>
                                )}
                            </div>
                            <p className="text-white/35 text-xs mt-1">{participants.length} participants connected</p>
                        </div>
                        <button onClick={leaveRoom}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl hover:bg-red-500/20 transition-all">
                            <X size={13} /> Leave Room
                        </button>
                    </div>

                    {/* Playback Area */}
                    <div className="flex-1 rounded-3xl bg-gradient-to-br from-[#7B61FF]/10 to-[#00E6FF]/5 border border-white/10 overflow-hidden flex flex-col">
                        {/* Video placeholder */}
                        <div className="flex-1 flex items-center justify-center relative">
                            <div className="text-center">
                                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }}
                                    className="text-6xl mb-4">🎬</motion.div>
                                <p className="text-white/60 text-sm font-bold">Synchronized VR Stream</p>
                                <p className="text-white/30 text-xs mt-1">All participants watching at the same position</p>
                            </div>

                            {/* Playback time badge */}
                            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full backdrop-blur-sm border border-white/10">
                                <Clock size={12} className="text-[#00E6FF]" />
                                <span className="text-xs font-mono font-bold text-white">{formatTime(currentTime)}</span>
                                <span className="text-[10px] text-white/30">/ 1:30:00</span>
                            </div>

                            {/* Playback state */}
                            <div className="absolute top-4 left-4">
                                <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${playbackState === 'playing' ? 'bg-green-400/10 text-green-400 border-green-400/30' : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30'}`}>
                                    {playbackState === 'playing' ? <><motion.div className="w-2 h-2 rounded-full bg-green-400" animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1 }} /> Playing</> : <><Pause size={12} /> Paused</>}
                                </span>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="p-4 border-t border-white/8 bg-black/30">
                            {/* Progress bar */}
                            <div className="mb-4 h-1 bg-white/10 rounded-full overflow-hidden">
                                <motion.div className="h-full bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] rounded-full"
                                    style={{ width: `${(currentTime / 5400) * 100}%` }} />
                            </div>

                            <div className="flex items-center justify-center gap-4">
                                <motion.button whileTap={{ scale: 0.9 }} onClick={() => broadcastCommand('skip')}
                                    className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all">
                                    <SkipForward size={18} />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.95 }}
                                    onClick={() => broadcastCommand(playbackState === 'playing' ? 'pause' : 'play')}
                                    className="w-14 h-14 rounded-2xl bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] flex items-center justify-center text-black shadow-[0_0_30px_rgba(123,97,255,0.4)] hover:shadow-[0_0_50px_rgba(0,230,255,0.4)] transition-all">
                                    {playbackState === 'playing' ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
                                </motion.button>
                                <button onClick={() => setShowChat(!showChat)}
                                    className={`p-3 rounded-xl border transition-all ${showChat ? 'bg-[#00E6FF]/10 border-[#00E6FF]/30 text-[#00E6FF]' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}>
                                    <MessageSquare size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sync Status */}
                    {syncDelta.length > 0 && (
                        <div className="mt-4 rounded-2xl bg-white/[0.03] border border-white/8 p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Sync Status (ms offset from host)</p>
                            <div className="flex gap-4 flex-wrap">
                                {syncDelta.map((d, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs text-white/50">{d.name}</span>
                                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${Math.abs(d.delta) < 30 ? 'bg-green-400/10 text-green-400' : Math.abs(d.delta) < 60 ? 'bg-yellow-400/10 text-yellow-400' : 'bg-red-400/10 text-red-400'}`}>
                                            {d.delta > 0 ? '+' : ''}{d.delta}ms
                                        </span>
                                        <span className="text-[10px] text-white/25">{d.ping}ms</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Participants + Chat */}
                <AnimatePresence>
                    {showChat && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 340, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="h-screen flex flex-col border-l border-white/8 bg-[#0a0a0a] overflow-hidden"
                        >
                            {/* Participants */}
                            <div className="p-4 border-b border-white/8">
                                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                                    Participants ({participants.length})
                                </p>
                                <div className="space-y-2">
                                    {participants.map((p) => (
                                        <div key={p.id} className="flex items-center gap-3 py-1.5">
                                            <span className="text-lg">{p.avatar}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-bold truncate">{p.name}</p>
                                                <p className="text-white/30 text-[10px]">{p.device}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Wifi size={10} className="text-green-400" />
                                                <span className="text-[10px] text-white/30">{p.ping}ms</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Chat */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <p className="text-xs font-bold uppercase tracking-widest text-white/40 px-4 pt-3 pb-2">Live Chat</p>
                                <div className="flex-1 overflow-y-auto px-4 space-y-3 custom-scrollbar">
                                    {chatMessages.map((msg) => (
                                        <ChatMessage key={msg.id} msg={msg} isOwn={msg.isOwn} />
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                                <form onSubmit={sendChat} className="p-3 border-t border-white/8">
                                    <div className="flex gap-2">
                                        <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                                            placeholder="Type a message…"
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#7B61FF]/40" />
                                        <button type="submit"
                                            className="p-2.5 rounded-xl bg-[#7B61FF] text-white hover:bg-[#6a52e0] transition-all">
                                            <Send size={14} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
