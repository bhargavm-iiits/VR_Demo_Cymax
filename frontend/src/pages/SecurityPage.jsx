import { useState } from 'react'
import { motion } from 'framer-motion'
import { Film, Key, Shield, RefreshCw, Copy, Check } from 'lucide-react'

/* ── JWT via Web Crypto (HS256 simulation) ── */
function base64url(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function base64urlFromBytes(bytes) {
    return base64url(String.fromCharCode(...bytes))
}

async function createJWT(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' }
    const hb64 = base64url(JSON.stringify(header))
    const pb64 = base64url(JSON.stringify(payload))
    const sigInput = `${hb64}.${pb64}`
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigInput))
    return `${sigInput}.${base64urlFromBytes(new Uint8Array(sigBytes))}`
}

async function verifyJWT(token, secret) {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('Invalid JWT format')
    const [hb64, pb64, sig] = parts
    const sigInput = `${hb64}.${pb64}`
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(sigInput))
    if (!valid) throw new Error('Signature invalid')
    const payload = JSON.parse(atob(pb64.replace(/-/g, '+').replace(/_/g, '/')))
    return payload
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false)
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            {copied ? <Check size={14} className="text-green-400"/> : <Copy size={14} className="text-white/50"/>}
        </button>
    )
}

const JWT_SECRET = 'vr-cinema-demo-secret-key-2024'
const SUBSCRIPTIONS = ['free', 'basic', 'premium']

export default function Security() {
    // JWT Create
    const [userId, setUserId] = useState('42')
    const [username, setUsername] = useState('vr_user_01')
    const [subscription, setSubscription] = useState('premium')
    const [expiryHours, setExpiryHours] = useState(24)
    const [jwtToken, setJwtToken] = useState('')
    const [jwtInfo, setJwtInfo] = useState('')
    const [jwtLoading, setJwtLoading] = useState(false)

    // JWT Verify
    const [verifyInput, setVerifyInput] = useState('')
    const [verifyResult, setVerifyResult] = useState('')
    const [verifyLoading, setVerifyLoading] = useState(false)

    // Stream Token
    const [stUserId, setStUserId] = useState('42')
    const [stMovieId, setStMovieId] = useState('7')
    const [stTitle, setStTitle] = useState('Dwaraka VR Experience')
    const [stToken, setStToken] = useState('')
    const [stInfo, setStInfo] = useState('')
    const [stLoading, setStLoading] = useState(false)

    const handleCreateJWT = async () => {
        setJwtLoading(true)
        const now = Math.floor(Date.now() / 1000)
        const payload = {
            sub: userId, username, subscription,
            iat: now, exp: now + expiryHours * 3600,
            type: 'access', vr_cinema_v: '1.0'
        }
        try {
            const token = await createJWT(payload, JWT_SECRET)
            setJwtToken(token)
            setVerifyInput(token)
            const expDate = new Date((now + expiryHours * 3600) * 1000)
            setJwtInfo(
`✅ JWT ACCESS TOKEN CREATED

👤 User Info:
   User ID      : ${userId}
   Username     : ${username}
   Subscription : ${subscription}

🔐 TOKEN STRUCTURE:
━━━━━━━━━━━━━━━━━━━
HEADER: {"alg": "HS256", "typ": "JWT"}

PAYLOAD CLAIMS:
   sub           : ${userId}
   username      : ${username}
   subscription  : ${subscription}
   issued_at     : ${new Date(now * 1000).toLocaleString()}
   expires_at    : ${expDate.toLocaleString()}
   type          : access

SIGNATURE: [HMAC-SHA256 signed]

⏱️  Token valid for : ${expiryHours} hours

🎬 VR Cinema Usage:
   → User logs in → receives this token
   → Sent with every API request header
   → Web controller uses token in WebSocket
   → VR headset uses for stream authentication`
            )
        } catch (e) { setJwtInfo('❌ Error: ' + e.message) }
        setJwtLoading(false)
    }

    const handleVerifyJWT = async () => {
        setVerifyLoading(true)
        try {
            const payload = await verifyJWT(verifyInput.trim(), JWT_SECRET)
            const now = Math.floor(Date.now() / 1000)
            const remaining = payload.exp - now
            const expired = remaining <= 0
            setVerifyResult(
`${expired ? '❌ TOKEN EXPIRED' : '✅ TOKEN VERIFIED SUCCESSFULLY'}

👤 Token Claims:
   User ID      : ${payload.sub}
   Username     : ${payload.username}
   Subscription : ${payload.subscription}
   Token Type   : ${payload.type}

⏱️  Time Info:
   Issued At    : ${new Date(payload.iat * 1000).toLocaleString()}
   Expires At   : ${new Date(payload.exp * 1000).toLocaleString()}
   Remaining    : ${expired ? '⚠️ EXPIRED' : `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`}

🔒 Security Status:
   Signature    : ✅ VALID (HMAC-SHA256)
   Expiry       : ${expired ? '❌ EXPIRED' : '✅ NOT EXPIRED'}
   Algorithm    : HS256

🎬 ${expired ? 'Access Denied: Token expired. Login again.' : 'Access Granted: User can access streaming API'}`
            )
        } catch (e) {
            setVerifyResult(`❌ INVALID TOKEN: ${e.message}`)
        }
        setVerifyLoading(false)
    }

    const handleStreamToken = async () => {
        setStLoading(true)
        try {
            const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
                .map(b => b.toString(36)).join('').slice(0, 32)
            const expiresAt = new Date(Date.now() + 3600000)
            const keyBytes = crypto.getRandomValues(new Uint8Array(32))
            const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('')
            setStToken(`STREAM:${btoa(`${stUserId}:${stMovieId}:${rawToken.slice(0, 16)}...`)}`)
            setStInfo(
`✅ STREAMING TOKEN GENERATED
(Phase 5: HLS Pipeline)

🎬 Content Info:
   Movie ID      : ${stMovieId}
   Movie Title   : ${stTitle}
   Requested By  : User ${stUserId}

🔑 Token Details:
   Raw Token     : ${rawToken.slice(0,20)}...
   Expires At    : ${expiresAt.toLocaleString()} UTC
   Valid For     : 60 minutes

📡 HLS Stream URLs:
   Manifest URL  : /api/stream/${stMovieId}/manifest.m3u8
   Key URL       : /api/stream/${stMovieId}/key?token=${rawToken.slice(0,16)}...

📋 HLS Manifest Preview:
   #EXTM3U
   #EXT-X-VERSION:3
   #EXT-X-TARGETDURATION:6
   #EXT-X-KEY:METHOD=AES-128,URI="/api/stream/${stMovieId}/key"
   #EXTINF:6.0,
   /api/stream/${stMovieId}/segment_0000.ts?token=...
   ...
   #EXT-X-ENDLIST

🛡️  Security Features:
   ✅ Token-based secure streaming
   ✅ Segmented video (HLS)
   ✅ Encrypted streaming (AES-128)
   ✅ Time-limited access (1 hour)
   ✅ User-specific token binding`
            )
        } catch (e) { setStInfo('❌ Error: ' + e.message) }
        setStLoading(false)
    }

    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">

            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                    Auth & <span className="text-[#00E6FF]">Security</span>
                </h1>
                <p className="text-white/50 text-sm uppercase tracking-widest">JWT Tokens · Stream Access · Authentication Pipeline</p>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-8 max-w-6xl">

                {/* JWT CREATE */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                    <h2 className="font-bold text-white flex items-center gap-2">
                        <Key size={16} className="text-yellow-400"/>
                        Create JWT Token
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-white/40 mb-1 block">User ID</label>
                            <input value={userId} onChange={e => setUserId(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00E6FF]/50"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-white/40 mb-1 block">Username</label>
                            <input value={username} onChange={e => setUsername(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00E6FF]/50"/>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase text-white/40 mb-1 block">Subscription</label>
                            <select value={subscription} onChange={e => setSubscription(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none">
                                {SUBSCRIPTIONS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-white/40 mb-1 block">Expiry (hours): {expiryHours}h</label>
                            <input type="range" min={1} max={48} value={expiryHours} onChange={e => setExpiryHours(Number(e.target.value))}
                                className="w-full mt-2 accent-[#00E6FF]"/>
                        </div>
                    </div>
                    <button onClick={handleCreateJWT} disabled={jwtLoading}
                        className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-all">
                        {jwtLoading ? 'Creating…' : '🎫 Create JWT Token'}
                    </button>
                    {jwtToken && (
                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold uppercase text-white/40">JWT Token</label>
                                    <CopyButton text={jwtToken}/>
                                </div>
                                <textarea rows={4} readOnly value={jwtToken}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-[#00E6FF] text-xs font-mono resize-none focus:outline-none"/>
                            </div>
                            <textarea rows={14} readOnly value={jwtInfo}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white/70 text-xs font-mono resize-none focus:outline-none"/>
                        </div>
                    )}
                </motion.div>

                {/* JWT VERIFY */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                    <h2 className="font-bold text-white flex items-center gap-2">
                        <Shield size={16} className="text-green-400"/>
                        Verify Token
                    </h2>
                    <div>
                        <label className="text-xs font-bold uppercase text-white/40 mb-1 block">JWT Token to Verify</label>
                        <textarea rows={4} value={verifyInput} onChange={e => setVerifyInput(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-xs font-mono focus:outline-none focus:border-[#00E6FF]/50"/>
                    </div>
                    <button onClick={handleVerifyJWT} disabled={verifyLoading}
                        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all">
                        {verifyLoading ? 'Verifying…' : '✅ Verify Token'}
                    </button>
                    {verifyResult && (
                        <textarea rows={18} readOnly value={verifyResult}
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white/70 text-xs font-mono resize-none focus:outline-none"/>
                    )}
                </motion.div>

                {/* STREAM TOKEN */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 lg:col-span-2">
                    <h2 className="font-bold text-white flex items-center gap-2">
                        <Film size={16} className="text-[#00E6FF]"/>
                        Streaming Token + HLS Pipeline
                    </h2>
                    <div className="grid md:grid-cols-3 gap-3">
                        {[
                            { label: 'User ID', val: stUserId, set: setStUserId },
                            { label: 'Movie ID', val: stMovieId, set: setStMovieId },
                            { label: 'Movie Title', val: stTitle, set: setStTitle },
                        ].map(f => (
                            <div key={f.label}>
                                <label className="text-xs font-bold uppercase text-white/40 mb-1 block">{f.label}</label>
                                <input value={f.val} onChange={e => f.set(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00E6FF]/50"/>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleStreamToken} disabled={stLoading}
                        className="w-full py-3 bg-[#00E6FF] hover:bg-[#00c4da] text-black font-bold rounded-xl transition-all">
                        {stLoading ? 'Generating…' : '🎬 Generate Stream Token'}
                    </button>
                    {stInfo && (
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-white/40 mb-1 block">Encrypted Stream Token</label>
                                <textarea rows={3} readOnly value={stToken}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-[#00E6FF] text-xs font-mono resize-none focus:outline-none"/>
                            </div>
                            <textarea rows={3} readOnly value={stInfo.split('\n').slice(0,6).join('\n')}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white/70 text-xs font-mono resize-none focus:outline-none"/>
                            <textarea rows={10} readOnly value={stInfo.split('\n').slice(6).join('\n')}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white/70 text-xs font-mono resize-none focus:outline-none md:col-span-2"/>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    )
}
