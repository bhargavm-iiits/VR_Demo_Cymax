import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, RefreshCw } from 'lucide-react'

// ── Utility ──────────────────────────────────────────────────
function hexToBytes(hex) {
    if (hex.length % 2 !== 0) throw new Error('Invalid hex string')
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
    return bytes
}
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
function bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...bytes))
}
function base64ToBytes(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function generateAESKey(bits) {
    const key = await crypto.subtle.generateKey({ name: 'AES-CBC', length: bits }, true, ['encrypt', 'decrypt'])
    const raw = await crypto.subtle.exportKey('raw', key)
    return bytesToHex(new Uint8Array(raw))
}

async function aesEncrypt(plaintext, keyHex) {
    const keyBytes = hexToBytes(keyHex)
    const iv = crypto.getRandomValues(new Uint8Array(16))
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt'])
    const encoded = new TextEncoder().encode(plaintext)
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, encoded)
    const combined = new Uint8Array(16 + encrypted.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encrypted), 16)
    return bytesToBase64(combined)
}

async function aesDecrypt(combinedB64, keyHex) {
    const combined = base64ToBytes(combinedB64)
    const iv = combined.slice(0, 16)
    const ciphertext = combined.slice(16)
    const keyBytes = hexToBytes(keyHex)
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt'])
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <button onClick={copy} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/50" />}
        </button>
    )
}

function OutputBox({ label, value, mono = true, rows = 4 }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-white/50">{label}</label>
                {value && <CopyButton text={value} />}
            </div>
            <textarea
                readOnly
                rows={rows}
                value={value}
                className={`w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white/80 text-xs resize-none focus:outline-none ${mono ? 'font-mono' : ''}`}
            />
        </div>
    )
}

export default function Encryption() {
    // Key generation
    const [keyBits, setKeyBits] = useState(256)
    const [generatedKey, setGeneratedKey] = useState('')
    const [keyInfo, setKeyInfo] = useState('')
    const [genLoading, setGenLoading] = useState(false)

    // Encrypt
    const [plaintext, setPlaintext] = useState('{"movie_id": 42, "token": "vr-access"}')
    const [encKey, setEncKey] = useState('')
    const [encOutput, setEncOutput] = useState('')
    const [encInfo, setEncInfo] = useState('')
    const [encLoading, setEncLoading] = useState(false)

    // Decrypt
    const [decInput, setDecInput] = useState('')
    const [decKey, setDecKey] = useState('')
    const [decOutput, setDecOutput] = useState('')
    const [decInfo, setDecInfo] = useState('')
    const [decLoading, setDecLoading] = useState(false)

    const handleGenKey = async () => {
        setGenLoading(true)
        try {
            const hex = await generateAESKey(keyBits)
            setGeneratedKey(hex)
            setEncKey(hex)
            setDecKey(hex)
            setKeyInfo(`✅ AES Key Generated\n\nKey Size : ${keyBits}-bit (${keyBits / 8} bytes)\nKey (HEX): ${hex}\nKey (B64): ${btoa(String.fromCharCode(...hexToBytes(hex)))}\nAlgorithm: AES-${keyBits}-CBC\n\n⚠️  Store this key securely!`)
        } catch (e) { setKeyInfo('❌ Error: ' + e.message) }
        setGenLoading(false)
    }

    const handleEncrypt = async () => {
        if (!plaintext || !encKey) { setEncInfo('❌ Provide text and a key.'); return }
        setEncLoading(true)
        try {
            const t0 = performance.now()
            const combined = await aesEncrypt(plaintext, encKey)
            const elapsed = (performance.now() - t0).toFixed(3)
            setEncOutput(combined)
            setDecInput(combined)
            setEncInfo(`✅ AES Encryption Complete\n\nOriginal : ${plaintext}\nMode     : AES-${encKey.length * 4 / 8}-CBC\nEncrypted: (see output)\nSize     : ${plaintext.length} → ${combined.length} chars\n⚡ Time   : ${elapsed}ms\n\n💡 Usage:\n  → Video metadata in DB\n  → Stream token delivery\n  → HLS segment protection`)
        } catch (e) { setEncInfo('❌ ' + e.message + '\n\n💡 Key must be 32, 48, or 64 hex chars (128/192/256-bit)') }
        setEncLoading(false)
    }

    const handleDecrypt = async () => {
        if (!decInput || !decKey) { setDecInfo('❌ Provide encrypted data and key.'); return }
        setDecLoading(true)
        try {
            const t0 = performance.now()
            const plaintext = await aesDecrypt(decInput, decKey)
            const elapsed = (performance.now() - t0).toFixed(3)
            setDecOutput(plaintext)
            setDecInfo(`✅ AES Decryption Complete\n\nDecrypted: ${plaintext}\n⚡ Time   : ${elapsed}ms\n\n🎬 VR Cinema:\n  → Decryption in memory only\n  → Decrypted content never saved\n  → Session ends → buffer cleared`)
        } catch (e) { setDecInfo('❌ ' + e.message + '\n\n💡 Check that key and mode match encryption') }
        setDecLoading(false)
    }

    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                    AES <span className="text-[#00E6FF]">Encryption</span>
                </h1>
                <p className="text-white/50 text-sm uppercase tracking-widest">Core content protection · AES-CBC (Web Crypto API)</p>
            </motion.div>

            <div className="grid lg:grid-cols-1 gap-8 max-w-4xl">

                {/* Step 1: Generate Key */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[#00E6FF] text-black text-xs font-black flex items-center justify-center">1</span>
                        Generate AES Key
                    </h2>
                    <div className="flex gap-3 flex-wrap">
                        {[128, 192, 256].map(b => (
                            <button
                                key={b}
                                onClick={() => setKeyBits(b)}
                                className={`px-5 py-2 rounded-full text-sm font-bold border transition-all
                                    ${keyBits === b ? 'bg-[#00E6FF] border-[#00E6FF] text-black' : 'border-white/20 text-white/60 hover:border-white/40'}`}
                            >
                                {b}-bit
                            </button>
                        ))}
                        <button
                            onClick={handleGenKey}
                            disabled={genLoading}
                            className="flex items-center gap-2 px-5 py-2 bg-[#7B61FF] hover:bg-[#6a52e0] text-white font-bold rounded-full transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={genLoading ? 'animate-spin' : ''} />
                            Generate Key
                        </button>
                    </div>
                    {generatedKey && (
                        <div className="space-y-3">
                            <OutputBox label="Generated Key (HEX)" value={generatedKey} rows={2} />
                            <OutputBox label="Key Information" value={keyInfo} rows={5} mono={false} />
                        </div>
                    )}
                </motion.div>

                {/* Step 2: Encrypt */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-yellow-400 text-black text-xs font-black flex items-center justify-center">2</span>
                        Encrypt Text
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1.5 block">Text to Encrypt</label>
                                <textarea rows={3} value={plaintext} onChange={e => setPlaintext(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm font-mono focus:outline-none focus:border-[#00E6FF]/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1.5 block">Encryption Key (HEX)</label>
                                <input value={encKey} onChange={e => setEncKey(e.target.value)} placeholder="Paste key from Step 1"
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-xs font-mono focus:outline-none focus:border-[#00E6FF]/50"
                                />
                            </div>
                            <button onClick={handleEncrypt} disabled={encLoading}
                                className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-all disabled:opacity-50">
                                {encLoading ? 'Encrypting…' : '🔐 ENCRYPT'}
                            </button>
                        </div>
                        <div className="space-y-3">
                            <OutputBox label="Encrypted Output (Base64)" value={encOutput} rows={3} />
                            <OutputBox label="Encryption Details" value={encInfo} rows={7} mono={false} />
                        </div>
                    </div>
                </motion.div>

                {/* Step 3: Decrypt */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-green-400 text-black text-xs font-black flex items-center justify-center">3</span>
                        Decrypt Text
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1.5 block">Encrypted Data (Base64)</label>
                                <textarea rows={3} value={decInput} onChange={e => setDecInput(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-xs font-mono focus:outline-none focus:border-[#00E6FF]/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1.5 block">Decryption Key (HEX)</label>
                                <input value={decKey} onChange={e => setDecKey(e.target.value)} placeholder="Same key used for encryption"
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-xs font-mono focus:outline-none focus:border-[#00E6FF]/50"
                                />
                            </div>
                            <button onClick={handleDecrypt} disabled={decLoading}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all disabled:opacity-50">
                                {decLoading ? 'Decrypting…' : '🔓 DECRYPT'}
                            </button>
                        </div>
                        <div className="space-y-3">
                            <OutputBox label="Decrypted Text" value={decOutput} rows={3} />
                            <OutputBox label="Decryption Details" value={decInfo} rows={7} mono={false} />
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
