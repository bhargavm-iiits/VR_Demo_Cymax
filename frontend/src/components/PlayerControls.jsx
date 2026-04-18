import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Play, Pause, Square, Volume2, VolumeX,
    SkipBack, SkipForward, Shield, Wifi
} from 'lucide-react'
import useStore from '../store/useStore'
import useSocket from '../hooks/useSocket'
import { streamAPI } from '../api/axios'

export default function PlayerControls() {
    const {
        selectedMovie, playbackState, currentPosition,
        volume, streamToken, wsConnected, pairingStatus,
        setPlaybackState, setStreamToken,
        setCurrentPosition, setVolume
    } = useStore()

    const { sendCommand } = useSocket()
    const [loadingToken, setLoadingToken] = useState(false)
    const [muted, setMuted] = useState(false)

    // Get stream token when movie selected
    useEffect(() => {
        if (!selectedMovie) return
        const fetch = async () => {
            try {
                setLoadingToken(true)
                const res = await streamAPI.getToken(selectedMovie.id)
                setStreamToken(res.data.stream_token)
            } catch (e) {
                console.error('Stream token error:', e)
            } finally {
                setLoadingToken(false)
            }
        }
        fetch()
    }, [selectedMovie])

    const handlePlay = () => {
        sendCommand('play')
        setPlaybackState('playing')
    }

    const handlePause = () => {
        sendCommand('pause')
        setPlaybackState('paused')
    }

    const handleStop = () => {
        sendCommand('stop')
        setPlaybackState('stopped')
        setCurrentPosition(0)
    }

    const handleSeek = (e) => {
        const pos = Number(e.target.value)
        setCurrentPosition(pos)
        sendCommand('seek', { position_seconds: pos })
    }

    const handleVolume = (e) => {
        const vol = Number(e.target.value)
        const v = muted ? 0 : vol
        setVolume(vol)
        sendCommand('volume', { volume_level: v })
    }

    const toggleMute = () => {
        const next = !muted
        setMuted(next)
        sendCommand('volume', { volume_level: next ? 0 : volume })
    }

    const duration = selectedMovie?.duration_minutes
        ? selectedMovie.duration_minutes * 60
        : 3600

    const formatTime = (s) => {
        const m = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        return `${m}:${sec.toString().padStart(2, '0')}`
    }

    const isPlaying = playbackState === 'playing'

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-6 space-y-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-white truncate max-w-[200px]">
                        {selectedMovie?.title || 'No movie selected'}
                    </h3>
                    <p className="text-xs text-[#A0A0A0] mt-0.5">
                        {selectedMovie?.genre} · {selectedMovie?.duration_minutes}min
                    </p>
                </div>

                {/* Status badges */}
                <div className="flex flex-col items-end gap-1.5">
                    <div className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1
                          rounded-full border font-medium
                          ${wsConnected
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        <Wifi size={10} />
                        {wsConnected ? 'Live' : 'Offline'}
                    </div>
                    {streamToken && (
                        <div className="flex items-center gap-1 text-[10px]
                            text-green-400 bg-green-500/10
                            border border-green-500/20 px-2.5 py-1 rounded-full">
                            <Shield size={10} />
                            Secure Stream
                        </div>
                    )}
                </div>
            </div>

            {/* Seek Bar */}
            <div className="space-y-2">
                <input
                    type="range"
                    min={0}
                    max={duration}
                    value={currentPosition}
                    onChange={handleSeek}
                    disabled={!selectedMovie || !wsConnected}
                    className="w-full accent-[#7B61FF] disabled:opacity-40"
                    style={{
                        background: `linear-gradient(to right, #7B61FF ${(currentPosition / duration) * 100}%, rgba(255,255,255,0.1) 0%)`
                    }}
                />
                <div className="flex justify-between text-xs text-[#A0A0A0]">
                    <span>{formatTime(currentPosition)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                        const next = Math.max(0, currentPosition - 5)
                        setCurrentPosition(next)
                        sendCommand('seek', { position_seconds: next })
                    }}
                    disabled={!selectedMovie || !wsConnected}
                    className="flex flex-col items-center gap-0.5 p-3 rounded-xl glass text-[#A0A0A0]
                     hover:text-white disabled:opacity-30 transition-all"
                    title="Back 5 seconds"
                >
                    <SkipBack size={18} />
                    <span className="text-[9px] font-bold tracking-widest opacity-60">5s</span>
                </motion.button>

                {/* Play/Pause */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={isPlaying ? handlePause : handlePlay}
                    disabled={!selectedMovie || !wsConnected || !streamToken || loadingToken}
                    className="w-16 h-16 rounded-2xl btn-primary
                     flex items-center justify-center
                     disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-[0_0_30px_rgba(123,97,255,0.5)]"
                >
                    <AnimatePresence mode="wait">
                        {loadingToken ? (
                            <motion.span
                                key="loading"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                            />
                        ) : isPlaying ? (
                            <motion.span key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Pause size={22} className="text-white" />
                            </motion.span>
                        ) : (
                            <motion.span key="play" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Play size={22} className="text-white ml-0.5" />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleStop}
                    disabled={!selectedMovie || !wsConnected}
                    className="p-3 rounded-xl glass text-[#A0A0A0]
                     hover:text-white disabled:opacity-30 transition-all"
                >
                    <Square size={18} />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                        const next = currentPosition + 5
                        setCurrentPosition(next)
                        sendCommand('seek', { position_seconds: next })
                    }}
                    disabled={!selectedMovie || !wsConnected}
                    className="flex flex-col items-center gap-0.5 p-3 rounded-xl glass text-[#A0A0A0]
                     hover:text-white disabled:opacity-30 transition-all"
                    title="Forward 5 seconds"
                >
                    <SkipForward size={18} />
                    <span className="text-[9px] font-bold tracking-widest opacity-60">5s</span>
                </motion.button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
                <button onClick={toggleMute} className="text-[#A0A0A0] hover:text-white transition-colors">
                    {muted || volume === 0
                        ? <VolumeX size={18} />
                        : <Volume2 size={18} />
                    }
                </button>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={muted ? 0 : volume}
                    onChange={handleVolume}
                    className="flex-1 accent-[#7B61FF]"
                    style={{
                        background: `linear-gradient(to right, #00D1FF ${muted ? 0 : volume}%, rgba(255,255,255,0.1) 0%)`
                    }}
                />
                <span className="text-xs text-[#A0A0A0] w-8 text-right">
                    {muted ? 0 : volume}%
                </span>
            </div>

            {/* Playback state label */}
            <div className="flex items-center justify-center">
                <span className={`text-xs px-3 py-1 rounded-full border font-medium
          ${playbackState === 'playing'
                        ? 'text-green-400 bg-green-500/10 border-green-500/20'
                        : playbackState === 'paused'
                            ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                            : 'text-[#A0A0A0] bg-white/5 border-white/10'
                    }`}>
                    {playbackState === 'playing' && '▶ Playing on VR Headset'}
                    {playbackState === 'paused' && '⏸ Paused'}
                    {playbackState === 'stopped' && '⏹ Stopped'}
                    {playbackState === 'idle' && '— Ready to Play'}
                </span>
            </div>
        </motion.div>
    )
}