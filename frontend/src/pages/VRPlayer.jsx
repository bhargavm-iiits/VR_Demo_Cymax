import { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Play, Pause, Volume2, VolumeX,
    Maximize, Minimize, Globe, Monitor,
    ChevronLeft, ChevronRight, Loader2, Eye,
} from 'lucide-react'
import BackButton from '../components/BackButton'

/* ─────────────────────────────────────────────────────────────
   Local video catalog — uses files already in /public
──────────────────────────────────────────────────────────────*/
const VIDEOS = [
    {
        id: 1,
        title: 'Dwaraka',
        genre: '360° VR · Ancient Mysteries',
        is360: true,
        src: '/vr_video.mp4',
        poster: '/dwaraka_poster_new.png',
    },
    {
        id: 2,
        title: 'Jungle Book',
        genre: 'VR 360 Experience',
        is360: true,
        src: '/jungle_book_video.mp4',
        poster: '/jungle_book_poster.jpg',
    },
    {
        id: 3,
        title: 'Stargate',
        genre: 'Galactic Journey · Sci-Fi',
        is360: false,
        src: '/stargate_video.mp4',
        poster: '/stargate_poster.jpg',
    },
    {
        id: 4,
        title: 'Jurassic',
        genre: 'Prehistoric Encounter · Adventure',
        is360: false,
        src: '/jurassic_video.mp4',
        poster: '/jurassic_poster.jpg',
    },
    {
        id: 5,
        title: 'Lia',
        genre: 'Cyber-Romance · Drama',
        is360: false,
        src: '/lia_video.mp4',
        poster: '/lia_poster.jpg',
    },
    {
        id: 6,
        title: 'CYMAX Intro',
        genre: 'Promo · Brand Film',
        is360: false,
        src: '/cymax_intro.mp4',
        poster: '/cymax_logo_3d.png',
    },
]

/* ─────────────────────────────────────────────────────────────
   360° Video Sphere — texture applied inside useFrame so ref
   is guaranteed to be populated before we bind the map.
──────────────────────────────────────────────────────────────*/
function VideoSphere({ texture }) {
    const meshRef = useRef()
    const applied = useRef(false)

    useFrame(() => {
        if (!meshRef.current) return
        // First frame: bind the texture
        if (!applied.current && texture) {
            meshRef.current.material.map = texture
            meshRef.current.material.needsUpdate = true
            applied.current = true
        }
        if (texture) texture.needsUpdate = true
    })

    return (
        <mesh ref={meshRef} scale={[-1, 1, 1]}>
            <sphereGeometry args={[500, 60, 40]} />
            <meshBasicMaterial side={THREE.BackSide} />
        </mesh>
    )
}

/* ─────────────────────────────────────────────────────────────
   Flat Video Plane
──────────────────────────────────────────────────────────────*/
function VideoPlane({ texture }) {
    const meshRef = useRef()
    const applied = useRef(false)

    useFrame(() => {
        if (!meshRef.current) return
        if (!applied.current && texture) {
            meshRef.current.material.map = texture
            meshRef.current.material.needsUpdate = true
            applied.current = true
        }
        if (texture) texture.needsUpdate = true
    })

    return (
        <mesh ref={meshRef} position={[0, 0, -3]}>
            <planeGeometry args={[7.11, 4]} />
            <meshBasicMaterial />
        </mesh>
    )
}

/* ─────────────────────────────────────────────────────────────
   VR Canvas Scene — key forces full remount on mode change
──────────────────────────────────────────────────────────────*/
function VRScene({ texture, is360 }) {
    return (
        <Canvas
            key={is360 ? '360' : 'flat'}
            camera={is360
                ? { position: [0, 0, 0.001], fov: 75 }
                : { position: [0, 0, 1], fov: 70 }
            }
            gl={{ antialias: true }}
            style={{ position: 'absolute', inset: 0, background: '#000' }}
        >
            {is360
                ? <VideoSphere texture={texture} />
                : <VideoPlane texture={texture} />
            }
            <Stars radius={300} depth={60} count={1000} factor={7} saturation={0} fade speed={0.5} />
            {is360 && (
                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    rotateSpeed={-0.4}
                    autoRotate={false}
                />
            )}
        </Canvas>
    )
}

/* ─────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────*/
function fmt(s) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
}

function AmbientDots() {
    const dots = Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        delay: Math.random() * 5,
        dur: 5 + Math.random() * 6,
    }))
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {dots.map(d => (
                <motion.div
                    key={d.id}
                    className="absolute rounded-full bg-[#7B61FF]"
                    style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size, opacity: 0 }}
                    animate={{ opacity: [0, 0.3, 0], y: [0, -40, -80], scale: [1, 1.4, 0] }}
                    transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: 'easeOut' }}
                />
            ))}
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Main VRPlayer Page
──────────────────────────────────────────────────────────────*/
export default function VRPlayer() {
    const containerRef  = useRef(null)
    const vidRef        = useRef(null)   // raw HTMLVideoElement
    const hideTimer     = useRef(null)
    const clickTimer    = useRef(null)   // single vs double click debounce

    const [current,      setCurrent]      = useState(VIDEOS[0])
    const [texture,      setTexture]      = useState(null)
    const [playing,      setPlaying]      = useState(false)
    const [loading,      setLoading]      = useState(true)
    const [muted,        setMuted]        = useState(false)
    const [volume,       setVolume]       = useState(0.8)
    const [progress,     setProgress]     = useState(0)
    const [duration,     setDuration]     = useState(0)
    const [currentTime,  setCurrentTime]  = useState(0)
    const [is360,        setIs360]        = useState(current.is360)
    const [fullscreen,   setFullscreen]   = useState(false)
    const [showControls, setShowControls] = useState(true)
    const [cloudVideos,  setCloudVideos]  = useState([])

    /* ── Load cloud-uploaded videos into playlist ── */
    useEffect(() => {
        const load = () => {
            try {
                const stored = JSON.parse(localStorage.getItem('cymax_cloud_files') || '[]')
                const mapped = stored.map((f, idx) => ({
                    id:     `cloud_${f.id}`,
                    title:  f.title || 'Uploaded Video',
                    genre:  `${f.genre || 'VR'} · ${f.is_360 ? '360° VR' : 'Flat'} · Uploaded`,
                    is360:  !!f.is_360,
                    src:    window.__vrVideoBlobs?.[f.id] || null,   // blob URL if still in session
                    poster: f.thumb || null,                          // base64 poster image
                    isCloud: true,
                })).filter(v => v.src)   // only include if blob URL is still live this session
                setCloudVideos(mapped)
            } catch { setCloudVideos([]) }
        }
        load()
        const t = setInterval(load, 2000)
        return () => clearInterval(t)
    }, [])

    // Full playlist = local catalog + cloud-uploaded (session-active) videos
    const allVideos = [...VIDEOS, ...cloudVideos]

    /* ── Create ONE video element on mount ── */
    useEffect(() => {
        const vid = document.createElement('video')
        vid.playsInline = true
        vid.loop        = false
        vid.volume      = 0.8

        const onCanPlay  = () => setLoading(false)
        const onWaiting  = () => setLoading(true)
        const onPlay     = () => { setLoading(false); setPlaying(true) }
        const onPause    = () => setPlaying(false)
        const onEnded    = () => { setPlaying(false); setProgress(0) }
        const onTime     = () => {
            if (vid.duration) {
                setCurrentTime(vid.currentTime)
                setProgress(vid.currentTime / vid.duration)
            }
        }
        const onMeta     = () => setDuration(vid.duration)

        vid.addEventListener('canplay',         onCanPlay)
        vid.addEventListener('waiting',          onWaiting)
        vid.addEventListener('play',             onPlay)
        vid.addEventListener('pause',            onPause)
        vid.addEventListener('ended',            onEnded)
        vid.addEventListener('timeupdate',       onTime)
        vid.addEventListener('loadedmetadata',   onMeta)

        // Build VideoTexture and store it
        const tex = new THREE.VideoTexture(vid)
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.format    = THREE.RGBAFormat

        vidRef.current = vid
        setTexture(tex)

        return () => {
            vid.pause()
            vid.src = ''
            tex.dispose()
            vid.removeEventListener('canplay',        onCanPlay)
            vid.removeEventListener('waiting',         onWaiting)
            vid.removeEventListener('play',            onPlay)
            vid.removeEventListener('pause',           onPause)
            vid.removeEventListener('ended',           onEnded)
            vid.removeEventListener('timeupdate',      onTime)
            vid.removeEventListener('loadedmetadata',  onMeta)
        }
    }, [])

    /* ── Load source whenever selection changes ── */
    useEffect(() => {
        const vid = vidRef.current
        if (!vid) return
        vid.pause()
        setPlaying(false)
        setLoading(true)
        setProgress(0)
        setCurrentTime(0)
        setDuration(0)
        vid.src  = current.src
        vid.load()
        setIs360(current.is360)
    }, [current])

    /* ── Sync volume / mute ── */
    useEffect(() => {
        const vid = vidRef.current
        if (!vid) return
        vid.volume = volume
        vid.muted  = muted
    }, [volume, muted])

    /* ── Auto-hide controls ── */
    const showCtrl = useCallback(() => {
        setShowControls(true)
        clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(() => {
            if (vidRef.current && !vidRef.current.paused) setShowControls(false)
        }, 3500)
    }, [])

    /* ── Playback controls ── */
    const togglePlay = () => {
        const vid = vidRef.current
        if (!vid) return
        if (vid.paused) {
            vid.play().catch(e => console.warn('play() blocked:', e))
        } else {
            vid.pause()
        }
        showCtrl()
    }

    const seek = (e) => {
        const vid = vidRef.current
        if (!vid || !vid.duration) return
        const rect = e.currentTarget.getBoundingClientRect()
        const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        vid.currentTime = pct * vid.duration
        setProgress(pct)
        showCtrl()
    }

    const skip = (sec) => {
        const vid = vidRef.current
        if (!vid) return
        vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + sec))
        showCtrl()
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen()
            setFullscreen(true)
        } else {
            document.exitFullscreen()
            setFullscreen(false)
        }
    }

    return (
        <div className="w-full min-h-screen bg-[#050505] text-white relative overflow-hidden">

            {/* Ambient blobs */}
            <motion.div
                animate={{ scale: [1, 1.2, 1], x: [0, 40, 0] }}
                transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-[700px] h-[700px] rounded-full bg-[#7B61FF] opacity-[0.05] blur-[130px] -top-60 -left-60 pointer-events-none"
            />
            <motion.div
                animate={{ scale: [1, 1.15, 1], x: [0, -30, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
                className="absolute w-[500px] h-[500px] rounded-full bg-[#00E6FF] opacity-[0.04] blur-[110px] -bottom-40 -right-20 pointer-events-none"
            />
            <AmbientDots />

            <div className="relative z-10 px-6 lg:px-10 pt-10 pb-16">
                <div className="max-w-7xl mx-auto">

                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 flex items-center justify-between"
                    >
                        <div>
                            <BackButton />
                            <p className="text-white/35 text-xs uppercase tracking-[0.32em] font-bold mt-4 mb-1">VR Cinema</p>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
                                Immersive <span className="text-[#7B61FF]">VR</span>{' '}
                                <span className="text-[#00E6FF]">Player</span>
                            </h1>
                            <p className="text-white/35 text-xs uppercase tracking-[0.18em] mt-1">
                                Web-native 360° &amp; flat video — click play to start
                            </p>
                        </div>

                        {/* Mode badges */}
                        <div className="hidden lg:flex gap-3">
                            <span className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all ${is360 ? 'bg-[#7B61FF]/20 border-[#7B61FF]/40 text-[#7B61FF]' : 'bg-white/5 border-white/10 text-white/30'}`}>
                                <Globe size={13} /> 360°
                            </span>
                            <span className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all ${!is360 ? 'bg-[#00E6FF]/20 border-[#00E6FF]/40 text-[#00E6FF]' : 'bg-white/5 border-white/10 text-white/30'}`}>
                                <Monitor size={13} /> Flat
                            </span>
                        </div>
                    </motion.div>

                    {/* Main layout */}
                    <div className="grid xl:grid-cols-[1fr_320px] gap-6">

                        {/* ── Player ── */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <div
                                ref={containerRef}
                                className="relative w-full rounded-[28px] overflow-hidden border border-white/10 bg-black"
                                style={{ aspectRatio: '16/9' }}
                                onMouseMove={showCtrl}
                                onDoubleClick={(e) => {
                                    // Double-click: cancel pending single-click, then pause only
                                    e.preventDefault()
                                    clearTimeout(clickTimer.current)
                                    const vid = vidRef.current
                                    if (vid && !vid.paused) { vid.pause(); showCtrl() }
                                }}
                                onClick={() => {
                                    // Debounce 160ms so double-click doesn't fire togglePlay twice
                                    clearTimeout(clickTimer.current)
                                    clickTimer.current = setTimeout(() => togglePlay(), 160)
                                }}
                            >
                                {/* Three.js canvas */}
                                {texture && (
                                    <VRScene texture={texture} is360={is360} />
                                )}

                                {/* Buffering spinner */}
                                <AnimatePresence>
                                    {loading && (
                                        <motion.div
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10 gap-3"
                                        >
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                                <Loader2 size={44} className="text-[#7B61FF]" />
                                            </motion.div>
                                            <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Buffering…</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Big centered play icon when paused */}
                                <AnimatePresence>
                                    {!playing && !loading && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.7 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.7 }}
                                            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                                        >
                                            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-[0_0_40px_rgba(123,97,255,0.6)]">
                                                <Play size={34} className="text-white ml-1" fill="white" />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Controls bar */}
                                <AnimatePresence>
                                    {showControls && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 16 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-5 pt-20 bg-gradient-to-t from-black/95 via-black/50 to-transparent"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {/* Title */}
                                            <p className="text-white font-black text-base mb-3 tracking-tight">
                                                {current.title}
                                                <span className="ml-3 text-xs font-bold text-[#00E6FF] uppercase">{current.genre}</span>
                                            </p>

                                            {/* Seek bar */}
                                            <div
                                                className="relative h-1.5 w-full bg-white/15 rounded-full cursor-pointer mb-4 group"
                                                onClick={seek}
                                            >
                                                <div
                                                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] rounded-full"
                                                    style={{ width: `${progress * 100}%` }}
                                                />
                                                <div
                                                    className="absolute -top-1.5 h-4 w-4 rounded-full bg-white shadow-[0_0_10px_rgba(123,97,255,0.9)] opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style={{ left: `calc(${progress * 100}% - 8px)` }}
                                                />
                                            </div>

                                            {/* Button row */}
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => skip(-10)} className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all" title="-10s">
                                                        <ChevronLeft size={20} />
                                                    </button>

                                                    {/* Play / Pause */}
                                                    <button
                                                        id="vr-play-btn"
                                                        onClick={togglePlay}
                                                        className="w-11 h-11 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#00E6FF] flex items-center justify-center shadow-[0_0_24px_rgba(123,97,255,0.6)] hover:scale-110 transition-transform"
                                                    >
                                                        {playing
                                                            ? <Pause size={18} fill="white" className="text-white" />
                                                            : <Play  size={18} fill="white" className="text-white ml-0.5" />
                                                        }
                                                    </button>

                                                    <button onClick={() => skip(10)} className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all" title="+10s">
                                                        <ChevronRight size={20} />
                                                    </button>

                                                    <span className="text-white/45 text-xs font-mono ml-1 tabular-nums">
                                                        {fmt(currentTime)} / {fmt(duration)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Volume */}
                                                    <button onClick={() => setMuted(m => !m)} className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all">
                                                        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                                    </button>
                                                    <input
                                                        type="range" min="0" max="1" step="0.01"
                                                        value={muted ? 0 : volume}
                                                        onChange={e => { setVolume(+e.target.value); setMuted(false) }}
                                                        className="w-20 cursor-pointer"
                                                    />

                                                    {/* 360 / Flat toggle */}
                                                    <button
                                                        onClick={() => setIs360(v => !v)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${is360 ? 'bg-[#7B61FF]/20 border-[#7B61FF]/40 text-[#7B61FF]' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                                                        title="Toggle 360° / Flat"
                                                    >
                                                        {is360 ? <Globe size={14} /> : <Monitor size={14} />}
                                                    </button>

                                                    {/* Fullscreen */}
                                                    <button onClick={toggleFullscreen} className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-all">
                                                        {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Top-left mode badge */}
                                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-sm text-xs font-bold text-white/70 pointer-events-none">
                                    {is360
                                        ? <><Globe size={12} className="text-[#7B61FF]" /> 360° Sphere</>
                                        : <><Monitor size={12} className="text-[#00E6FF]" /> Flat Screen</>
                                    }
                                </div>

                                {/* Top-right secure badge */}
                                <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/25 text-xs text-green-400 font-bold pointer-events-none">
                                    🔒 Secure
                                </div>
                            </div>

                            {/* Tips row */}
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.35 }}
                                className="mt-4 flex flex-wrap gap-4"
                            >
                                {[
                                    { icon: <Eye size={12} />, text: is360 ? 'Click & drag to look around in 360°' : 'Flat cinematic view' },
                                    { icon: <Globe size={12} />, text: 'Toggle 360° ↔ Flat with the mode button' },
                                    { icon: <Maximize size={12} />, text: 'Go fullscreen for the best experience' },
                                ].map((tip, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-white/25 text-xs">
                                        <span className="text-[#7B61FF]">{tip.icon}</span>
                                        {tip.text}
                                    </div>
                                ))}
                            </motion.div>
                        </motion.div>

                        {/* ── Sidebar ── */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-col gap-4"
                        >
                            {/* Now playing card */}
                            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(123,97,255,0.12),rgba(0,230,255,0.05))] backdrop-blur-xl p-6">
                                <p className="text-white/35 text-xs uppercase tracking-[0.28em] font-bold mb-1">Now Playing</p>
                                <h2 className="text-xl font-black uppercase tracking-tight mb-0.5">{current.title}</h2>
                                <p className="text-[#00E6FF] text-xs font-bold uppercase tracking-widest mb-4">{current.genre}</p>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Format',   value: current.is360 ? '360° VR Sphere' : 'Flat Cinematic' },
                                        { label: 'Renderer', value: 'Three.js WebGL' },
                                        { label: 'Source',   value: 'Local / Encrypted' },
                                        { label: 'Mode',     value: is360 ? '360° Active' : 'Flat Active' },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex justify-between text-xs">
                                            <span className="text-white/35">{label}</span>
                                            <span className="text-white font-bold">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Playlist */}
                            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-white/8">
                                    <p className="text-white/35 text-xs uppercase tracking-[0.28em] font-bold">Playlist</p>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {allVideos.map((v, idx) => (
                                        <motion.button
                                            key={v.id}
                                            onClick={() => setCurrent(v)}
                                            whileHover={{ x: 4 }}
                                            className={`w-full text-left px-5 py-4 transition-all flex items-center gap-3 ${current.id === v.id ? 'bg-[#7B61FF]/10' : 'hover:bg-white/[0.03]'}`}
                                        >
                                            {/* Poster thumbnail */}
                                            {v.poster ? (
                                                <img src={v.poster} alt={v.title} className="w-9 h-9 rounded-lg object-cover shrink-0 opacity-80" />
                                            ) : (
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${current.id === v.id ? 'bg-gradient-to-br from-[#7B61FF] to-[#00E6FF] text-black' : 'bg-white/5 text-white/30'}`}>
                                                    {idx + 1}
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-bold truncate ${current.id === v.id ? 'text-white' : 'text-white/65'}`}>
                                                    {v.title}
                                                </p>
                                                <p className="text-[10px] uppercase tracking-widest text-white/25 font-bold truncate">
                                                    {v.genre}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {v.isCloud && <span className="text-[9px] text-[#7B61FF] font-black">☁</span>}
                                                {v.is360 && <Globe size={11} className="text-[#7B61FF]" />}
                                                {current.id === v.id && playing && (
                                                    <motion.div
                                                        animate={{ scale: [1, 1.4, 1] }}
                                                        transition={{ repeat: Infinity, duration: 0.7 }}
                                                        className="w-2 h-2 rounded-full bg-[#00E6FF]"
                                                    />
                                                )}
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    )
}
