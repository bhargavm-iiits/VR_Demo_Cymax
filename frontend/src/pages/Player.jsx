import { Suspense, lazy } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Navbar from '../components/Navbar'
import PlayerControls from '../components/PlayerControls'
import PairingStatus from '../components/PairingStatus'
import Notification from '../components/Notification'
import useStore from '../store/useStore'
import useSocket from '../hooks/useSocket'

const Scene = lazy(() => import('../three/Scene'))

export default function Player() {
    const { selectedMovie, playbackState } = useStore()
    const navigate = useNavigate()
    useSocket()

    return (
        <div className="min-h-screen bg-bg noise">
            <Navbar />
            <Notification />

            <div className="max-w-7xl mx-auto px-6 pt-28 pb-16">

                {/* Back */}
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => navigate('/movies')}
                    className="flex items-center gap-2 text-[#A0A0A0] hover:text-white
                     text-sm mb-8 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Movies
                </motion.button>

                <div className="grid lg:grid-cols-3 gap-6">

                    {/* Main: 3D preview + controls */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* 3D Movie Viewer */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative rounded-3xl overflow-hidden
                         border border-white/8 aspect-video"
                        >
                            {/* 3D Background */}
                            <Suspense fallback={
                                <div className="w-full h-full bg-gradient-to-br
                                from-[#7B61FF]/20 to-[#00D1FF]/10
                                flex items-center justify-center">
                                    <span className="text-4xl animate-pulse">🎬</span>
                                </div>
                            }>
                                <Scene simple />
                            </Suspense>

                            {/* Overlay info */}
                            <div className="absolute inset-0 bg-gradient-to-t
                              from-black/80 via-transparent to-transparent
                              flex flex-col justify-end p-6">
                                {selectedMovie ? (
                                    <>
                                        <h2 className="text-2xl font-bold text-white mb-1">
                                            {selectedMovie.title}
                                        </h2>
                                        <p className="text-[#A0A0A0] text-sm">
                                            {selectedMovie.genre} · {selectedMovie.duration_minutes}min
                                            {selectedMovie.is_360_video ? ' · 360°' : ''}
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-center w-full">
                                        <p className="text-white/60 text-lg mb-2">No movie selected</p>
                                        <button
                                            onClick={() => navigate('/movies')}
                                            className="btn-primary text-white text-sm font-medium
                                 px-6 py-2.5 rounded-xl"
                                        >
                                            Browse Movies
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Playback indicator */}
                            {playbackState === 'playing' && (
                                <div className="absolute top-4 left-4 flex items-center gap-2
                                bg-red-500/20 border border-red-500/30
                                px-3 py-1.5 rounded-full">
                                    <motion.div
                                        animate={{ scale: [1, 1.3, 1] }}
                                        transition={{ repeat: Infinity, duration: 1 }}
                                        className="w-2 h-2 rounded-full bg-red-500"
                                    />
                                    <span className="text-red-400 text-xs font-medium">LIVE</span>
                                </div>
                            )}

                            {/* Secure badge */}
                            <div className="absolute top-4 right-4 flex items-center gap-1.5
                              bg-green-500/20 border border-green-500/30
                              px-3 py-1.5 rounded-full">
                                <span className="text-green-400 text-xs">🔒 Secure Stream</span>
                            </div>
                        </motion.div>

                        {/* Controls */}
                        <PlayerControls />
                    </div>

                    {/* Right sidebar */}
                    <div className="space-y-6">
                        <PairingStatus />

                        {/* Movie info */}
                        {selectedMovie && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass rounded-3xl p-6 space-y-4"
                            >
                                <h3 className="font-semibold text-white text-sm">Movie Info</h3>
                                {[
                                    { label: 'Title', value: selectedMovie.title },
                                    { label: 'Genre', value: selectedMovie.genre || '—' },
                                    { label: 'Duration', value: `${selectedMovie.duration_minutes} min` },
                                    { label: 'Rating', value: selectedMovie.rating },
                                    { label: 'Format', value: selectedMovie.is_360_video ? '360° VR' : 'Standard' },
                                    { label: 'Security', value: 'AES-256 Encrypted' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex justify-between text-sm">
                                        <span className="text-[#A0A0A0]">{label}</span>
                                        <span className="text-white font-medium">{value}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}