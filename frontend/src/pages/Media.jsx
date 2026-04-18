import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Lock, Film, CheckCircle, X, Eye, EyeOff, AlertCircle, Play, Clock, Tag } from 'lucide-react'
import useStore from '../store/useStore'
import BackButton from '../components/BackButton'

// ── Company developer access code ───────────────────────────────
// Enter "Demoplayer" at the access gate to unlock developer mode.
const DEV_ACCESS_CODE = 'Demoplayer'

const GENRES = ['Action', 'Sci-Fi', 'Documentary', 'Drama', 'Adventure', 'Horror', 'Comedy', 'Animation']
const RATINGS = ['G', 'PG', 'PG-13', 'R']

// Maps upload form vr_format → {format, stereo} used by VRPlayer
const VR_FORMAT_OPTIONS = [
    { value: 'mono',       label: 'Monoscopic (Normal / 2D)',     format: 'flat',  stereo: 'mono' },
    { value: 'mono_360',   label: '360° Monoscopic (Sphere)',      format: '360',   stereo: 'mono' },
    { value: 'stereo_lr',  label: 'Side-by-Side (SBS) — 3D',      format: 'flat',  stereo: 'sbs'  },
    { value: 'stereo_lr_360', label: 'SBS 360° — 3D Sphere',       format: '360',   stereo: 'sbs'  },
    { value: 'stereo_tb',  label: 'Top-Down (TB) — 3D',           format: 'flat',  stereo: 'tb'   },
    { value: 'stereo_tb_360', label: 'Top-Down 360° — 3D Sphere',  format: '360',   stereo: 'tb'   },
    { value: 'vr180',      label: 'VR180 Dome (180°)',            format: '180',   stereo: 'mono' },
    { value: 'vr180_sbs',  label: 'VR180 SBS — 3D Dome',          format: '180',   stereo: 'sbs'  },
]
const VR_FORMAT_MAP = Object.fromEntries(VR_FORMAT_OPTIONS.map(o => [o.value, { format: o.format, stereo: o.stereo }]))




// ── Access Gate Modal ────────────────────────────────────────────
function AccessGateModal({ onClose, onUnlock }) {
    const [code, setCode] = useState('')
    const [show, setShow] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        // Simulate server verification delay
        await new Promise(r => setTimeout(r, 900))
        if (code.trim() === DEV_ACCESS_CODE) {
            onUnlock()
        } else {
            setError('Invalid access code. Contact CYMAX to obtain developer credentials.')
        }
        setLoading(false)
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 w-full max-w-md mx-6 shadow-2xl"
            >
                {/* Icon */}
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#7B61FF]/30 to-[#00E6FF]/20 border border-[#7B61FF]/30 flex items-center justify-center">
                    <Lock size={28} className="text-[#7B61FF]" />
                </div>

                <h2 className="text-xl font-black text-white text-center mb-2">Developer Access Required</h2>
                <p className="text-white/40 text-sm text-center mb-6 leading-relaxed">
                    This section is restricted to authorized CYMAX developers only.
                    Contact <span className="text-[#00E6FF]">admin@cymax.tech</span> to request credentials.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type={show ? 'text' : 'password'}
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder="Enter developer access code"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm font-mono focus:outline-none focus:border-[#7B61FF]/60 pr-12"
                            autoFocus
                        />
                        <button type="button" onClick={() => setShow(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                            {show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl p-3">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading || !code.trim()}
                        className="w-full py-3 bg-[#7B61FF] hover:bg-[#6a52e0] text-white font-bold rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                        {loading ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
                        ) : (
                            <><Lock size={14} /> Unlock Developer Portal</>
                        )}
                    </button>

                    <button type="button" onClick={onClose}
                        className="w-full py-3 text-white/40 text-sm hover:text-white/60 transition-colors">
                        Cancel
                    </button>
                </form>
            </motion.div>
        </motion.div>
    )
}

// ── Cloud Storage helpers ───────────────────────────────────────
function formatBytes(b) {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

// ── Upload Form (Developer only) ─────────────────────────────────
function UploadPanel({ onLogout }) {
    const [form, setForm] = useState({
        title: '', description: '', duration: '', genre: 'Sci-Fi',
        rating: 'PG', vr_format: 'mono', is_360: true,
        required_subscription: 'basic',
    })
    const [file, setFile]                   = useState(null)
    const [thumbFile, setThumbFile]         = useState(null)
    const [uploading, setUploading]         = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [result, setResult]               = useState(null)
    const [cloudFiles, setCloudFiles]       = useState(() => {
        try { return JSON.parse(localStorage.getItem('cymax_cloud_files') || '[]') } catch { return [] }
    })
    const [dragOver, setDragOver]           = useState(false)
    const [activeTab, setActiveTab]         = useState('upload') // 'upload' | 'cloud'
    const [thumbBase64, setThumbBase64]     = useState(null)   // base64 data URL of poster image
    const [thumbDragOver, setThumbDragOver] = useState(false)
    const fileRef  = useRef(null)
    const thumbRef = useRef(null)

    // Convert image file → base64 data URL
    const readImageAsBase64 = (imgFile) => {
        if (!imgFile || !imgFile.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = (e) => setThumbBase64(e.target.result)
        reader.readAsDataURL(imgFile)
    }

    const handleThumbDrop = (e) => {
        e.preventDefault()
        setThumbDragOver(false)
        readImageAsBase64(e.dataTransfer.files[0])
    }

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const saveCloud = (files) => {
        localStorage.setItem('cymax_cloud_files', JSON.stringify(files))
        setCloudFiles(files)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        const dropped = e.dataTransfer.files[0]
        if (dropped && dropped.type.startsWith('video/')) setFile(dropped)
    }

    // Session-level video blob URL registry (videos are too large for localStorage)
    if (!window.__vrVideoBlobs) window.__vrVideoBlobs = {}


    const handleUpload = async (e) => {
        e.preventDefault()
        if (!form.title || !form.duration) { setResult({ error: 'Title and duration are required.' }); return }
        setUploading(true)
        setUploadProgress(0)
        setResult(null)

        // Simulate AES-256 encryption + upload stages
        // Use a LOCAL variable — reading React state inside a while() is a stale closure bug
        const stages = [
            { end: 40  },
            { end: 75  },
            { end: 90  },
            { end: 100 },
        ]
        let current = 0
        for (const stage of stages) {
            while (current < stage.end) {
                await new Promise(r => setTimeout(r, 100))
                current = Math.min(current + Math.random() * 5 + 3, stage.end)
                setUploadProgress(current)
            }
        }

        try {
            // Real backend call
            const apiMod = await import('../api/axios')
            const api = apiMod.default
            await api.post('/movies/', {
                title: form.title,
                description: form.description,
                duration_minutes: parseInt(form.duration),
                genre: form.genre,
                rating: form.rating,
                vr_format: form.vr_format,
                is_360_video: form.is_360,
                required_subscription: form.required_subscription,
                thumbnail_url: form.thumbnail_url || null,
            })
        } catch { /* ok - also saved to cloud storage below */ }

        // Generate entry ID first so we can register the blob URL before saving
        const entryId = Date.now().toString(36)

        // Create a blob URL for the local video so the player can play it this session
        // Also revoke previous blob for same entry if it somehow existed
        if (file) {
            const blobUrl = URL.createObjectURL(file)
            window.__vrVideoBlobs[entryId] = blobUrl
        }

        // Save to cloud storage list (persisted in localStorage)
        const vrMapping = VR_FORMAT_MAP[form.vr_format] || { format: 'flat', stereo: 'mono' }
        const entry = {
            id:            entryId,
            title:         form.title,
            description:   form.description,
            genre:         form.genre,
            rating:        form.rating,
            vr_format:     form.vr_format,
            format:        vrMapping.format,   // 'flat' | '360' | '180'
            stereo:        vrMapping.stereo,   // 'mono' | 'sbs' | 'tb'
            is_360:        vrMapping.format !== 'flat',
            tier:          form.required_subscription,
            size:          file?.size || 0,
            name:          file?.name || `${form.title}.mp4`,
            thumb:         thumbBase64 || null,
            hasLocalVideo: !!file,
            uploadedAt:    new Date().toISOString(),
        }
        const updated = [entry, ...cloudFiles]
        saveCloud(updated)

        // Auto-select the newly uploaded video — VRPlayer will load it when navigating
        localStorage.setItem('cymax_selected_video', entryId)

        setResult({ success: true, movie: { title: form.title }, vrFormat: form.vr_format })
        setForm({ title: '', description: '', duration: '', genre: 'Sci-Fi', rating: 'PG', vr_format: 'mono', is_360: true, required_subscription: 'basic' })
        setFile(null)
        setThumbBase64(null)
        setUploading(false)
        setActiveTab('cloud')
    }

    const deleteCloud = (id) => saveCloud(cloudFiles.filter(f => f.id !== id))

    const inputCls = "w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#7B61FF]/60 placeholder-white/25"
    const labelCls = "text-xs font-bold uppercase tracking-widest text-white/40 mb-1.5 block"

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Dev Badge + tabs */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-green-400">Developer Session Active</span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Tab switcher */}
                    <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                        {[['upload', '⬆ Upload'], ['cloud', `☁ Cloud (${cloudFiles.length})`]].map(([id, label]) => (
                            <button key={id} onClick={() => setActiveTab(id)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    activeTab === id ? 'bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-black' : 'text-white/40 hover:text-white/70'
                                }`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <button onClick={onLogout} className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
                        <Lock size={11}/> Lock
                    </button>
                </div>
            </div>

            {/* ── Upload Tab ── */}
            {activeTab === 'upload' && (
                <form onSubmit={handleUpload} className="grid md:grid-cols-2 gap-6">

                    {/* Left Column */}
                    <div className="space-y-4">
                        <div>
                            <label className={labelCls}>Movie Title *</label>
                            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Interstellar VR" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Description</label>
                            <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short synopsis…" className={inputCls + ' resize-none'} />
                        </div>
                        <div>
                            <label className={labelCls}>Duration (minutes) *</label>
                            <input type="number" value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="e.g. 120" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Poster Image</label>
                            {/* Image pick zone with preview */}
                            <div
                                onDrop={handleThumbDrop}
                                onDragOver={e => { e.preventDefault(); setThumbDragOver(true) }}
                                onDragLeave={() => setThumbDragOver(false)}
                                onClick={() => thumbRef.current?.click()}
                                className={`relative rounded-xl cursor-pointer overflow-hidden border-2 border-dashed transition-all ${
                                    thumbDragOver ? 'border-[#00E6FF]/60 bg-[#00E6FF]/5' : 'border-white/15 hover:border-[#00E6FF]/40'
                                }`}
                                style={{ height: '110px' }}
                            >
                                <input
                                    ref={thumbRef}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={e => readImageAsBase64(e.target.files[0])}
                                />
                                {thumbBase64 ? (
                                    <>
                                        <img src={thumbBase64} alt="poster" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <span className="text-white text-xs font-bold">Click to change</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25">
                                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <polyline points="21 15 16 10 5 21"/>
                                        </svg>
                                        <p className="text-white/40 text-xs">Drop image or click to upload</p>
                                        <p className="text-white/20 text-[10px]">JPG, PNG, WEBP</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Genre</label>
                                <select value={form.genre} onChange={e => set('genre', e.target.value)} className={inputCls + ' cursor-pointer'}>
                                    {GENRES.map(g => <option key={g}>{g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Rating</label>
                                <select value={form.rating} onChange={e => set('rating', e.target.value)} className={inputCls + ' cursor-pointer'}>
                                    {RATINGS.map(r => <option key={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>VR Format / Layout *</label>
                                <select value={form.vr_format} onChange={e => set('vr_format', e.target.value)} className={inputCls + ' cursor-pointer'}>
                                    {VR_FORMAT_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <p className="text-white/20 text-[10px] mt-1 font-mono">
                                    {VR_FORMAT_MAP[form.vr_format]?.stereo !== 'mono'
                                        ? `▶ Will play as ${VR_FORMAT_OPTIONS.find(o=>o.value===form.vr_format)?.label}`
                                        : 'Standard playback'}
                                </p>
                            </div>
                            <div>
                                <label className={labelCls}>Access Tier</label>
                                <select value={form.required_subscription} onChange={e => set('required_subscription', e.target.value)} className={inputCls + ' cursor-pointer'}>
                                    <option value="free">Free</option>
                                    <option value="basic">Basic</option>
                                    <option value="premium">Premium</option>
                                </select>
                            </div>
                        </div>

                        {/* Format info banner — replaces the old 360 toggle */}
                        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
                            <div className="w-8 h-8 rounded-lg bg-[#7B61FF]/20 border border-[#7B61FF]/30 flex items-center justify-center shrink-0">
                                <span className="text-sm">
                                    {VR_FORMAT_MAP[form.vr_format]?.format === '360' ? '🌐'
                                    : VR_FORMAT_MAP[form.vr_format]?.format === '180' ? '👁'
                                    : '📺'}
                                </span>
                            </div>
                            <div>
                                <p className="text-white text-xs font-bold">
                                    {VR_FORMAT_OPTIONS.find(o => o.value === form.vr_format)?.label || 'Standard'}
                                </p>
                                <p className="text-white/30 text-[10px]">
                                    Format: <span className="text-[#00E6FF]">{VR_FORMAT_MAP[form.vr_format]?.format?.toUpperCase() || 'FLAT'}</span>
                                    {' · '}Stereo: <span className="text-[#7B61FF]">{VR_FORMAT_MAP[form.vr_format]?.stereo?.toUpperCase() || 'MONO'}</span>
                                </p>
                            </div>
                        </div>

                        {/* Drag-and-drop video file zone */}
                        <div
                            onDrop={handleDrop}
                            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onClick={() => fileRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all group ${
                                dragOver ? 'border-[#7B61FF]/70 bg-[#7B61FF]/8' : 'border-white/15 hover:border-[#7B61FF]/50'
                            }`}
                        >
                            <input ref={fileRef} type="file" accept="video/*" hidden onChange={e => setFile(e.target.files[0])} />
                            <Upload size={20} className="mx-auto mb-2 text-white/30 group-hover:text-[#7B61FF] transition-colors" />
                            {file ? (
                                <>
                                    <p className="text-sm text-[#00E6FF] font-mono">{file.name}</p>
                                    <p className="text-white/30 text-xs mt-1">{formatBytes(file.size)}</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-white/50 text-sm">Drag video here or click to browse</p>
                                    <p className="text-white/25 text-xs mt-1">MP4, MKV, MOV — AES-256 encrypted on upload</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Progress & Submit */}
                    <div className="md:col-span-2 space-y-4">
                        {uploading && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-white/50">
                                    <span className="font-mono">
                                        {uploadProgress < 40 ? '⬆ Uploading to cloud…' : uploadProgress < 75 ? '🔐 Encrypting AES-256-CBC…' : uploadProgress < 90 ? '📦 Packaging HLS…' : '✅ Finalizing…'}
                                    </span>
                                    <span>{Math.round(uploadProgress)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.3 }}
                                        className="h-full rounded-full bg-gradient-to-r from-[#7B61FF] to-[#00E6FF]" />
                                </div>
                            </div>
                        )}

                        {result && (
                            <div className={`flex items-start gap-3 rounded-xl p-4 border text-sm ${
                                result.success ? 'border-green-400/30 bg-green-400/10 text-green-400' : 'border-red-400/30 bg-red-400/10 text-red-400'
                            }`}>
                                {result.success ? <CheckCircle size={16} className="shrink-0 mt-0.5"/> : <AlertCircle size={16} className="shrink-0 mt-0.5"/>}
                                <div className="flex-1">
                                    {result.success ? (
                                        <>
                                            <strong>&quot;{result.movie?.title}&quot;</strong> uploaded!{' '}
                                            <span className="opacity-60 text-xs">[{VR_FORMAT_OPTIONS.find(o=>o.value===result.vrFormat)?.label || 'Standard'}]</span>
                                            <div className="mt-2">
                                                <button type="button" onClick={() => { window.location.href = '/vr-player' }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-400/20 border border-green-400/30 rounded-lg text-green-300 text-xs font-bold hover:bg-green-400/30 transition-all">
                                                    <Play size={11} /> Play Now in VR Player
                                                </button>
                                            </div>
                                        </>
                                    ) : result.error}
                                </div>
                            </div>
                        )}

                        <button type="submit" disabled={uploading}
                            className="w-full py-4 bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-black font-black rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2 text-sm uppercase tracking-widest">
                            <Upload size={16} />
                            {uploading ? 'Processing…' : 'Upload to Cloud & Encrypt'}
                        </button>
                    </div>
                </form>
            )}

            {/* ── Cloud Storage Tab ── */}
            {activeTab === 'cloud' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/30 text-xs uppercase tracking-widest font-bold">Cloud Storage</p>
                            <p className="text-white font-black mt-0.5">{cloudFiles.length} file{cloudFiles.length !== 1 ? 's' : ''} · {formatBytes(cloudFiles.reduce((a, f) => a + (f.size || 0), 0))} used</p>
                        </div>
                        <button onClick={() => setActiveTab('upload')}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-black text-xs font-black">
                            <Upload size={12} /> Upload New
                        </button>
                    </div>

                    {/* Storage bar */}
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex justify-between text-xs text-white/40 mb-2">
                            <span>{cloudFiles.length} videos stored</span>
                            <span>AES-256 encrypted · HLS segments</span>
                        </div>
                        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: cloudFiles.length > 0 ? `${Math.min(cloudFiles.length * 8, 90)}%` : '0%' }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="h-full rounded-full bg-gradient-to-r from-[#7B61FF] to-[#00E6FF]"
                            />
                        </div>
                    </div>

                    {cloudFiles.length === 0 ? (
                        <div className="py-12 text-center">
                            <Film size={28} className="text-white/15 mx-auto mb-3" />
                            <p className="text-white/30 text-sm font-bold">No files uploaded yet</p>
                            <p className="text-white/15 text-xs mt-1">Switch to the Upload tab to add content</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-3">
                            <AnimatePresence>
                                {cloudFiles.map((f, i) => (
                                    <motion.div
                                        key={f.id}
                                        initial={{ opacity: 0, scale: 0.96 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.92 }}
                                        transition={{ delay: i * 0.04 }}
                                        className="flex items-center gap-4 bg-white/[0.03] border border-white/8 rounded-2xl p-4 hover:bg-white/[0.05] transition-all group"
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white/5 border border-white/8 flex items-center justify-center">
                                            {f.thumb ? (
                                                <img src={f.thumb} alt={f.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <Film size={18} className="text-white/20" />
                                            )}
                                        </div>

                                        {/* Meta */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold text-sm truncate">{f.title}</p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[9px] text-[#00E6FF] border border-[#00E6FF]/25 px-1.5 py-0.5 rounded-sm uppercase">{f.rating}</span>
                                                <span className="text-[9px] text-white/35">{f.genre}</span>
                                                {f.is_360 && <span className="text-[9px] text-[#7B61FF] border border-[#7B61FF]/20 px-1.5 py-0.5 rounded-sm uppercase">360°</span>}
                                                <span className="text-[9px] text-white/25 font-mono">{formatBytes(f.size)}</span>
                                            </div>
                                            <p className="text-white/20 text-[10px] font-mono mt-0.5">{new Date(f.uploadedAt).toLocaleDateString()}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[9px] px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 font-bold uppercase">{f.tier}</span>
                                            <button onClick={() => deleteCloud(f.id)}
                                                className="text-[9px] px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-bold hover:bg-red-500/20 transition-all">
                                                Delete
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
    )
}

// ── Main Media Page ──────────────────────────────────────────────
export default function Media() {
    const navigate = useNavigate()
    const { movies } = useStore()
    const [devUnlocked, setDevUnlocked] = useState(false)
    const [showGate, setShowGate] = useState(false)
    const [cloudMovies, setCloudMovies] = useState(() => {
        try { return JSON.parse(localStorage.getItem('cymax_cloud_files') || '[]') } catch { return [] }
    })

    // Sync cloud storage whenever it changes (same tab or cross-tab)
    useEffect(() => {
        const sync = () => {
            try { setCloudMovies(JSON.parse(localStorage.getItem('cymax_cloud_files') || '[]')) } catch {}
        }
        window.addEventListener('storage', sync)
        const t = setInterval(sync, 1500)
        return () => { window.removeEventListener('storage', sync); clearInterval(t) }
    }, [])

    // Helper: can this cloud entry actually be played right now?
    const canPlay = (f) => !!window.__vrVideoBlobs?.[f.id]

    // Navigate to VR player with the selected video
    const playVideo = (movie) => {
        if (movie.isCloud) {
            // Store the raw entry ID (without 'cloud_' prefix) so VRPlayer can find it
            const rawId = String(movie.id).replace('cloud_', '')
            localStorage.setItem('cymax_selected_video', rawId)
        } else {
            localStorage.removeItem('cymax_selected_video')
        }
        navigate('/vr-player')
    }

    // Cloud-uploaded videos first (newest first), then API catalog
    const allMovies = [
        ...cloudMovies.map(f => ({
            id:            `cloud_${f.id}`,
            _rawId:        f.id,
            title:         f.title,
            genre:         f.genre,
            rating:        f.rating,
            duration:      null,
            status:        canPlay(f) ? 'Ready' : 'Offline',
            thumb:         f.thumb || null,
            thumbnail_url: f.thumb || null,
            is_360:        f.is_360,
            tier:          f.tier,
            isCloud:       true,
            playable:      canPlay(f),
        })),
        ...(movies || []).map(m => ({ ...m, isCloud: false, playable: true })),
    ]

    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">
            <div className="max-w-7xl mx-auto mb-6">
                <BackButton />
            </div>

            {/* Access Gate Modal */}
            <AnimatePresence>
                {showGate && (
                    <AccessGateModal
                        onClose={() => setShowGate(false)}
                        onUnlock={() => { setDevUnlocked(true); setShowGate(false) }}
                    />
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                            Media <span className="text-[#00E6FF]">Vault</span>
                        </h1>
                        <p className="text-white/40 text-sm uppercase tracking-widest">Content Catalog · VR Cinema Library</p>
                    </div>

                    {/* Dev Access Button */}
                    {!devUnlocked ? (
                        <button
                            onClick={() => setShowGate(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/50 text-xs font-bold uppercase tracking-widest hover:border-white/20 hover:text-white/70 transition-all"
                        >
                            <Lock size={13} />
                            Developer Portal
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-400/10 border border-green-400/20 rounded-xl">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-green-400 text-xs font-bold uppercase tracking-widest">Dev Access Active</span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── VIEWER SECTION: Movie Catalog ─────────────────────── */}
            <section className="mb-14">
                <h2 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-6 flex items-center gap-3">
                    <div className="w-1 h-4 bg-[#00E6FF] rounded-full shadow-[0_0_8px_rgba(0,230,255,0.8)]" />
                    Available Experiences · {allMovies.length} Titles
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {allMovies.map((movie, i) => (
                        <motion.div
                            key={movie.id || i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => playVideo(movie)}
                            className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-[#7B61FF]/40 transition-all bg-[#0a0a0a] cursor-pointer"
                        >
                            {/* NEW badge for cloud videos */}
                            {movie.isCloud && (
                                <div className="absolute top-2 left-2 z-10">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#7B61FF]/80 text-white border border-[#7B61FF]">
                                        ☁ Uploaded
                                    </span>
                                </div>
                            )}

                            {/* Thumbnail */}
                            <div className="aspect-[3/4] relative">
                                {movie.thumb || movie.thumbnail_url ? (
                                    <img src={movie.thumb || movie.thumbnail_url} alt={movie.title}
                                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-[#7B61FF]/20 to-[#00E6FF]/10 flex items-center justify-center">
                                        <Film size={28} className="text-white/20" />
                                    </div>
                                )}

                                {/* Play overlay — always visible for playable, dimmed for offline */}
                                <div className={`absolute inset-0 flex items-center justify-center transition-all bg-black/30 ${
                                    movie.playable ? 'opacity-0 group-hover:opacity-100' : 'opacity-60'
                                }`}>
                                    <div className={`w-12 h-12 rounded-full backdrop-blur-sm flex flex-col items-center justify-center gap-0.5 border ${
                                        movie.playable
                                            ? 'bg-gradient-to-br from-[#7B61FF] to-[#00E6FF] border-white/20 shadow-[0_0_24px_rgba(123,97,255,0.7)]'
                                            : 'bg-white/10 border-white/10'
                                    }`}>
                                        <Play size={18} className="text-white ml-0.5" fill="white" />
                                        {!movie.playable && (
                                            <span className="text-[7px] text-white/60 font-bold">OFFLINE</span>
                                        )}
                                    </div>
                                </div>

                                {/* Status badge */}
                                <div className="absolute top-2 right-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                        movie.status === 'Ready'
                                            ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                                            : movie.status === 'Offline'
                                            ? 'bg-orange-400/20 text-orange-400 border border-orange-400/30'
                                            : 'bg-blue-400/20 text-blue-400 border border-blue-400/30'
                                    }`}>
                                        {movie.status || 'Live'}
                                    </span>
                                </div>

                                {/* 360 badge */}
                                {movie.is_360 && (
                                    <div className="absolute bottom-2 left-2">
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#00E6FF]/20 text-[#00E6FF] border border-[#00E6FF]/30">360°</span>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-3">
                                <h3 className="text-white font-bold text-xs uppercase tracking-wide truncate">{movie.title}</h3>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <span className="text-[9px] text-[#00E6FF] border border-[#00E6FF]/25 px-1.5 py-0.5 rounded-sm uppercase">{movie.rating}</span>
                                    {movie.duration && <span className="text-[9px] text-white/40 flex items-center gap-0.5"><Clock size={8}/>{movie.duration}m</span>}
                                    {movie.genre && <span className="text-[9px] text-white/30 flex items-center gap-0.5"><Tag size={8}/>{movie.genre}</span>}
                                </div>
                                {/* Click-to-play hint */}
                                <p className="text-[8px] text-white/20 mt-1.5 font-mono">
                                    {movie.playable ? '▶ Click to play in VR Player' : '⚠ Re-upload to play'}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── DEVELOPER SECTION ────────────────────────────────── */}
            <section>
                <div className={`rounded-3xl border transition-all duration-500 overflow-hidden
                    ${devUnlocked
                        ? 'border-[#7B61FF]/30 bg-[#7B61FF]/5'
                        : 'border-white/5 bg-white/[0.02]'}`}
                >
                    {/* Section header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border
                                ${devUnlocked ? 'bg-[#7B61FF]/20 border-[#7B61FF]/30' : 'bg-white/5 border-white/10'}`}>
                                {devUnlocked ? <Upload size={16} className="text-[#7B61FF]" /> : <Lock size={16} className="text-white/30" />}
                            </div>
                            <div>
                                <h2 className={`font-bold text-sm uppercase tracking-widest ${devUnlocked ? 'text-[#7B61FF]' : 'text-white/30'}`}>
                                    Developer Upload Portal
                                </h2>
                                <p className="text-white/30 text-xs">
                                    {devUnlocked ? 'Add new content to the VR Cinema catalog' : 'Restricted — requires company-issued developer credentials'}
                                </p>
                            </div>
                        </div>

                        {!devUnlocked && (
                            <button onClick={() => setShowGate(true)}
                                className="text-xs px-4 py-2 border border-white/10 rounded-xl text-white/40 hover:text-white/70 hover:border-white/20 transition-all flex items-center gap-1.5">
                                <Lock size={11} /> Request Access
                            </button>
                        )}
                    </div>

                    {/* Locked state for viewers */}
                    {!devUnlocked && (
                        <div className="p-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                <Lock size={32} className="text-white/15" />
                            </div>
                            <h3 className="text-white/30 font-bold text-lg mb-2">Access Restricted</h3>
                            <p className="text-white/20 text-sm max-w-md mx-auto leading-relaxed mb-6">
                                Only authorized CYMAX developers can upload and manage VR cinema content.
                                To become a certified content developer, contact our team.
                            </p>
                            <a href="mailto:admin@cymax.tech"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-full text-white/40 text-sm hover:bg-white/10 hover:text-white/60 transition-all">
                                admin@cymax.tech — Request Developer Access
                            </a>
                        </div>
                    )}

                    {/* Unlocked upload form for developers */}
                    {devUnlocked && (
                        <div className="p-6">
                            <UploadPanel onLogout={() => setDevUnlocked(false)} />
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
