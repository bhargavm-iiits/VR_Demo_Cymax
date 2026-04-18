import { useEffect, useMemo, useRef, useState, Suspense, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, X, Crown, Search, Film, Subtitles, ChevronDown, Globe } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScrollControls, Scroll, useScroll, Image } from '@react-three/drei'
import useStore from '../store/useStore'
import { authAPI } from '../api/axios'
import ProfileDropdown from '../components/ProfileDropdown'
import BackButton from '../components/BackButton'
import { getSubtitlesForMovie, getAvailableLanguages, getCurrentCue } from '../data/subtitleData'
import { trackEvent } from '../data/analyticsStore'

function StarField() {
    const ref = useRef()
    const count = 900
    const positions = useRef(() => {
        const arr = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 40
            arr[i * 3 + 1] = (Math.random() - 0.5) * 40
            arr[i * 3 + 2] = (Math.random() - 0.5) * 40
        }
        return arr
    })

    useFrame((state) => {
        if (!ref.current) return
        ref.current.rotation.y = state.clock.elapsedTime * 0.02
        ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1
        ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, state.pointer.x * 0.4, 0.05)
        ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, state.pointer.y * 0.4, 0.05)
    })

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions.current()} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.04} color="#00E6FF" sizeAttenuation transparent opacity={0.55} />
        </points>
    )
}

function GlowOrbs() {
    const meshes = useRef([])
    const colors = ['#7B61FF', '#00E6FF', '#ff3366', '#fbbf24']
    const orbData = colors.map((color, index) => ({
        color,
        pos: [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, -8 - index * 2],
        speed: 0.3 + index * 0.15,
        amp: 1.2 + index * 0.5,
    }))

    useFrame((state) => {
        orbData.forEach((orb, index) => {
            const mesh = meshes.current[index]
            if (!mesh) return
            mesh.position.y = orb.pos[1] + Math.sin(state.clock.elapsedTime * orb.speed + index) * orb.amp
            mesh.position.x = orb.pos[0] + Math.cos(state.clock.elapsedTime * orb.speed * 0.7 + index) * (orb.amp * 0.6)
        })
    })

    return (
        <>
            {orbData.map((orb, index) => (
                <mesh key={index} ref={(el) => { meshes.current[index] = el }} position={orb.pos}>
                    <sphereGeometry args={[1.8, 16, 16]} />
                    <meshBasicMaterial color={orb.color} transparent opacity={0.04} />
                </mesh>
            ))}
        </>
    )
}

const catalog = [
    { id: 'dwaraka', title: 'DWARAKA', subtitle: 'The Submerged City', brief: 'Dive deep into the legendary city of Dwaraka. Experience breathtaking underwater vistas and discover the mythical lost empire in full 360 VR.', img: '/dwaraka_poster_new.png', hasVideo: true, videoSrc: '/vr_video.mp4', themeColor: '#fbbf24' },
    { id: 'jungle_book', title: 'JUNGLE BOOK', subtitle: 'VR 360 Experience', brief: 'Swing through the dense, vibrant jungles alongside your favorite characters. A wild, immersive adventure for the whole family.', img: '/jungle_book_poster.jpg', hasVideo: true, videoSrc: '/jungle_book_video.mp4', themeColor: '#22c55e' },
    { id: 'stargate', title: 'STARGATE', subtitle: 'Galactic Journey', brief: 'Step through the ancestral ring and travel across the cosmos. Face the unknown realms in this stunning galactic VR journey.', img: '/stargate_poster.jpg', hasVideo: true, videoSrc: '/stargate_video.mp4', themeColor: '#c084fc' },
    { id: 'jurassic', title: 'JURASSIC PARADISE', subtitle: 'Prehistoric Encounter', brief: 'Walk among ancient leviathans and majestic dinosaurs in their natural, prehistoric habitat. Thrilling, educational, and terrifyingly real.', img: '/jurassic_poster.jpg', hasVideo: true, videoSrc: '/jurassic_video.mp4', themeColor: '#f97316' },
    { id: 'ocean_quest', title: 'OCEAN QUEST', subtitle: 'Dive Into Your Dreams', brief: 'Tranquil depths and majestic sea creatures await in this relaxing VR scuba-diving simulation.', img: '/ocean_quest_poster.jpg', hasVideo: false, themeColor: '#00E6FF' },
    { id: 'lia', title: 'LIA', subtitle: 'Love In Alterreality', brief: 'A profound, story-driven cyber-romance set in the neon-lit streets of alter-reality. Make choices that shape your future.', img: '/lia_poster.jpg', hasVideo: true, videoSrc: '/lia_video.mp4', themeColor: '#f3f4f6' },
]

function MoviePlayer({ movie, onClose }) {
    const videoRef = useRef(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [subtitlesOn, setSubtitlesOn] = useState(true)
    const [subLang, setSubLang] = useState('en')
    const [showLangMenu, setShowLangMenu] = useState(false)
    const [subFontSize, setSubFontSize] = useState('md') // sm | md | lg
    const startTimeRef = useRef(Date.now())

    const availableLangs = getAvailableLanguages(movie.id)
    const subtitles = getSubtitlesForMovie(movie.id, subLang)
    const currentCue = getCurrentCue(subtitles, currentTime)

    const fontSizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }

    useEffect(() => {
        const timeout = setTimeout(() => videoRef.current?.play().catch(() => {}), 300)
        startTimeRef.current = Date.now()
        trackEvent('play', { movieId: movie.id, title: movie.title })
        return () => {
            clearTimeout(timeout)
            const watchSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
            trackEvent('watch_end', { movieId: movie.id, title: movie.title, duration: watchSeconds })
        }
    }, [])

    const handleTimeUpdate = useCallback(() => {
        if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
    }, [])

    const [skipFlash, setSkipFlash] = useState(null) // 'back' | 'fwd' | null

    const skip = (secs) => {
        if (!videoRef.current) return
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + secs)
        setSkipFlash(secs > 0 ? 'fwd' : 'back')
        setTimeout(() => setSkipFlash(null), 600)
    }

    // Keyboard shortcuts: ← back 5s, → fwd 5s
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'ArrowLeft')  { e.preventDefault(); skip(-5) }
            if (e.key === 'ArrowRight') { e.preventDefault(); skip(5) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-black flex flex-col">
            <div className="w-full h-full relative flex items-center justify-center">
                {/* Top controls bar */}
                <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
                    {/* Subtitle controls */}
                    <div className="flex items-center gap-3">
                        {/* Subtitle toggle */}
                        <button onClick={() => setSubtitlesOn(!subtitlesOn)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all backdrop-blur-md ${subtitlesOn ? 'bg-white/20 text-white border border-white/30' : 'bg-white/5 text-white/40 border border-white/10'}`}>
                            <Subtitles size={14} /> {subtitlesOn ? 'CC On' : 'CC Off'}
                        </button>

                        {/* Language selector */}
                        {subtitlesOn && availableLangs.length > 0 && (
                            <div className="relative">
                                <button onClick={() => setShowLangMenu(!showLangMenu)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold backdrop-blur-md hover:bg-white/15 transition-all">
                                    <Globe size={13} />
                                    {availableLangs.find(l => l.code === subLang)?.flag || '🌐'}
                                    {availableLangs.find(l => l.code === subLang)?.label || 'Language'}
                                    <ChevronDown size={12} className={`transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {showLangMenu && (
                                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                            className="absolute top-full mt-2 left-0 bg-black/90 border border-white/15 rounded-xl overflow-hidden backdrop-blur-xl shadow-2xl min-w-[160px] z-50">
                                            {availableLangs.map(lang => (
                                                <button key={lang.code}
                                                    onClick={() => { setSubLang(lang.code); setShowLangMenu(false) }}
                                                    className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-white/10 transition-colors ${subLang === lang.code ? 'text-[#00E6FF] bg-white/5' : 'text-white/70'}`}>
                                                    <span>{lang.flag}</span>
                                                    <span className="font-bold">{lang.label}</span>
                                                    {subLang === lang.code && <span className="ml-auto text-[#00E6FF]">✓</span>}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Font size */}
                        {subtitlesOn && (
                            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-1 py-1 backdrop-blur-md">
                                {(['sm', 'md', 'lg']).map(size => (
                                    <button key={size} onClick={() => setSubFontSize(size)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${subFontSize === size ? 'bg-white/20 text-white' : 'text-white/30 hover:text-white/50'}`}>
                                        {size === 'sm' ? 'A' : size === 'md' ? 'A' : 'A'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button onClick={onClose} className="text-white/50 hover:text-white flex items-center gap-2 text-sm font-bold transition-colors bg-black/50 px-4 py-2 rounded-full backdrop-blur">
                        <X size={16} /> Close
                    </button>
                </div>

                {/* Video — key forces remount when src changes (blob URL vs fallback) */}
                {movie.videoSrc
                    ? <video key={movie.videoSrc} ref={videoRef} src={movie.videoSrc} controls onTimeUpdate={handleTimeUpdate} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">Video file not available</div>}

                {/* Local file badge */}
                {movie.isCloud && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full border backdrop-blur-md ${
                            movie.blobReady
                                ? 'bg-green-500/20 border-green-500/30 text-green-300'
                                : 'bg-yellow-500/15 border-yellow-500/25 text-yellow-400'
                        }`}>
                            {movie.blobReady ? `▶ Playing: ${movie.title}` : '⚠ Demo video — re-upload to play your file'}
                        </span>
                    </div>
                )}

                {/* ── Skip ±5s overlay buttons ── */}
                <div className="absolute inset-0 flex items-center justify-between px-10 pointer-events-none z-30">

                    {/* ← Back 5s */}
                    <motion.button
                        onClick={() => skip(-5)}
                        animate={skipFlash === 'back' ? { scale: [1, 1.25, 1], opacity: [1, 0.6, 1] } : { scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="pointer-events-auto flex flex-col items-center gap-1 group select-none"
                        title="Back 5s (←)"
                    >
                        <div className="w-14 h-14 rounded-full bg-black/40 border border-white/15 backdrop-blur-md flex items-center justify-center group-hover:bg-white/15 group-active:scale-90 transition-all">
                            {/* Rewind icon — two triangles pointing left */}
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                            </svg>
                        </div>
                        <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest group-hover:text-white/80 transition-colors">5s</span>
                    </motion.button>

                    {/* Fwd 5s → */}
                    <motion.button
                        onClick={() => skip(5)}
                        animate={skipFlash === 'fwd' ? { scale: [1, 1.25, 1], opacity: [1, 0.6, 1] } : { scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="pointer-events-auto flex flex-col items-center gap-1 group select-none"
                        title="Forward 5s (→)"
                    >
                        <div className="w-14 h-14 rounded-full bg-black/40 border border-white/15 backdrop-blur-md flex items-center justify-center group-hover:bg-white/15 group-active:scale-90 transition-all">
                            {/* Fast-forward icon — two triangles pointing right */}
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                            </svg>
                        </div>
                        <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest group-hover:text-white/80 transition-colors">5s</span>
                    </motion.button>
                </div>

                {/* Subtitle Overlay */}
                <AnimatePresence>
                    {subtitlesOn && currentCue && (
                        <motion.div
                            key={currentCue.text}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.25 }}
                            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-[80%] text-center pointer-events-none"
                        >
                            <span className={`inline-block px-6 py-3 rounded-xl bg-black/75 backdrop-blur-sm text-white font-bold leading-relaxed shadow-[0_4px_30px_rgba(0,0,0,0.5)] ${fontSizes[subFontSize]}`}>
                                {currentCue.text}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    )
}

function HtmlOverlay({ movies, handlePlayClick, subscriptionTier, setPlayMovie, navigate }) {
    return (
        <div className="w-full h-full select-none pointer-events-none">
            {movies.map((movie, index) => (
                <div key={movie.id} className="absolute left-0 flex items-center w-screen h-screen pointer-events-none" style={{ top: `${index * 100}vh` }}>
                    <div className="w-full h-full max-w-7xl mx-auto px-10 md:px-20 relative flex items-center">
                        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center pointer-events-auto pr-8 z-20">
                            <motion.h1 initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-3" style={{ color: movie.themeColor, textShadow: `0 0 40px ${movie.themeColor}80` }}>
                                {movie.title}
                            </motion.h1>
                            <motion.h3 initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }} className="text-lg md:text-xl font-bold uppercase tracking-widest text-white/70 mb-6">
                                {movie.subtitle}
                                {movie.isCloud && <span className="ml-3 text-[10px] px-2 py-1 rounded-full bg-[#7B61FF]/20 border border-[#7B61FF]/40 text-[#7B61FF] font-black uppercase tracking-widest align-middle">☁ Uploaded</span>}
                            </motion.h3>
                            <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }} className="text-white/50 text-sm md:text-base leading-relaxed mb-10 max-w-md">
                                {movie.brief}
                            </motion.p>
                            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }} className="flex gap-4">
                                <button onClick={() => handlePlayClick(movie)} className="group flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                    {subscriptionTier === 'free' ? <><Crown size={16} className="text-[#7B61FF]" />Subscribe</> : <><Play size={16} fill="currentColor" />Watch Now</>}
                                </button>
                                {movie.hasVideo && (
                                    <button onClick={() => navigate('/vr-player')} className="group flex items-center gap-2 px-6 py-4 rounded-full bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105 backdrop-blur-md">
                                        <Play size={14} className="opacity-50" /> Trailer
                                    </button>
                                )}
                            </motion.div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function MovieImages({ movies }) {
    const { viewport } = useThree()
    const scroll = useScroll()
    const groupRef = useRef()
    const gap = viewport.height

    useFrame((state) => {
        if (!groupRef.current) return
        const targetY = scroll.offset * (movies.length - 1) * gap
        groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.1)

        movies.forEach((movie, index) => {
            const mesh = groupRef.current.children[index]
            if (!mesh) return
            const meshPosY = mesh.position.y + groupRef.current.position.y
            const normalizedPosY = meshPosY / viewport.height
            const scaleTarget = 1 - Math.abs(normalizedPosY) * 0.1

            mesh.scale.x = THREE.MathUtils.lerp(mesh.scale.x, Math.max(0.9, scaleTarget) * viewport.width, 0.1)
            mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, Math.max(0.9, scaleTarget) * viewport.height, 0.1)
            mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, -normalizedPosY * 0.2, 0.1)

            if (Math.abs(normalizedPosY) < 0.5) {
                mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, state.pointer.y * 0.1, 0.1)
                mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, state.pointer.x * 0.1, 0.1)
            } else {
                mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, 0, 0.1)
            }
        })
    })

    return (
        <group ref={groupRef}>
            {movies.map((movie, index) => (
                <Image key={movie.id} url={movie.img} scale={[viewport.width, viewport.height, 1]} position={[0, -(index * gap), -2]} transparent opacity={1} />
            ))}
        </group>
    )
}

function SceneLayout({ movies, handlePlayClick, subscriptionTier, setPlayMovie, navigate }) {
    return (
        <ScrollControls pages={Math.max(movies.length, 1)} damping={0.2} horizontal={false}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} intensity={1} />
            <MovieImages movies={movies} />
            <Scroll html style={{ width: '100vw', height: `${Math.max(movies.length, 1) * 100}vh` }}>
                <HtmlOverlay movies={movies} handlePlayClick={handlePlayClick} subscriptionTier={subscriptionTier} setPlayMovie={setPlayMovie} navigate={navigate} />
            </Scroll>
        </ScrollControls>
    )
}

export default function Dashboard() {
    const { token, setUser, subscriptionTier, activeProfile } = useStore()
    const [playMovie, setPlayMovie] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [hideHeader, setHideHeader] = useState(false)
    const [cloudCatalog, setCloudCatalog] = useState([])
    const searchRef = useRef(null)
    const navigate = useNavigate()

    // ── Load uploaded movies from cloud storage ──
    useEffect(() => {
        const loadCloud = () => {
            try {
                const stored = JSON.parse(localStorage.getItem('cymax_cloud_files') || '[]')
                const mapped = stored.map(f => {
                    const isDataUrl = f.thumb?.startsWith('data:')
                    // Look up the blob URL registered at upload time (current session only)
                    const blobUrl = window.__vrVideoBlobs?.[f.id] || null
                    return {
                        id:            `cloud_${f.id}`,
                        title:         (f.title || 'Untitled').toUpperCase(),
                        subtitle:      `${f.genre || ''} · ${f.is_360 ? '360° VR' : 'Flat'} · ${f.tier || 'free'}${!blobUrl && f.hasLocalVideo ? ' · ⚠ Re-upload to play' : ''}`,
                        brief:         `${f.genre || 'VR'} experience. ${f.is_360 ? 'Full 360° immersive.' : 'Flat screen mode.'} Tier: ${f.tier || 'free'}.`,
                        // base64 data URLs are CORS-safe — use directly in Three.js canvas
                        img:           isDataUrl ? f.thumb : '/dwaraka_poster_new.png',
                        htmlThumb:     f.thumb || null,
                        hasVideo:      true,
                        // Use the real uploaded blob URL if available, else demo fallback
                        videoSrc:      blobUrl || '/vr_video.mp4',
                        hasLocalVideo: f.hasLocalVideo,
                        blobReady:     !!blobUrl,
                        themeColor:    '#7B61FF',
                        isCloud:       true,
                        uploadedAt:    f.uploadedAt,
                    }
                })
                setCloudCatalog(mapped)
            } catch { setCloudCatalog([]) }
        }
        loadCloud()
        const t = setInterval(loadCloud, 2000)  // poll same-tab uploads
        window.addEventListener('storage', loadCloud)
        return () => { clearInterval(t); window.removeEventListener('storage', loadCloud) }
    }, [])

    useEffect(() => {
        if (!token) return
        authAPI.me().then((response) => setUser(response.data.user)).catch(console.error)
    }, [token, setUser])

    useEffect(() => {
        const handleWheel = (event) => {
            if (event.deltaY > 0) setHideHeader(true)
            if (event.deltaY < 0) setHideHeader(false)
        }

        window.addEventListener('wheel', handleWheel, { passive: true })
        return () => window.removeEventListener('wheel', handleWheel)
    }, [])

    const handlePlayClick = (movie) => {
        if (subscriptionTier === 'free' || !subscriptionTier) navigate('/subscription')
        else navigate('/vr-player')
    }

    const normalizedSearch = searchQuery.trim().toLowerCase()
    const fullCatalog = useMemo(
        () => [...catalog, ...cloudCatalog],
        [cloudCatalog]
    )
    const matchedMovies = useMemo(() => (
        normalizedSearch
            ? fullCatalog.filter((movie) => [movie.title, movie.subtitle, movie.brief].some((field) => field?.toLowerCase().includes(normalizedSearch)))
            : []
    ), [normalizedSearch, fullCatalog])

    const handleSearchSelect = (movie) => { setSearchQuery(movie.title) }

    const featuredSearchMovie = matchedMovies[0] || null
    const displayedCatalog = normalizedSearch ? matchedMovies : fullCatalog

    return (
        <div className="w-full h-screen bg-[#050505] relative overflow-hidden font-sans">
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                <motion.div animate={{ scale: [1, 1.15, 1], x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} className="absolute w-[600px] h-[600px] rounded-full bg-[#7B61FF] opacity-[0.07] blur-[120px] -top-40 -left-40" />
                <motion.div animate={{ scale: [1, 1.2, 1], x: [0, -40, 0], y: [0, 30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }} className="absolute w-[500px] h-[500px] rounded-full bg-[#00E6FF] opacity-[0.06] blur-[100px] -bottom-40 -right-20" />
                <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }} className="absolute w-[400px] h-[400px] rounded-full bg-[#ff3366] opacity-[0.04] blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                <motion.div animate={{ scale: [1, 1.3, 1], x: [0, 60, 0] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 4 }} className="absolute w-[300px] h-[300px] rounded-full bg-[#fbbf24] opacity-[0.04] blur-[90px] top-1/4 right-1/4" />
            </div>

            <div className={`absolute top-0 left-0 w-full z-[80] px-6 pt-6 lg:px-10 lg:pt-8 pointer-events-none transition-all duration-100 ${hideHeader ? 'opacity-0 -translate-y-10' : 'opacity-100 translate-y-0'}`}>
                <div className="mx-auto max-w-[1760px] rounded-[30px] bg-black/35 px-5 py-4 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.35)] pointer-events-auto">
                    <div className="flex flex-col gap-4 lg:relative lg:min-h-[72px] lg:flex-row lg:items-center lg:justify-between">
                        <div className="w-full lg:w-[280px] lg:shrink-0">
                            <BackButton className="mb-3" />
                            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.18em] text-white">
                                VR <span className="text-[#00E6FF]">Experiences</span>
                            </h1>
                            {activeProfile && (
                                <p className="text-white/50 text-[10px] md:text-xs uppercase tracking-widest mt-1">
                                    Watching as <span className="text-white/80">{activeProfile.name}</span>
                                    {activeProfile.type === 'kids' && ' · Locked Kids Mode'}
                                </p>
                            )}
                        </div>

                        <div ref={searchRef} className="relative w-full lg:absolute lg:left-1/2 lg:top-1/2 lg:w-[min(52vw,780px)] lg:-translate-x-1/2 lg:-translate-y-1/2">
                            <div className="flex h-14 w-full items-center gap-3 rounded-full bg-white px-5 shadow-[0_18px_50px_rgba(255,255,255,0.18)]">
                                <Search size={20} className="text-black/55" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(event) => {
                                        setSearchQuery(event.target.value)
                                    }}
                                    placeholder="Search"
                                    className="w-full bg-transparent text-base text-black focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end lg:w-[220px] lg:shrink-0">
                            <ProfileDropdown />
                        </div>
                    </div>
                </div>
            </div>

            {normalizedSearch && featuredSearchMovie && (
                <div className="absolute top-36 left-6 right-6 lg:left-10 lg:right-10 z-40 pointer-events-none">
                    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="ml-auto max-w-[460px] pointer-events-auto rounded-[28px] border border-white/10 bg-[#0a0a0a]/88 backdrop-blur-2xl p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                        <div className="flex items-start gap-4">
                            <img src={featuredSearchMovie.htmlThumb || featuredSearchMovie.img} alt={featuredSearchMovie.title} className="w-20 h-24 rounded-2xl object-cover shrink-0" onError={e => { e.currentTarget.src = featuredSearchMovie.img }} />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 font-bold mb-2">Search Result</p>
                                <h3 className="text-white font-black text-xl uppercase tracking-wide truncate">{featuredSearchMovie.title}</h3>
                                <p className="text-white/55 text-xs uppercase tracking-[0.18em] mt-1">{featuredSearchMovie.subtitle}</p>
                                <p className="text-white/45 text-sm leading-relaxed mt-3 line-clamp-3">{featuredSearchMovie.brief}</p>
                                <div className="flex flex-wrap gap-3 mt-4">
                                    <button onClick={() => handlePlayClick(featuredSearchMovie)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-xs font-black uppercase tracking-[0.16em]">
                                        <Play size={12} fill="currentColor" /> Watch Now
                                    </button>
                                    {featuredSearchMovie.hasVideo && (
                                        <button onClick={() => navigate('/vr-player')} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/12 bg-white/[0.04] text-white text-xs font-bold uppercase tracking-[0.16em]">
                                            <Film size={12} /> Trailer
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {normalizedSearch && displayedCatalog.length === 0 && (
                <div className="absolute inset-x-0 top-40 z-40 flex justify-center pointer-events-none px-6">
                    <div className="pointer-events-auto rounded-[28px] border border-white/10 bg-[#0a0a0a]/88 px-6 py-5 text-center backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                        <p className="text-white text-lg font-black uppercase tracking-[0.16em]">No Movie Found</p>
                        <p className="mt-2 text-sm text-white/50">Try another title in search.</p>
                    </div>
                </div>
            )}

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 text-center pointer-events-none fade-out opacity-40">
                <p className="text-[10px] text-white uppercase tracking-[0.3em] font-bold">Scroll to Explore</p>
            </div>



            <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ antialias: true, alpha: true }} className="absolute inset-0 z-10 w-full h-full">
                <Suspense fallback={null}>
                    <StarField />
                    <GlowOrbs />
                    <SceneLayout handlePlayClick={handlePlayClick} subscriptionTier={subscriptionTier} setPlayMovie={setPlayMovie} movies={displayedCatalog} navigate={navigate} />
                </Suspense>
            </Canvas>
        </div>
    )
}
