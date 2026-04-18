import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, Wifi, WifiOff, Zap, Play, Monitor, Cpu, ChevronRight, Copy, Check, RefreshCw } from 'lucide-react'
import BackButton from '../components/BackButton'

/* ── Quality Ladder ─────────────────────────────────────────── */
const QUALITY_LEVELS = [
    { label: '240p', res: '426×240', bitrate: 400, codec: 'H.264 Baseline', color: '#ef4444', fps: 24 },
    { label: '480p', res: '854×480', bitrate: 800, codec: 'H.264 Main', color: '#f97316', fps: 30 },
    { label: '720p', res: '1280×720', bitrate: 1500, codec: 'H.264 High', color: '#eab308', fps: 30 },
    { label: '1080p', res: '1920×1080', bitrate: 3000, codec: 'H.265 Main', color: '#22c55e', fps: 30 },
    { label: '4K', res: '3840×2160', bitrate: 8000, codec: 'H.265 Main10', color: '#00E6FF', fps: 60 },
    { label: '8K VR', res: '7680×4320', bitrate: 20000, codec: 'AV1 HDR', color: '#7B61FF', fps: 90 },
]

function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false)
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} className="text-white/40" />}
        </button>
    )
}

/* ── ABR Algorithm Simulator ────────────────────────────────── */
function getSelectedQuality(bandwidthKbps) {
    let selected = QUALITY_LEVELS[0]
    for (const q of QUALITY_LEVELS) {
        if (bandwidthKbps >= q.bitrate * 1.2) selected = q
    }
    return selected
}

/* ── Buffer Visualization ───────────────────────────────────── */
function BufferBar({ segments, currentSegment }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-white/40">Buffer Health</span>
                <span className="text-xs text-white/50">{segments.filter(s => s.loaded).length}/{segments.length} segments</span>
            </div>
            <div className="flex gap-1 h-8 rounded-xl overflow-hidden bg-black/40 border border-white/10 p-1">
                {segments.map((seg, i) => (
                    <motion.div
                        key={i}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: seg.loaded ? 1 : 0.2, opacity: seg.loaded ? 1 : 0.3 }}
                        transition={{ duration: 0.3, delay: seg.loaded ? i * 0.05 : 0 }}
                        className="flex-1 rounded-sm origin-bottom"
                        style={{
                            backgroundColor: seg.loaded ? seg.quality.color : 'rgba(255,255,255,0.1)',
                            border: i === currentSegment ? '2px solid white' : 'none',
                        }}
                        title={`Seg ${i + 1}: ${seg.loaded ? seg.quality.label : 'not loaded'}`}
                    />
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-white/30">
                <span>0:00</span>
                <span>Playhead ▶</span>
                <span>{segments.length * 6}s</span>
            </div>
        </div>
    )
}

/* ── Main Component ─────────────────────────────────────────── */
export default function AdaptiveBitrate() {
    const [bandwidth, setBandwidth] = useState(5000) // kbps
    const [isSimulating, setIsSimulating] = useState(false)
    const [segments, setSegments] = useState([])
    const [currentSegment, setCurrentSegment] = useState(0)
    const [history, setHistory] = useState([])
    const [networkJitter, setNetworkJitter] = useState(false)
    const intervalRef = useRef(null)

    const selectedQuality = getSelectedQuality(bandwidth)

    // Generate manifest
    const generateManifest = () => {
        const lines = [
            '#EXTM3U',
            '#EXT-X-VERSION:3',
            '',
            '# Adaptive Bitrate Variants',
            ...QUALITY_LEVELS.map(q =>
                `#EXT-X-STREAM-INF:BANDWIDTH=${q.bitrate * 1000},RESOLUTION=${q.res},CODECS="${q.codec}",FRAME-RATE=${q.fps}\nstream_${q.label.toLowerCase()}.m3u8`
            ),
        ].join('\n')
        return lines
    }

    const generateSegmentPlaylist = (quality) => {
        const segCount = 10
        return [
            '#EXTM3U',
            '#EXT-X-VERSION:3',
            `#EXT-X-TARGETDURATION:6`,
            `#EXT-X-KEY:METHOD=AES-128,URI="/api/stream/key"`,
            '',
            ...Array.from({ length: segCount }, (_, i) => `#EXTINF:6.0,\n/api/stream/segment_${String(i).padStart(4, '0')}_${quality.label.toLowerCase()}.ts`),
            '#EXT-X-ENDLIST',
        ].join('\n')
    }

    // Simulate streaming
    const startSimulation = () => {
        setIsSimulating(true)
        setHistory([])
        setCurrentSegment(0)
        const segs = Array.from({ length: 20 }, () => ({ loaded: false, quality: QUALITY_LEVELS[0] }))
        setSegments(segs)

        let seg = 0
        let bw = bandwidth
        intervalRef.current = setInterval(() => {
            if (networkJitter) {
                const jitter = (Math.random() - 0.5) * 4000
                bw = Math.max(200, Math.min(25000, bandwidth + jitter))
            } else {
                bw = bandwidth
            }

            const q = getSelectedQuality(bw)
            setSegments(prev => prev.map((s, i) => i === seg ? { loaded: true, quality: q } : s))
            setCurrentSegment(seg)
            setHistory(prev => [...prev, { seg, quality: q.label, bandwidth: Math.round(bw), time: Date.now() }])

            seg++
            if (seg >= 20) {
                clearInterval(intervalRef.current)
                setIsSimulating(false)
            }
        }, 500)
    }

    const stopSimulation = () => {
        clearInterval(intervalRef.current)
        setIsSimulating(false)
    }

    useEffect(() => () => clearInterval(intervalRef.current), [])

    const manifest = generateManifest()
    const segPlaylist = generateSegmentPlaylist(selectedQuality)

    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">
            <div className="max-w-7xl mx-auto mb-6"><BackButton /></div>

            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                    Adaptive <span className="text-[#00E6FF]">Bitrate</span>
                </h1>
                <p className="text-white/50 text-sm uppercase tracking-widest">HLS Multi-Quality · ABR Algorithm · Bandwidth Simulation</p>
            </motion.div>

            {/* Quality Ladder */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
                {QUALITY_LEVELS.map((q, i) => {
                    const isSelected = q.label === selectedQuality.label
                    return (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className={`relative rounded-2xl border p-4 transition-all duration-300 cursor-default ${isSelected ? 'border-white/30 bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.08)]' : 'border-white/8 bg-white/[0.03]'}`}>
                            {isSelected && (
                                <motion.div layoutId="abr-indicator"
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: q.color, boxShadow: `0 0 12px ${q.color}` }}>
                                    <Check size={10} className="text-black" />
                                </motion.div>
                            )}
                            <div className="w-3 h-3 rounded-full mb-3" style={{ backgroundColor: q.color, boxShadow: `0 0 10px ${q.color}` }} />
                            <h3 className="text-white font-black text-lg">{q.label}</h3>
                            <p className="text-white/40 text-xs font-mono mt-1">{q.res}</p>
                            <p className="text-xs mt-2" style={{ color: q.color }}>{q.bitrate} kbps</p>
                            <p className="text-white/25 text-[10px] mt-1">{q.codec} · {q.fps}fps</p>
                        </motion.div>
                    )
                })}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Left: Bandwidth simulator */}
                <div className="space-y-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                        <h2 className="text-white font-bold text-sm flex items-center gap-2">
                            <Wifi size={16} className="text-[#00E6FF]" /> Bandwidth Simulator
                        </h2>

                        {/* Bandwidth slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-white/40">Network Speed</span>
                                <span className="text-sm font-mono font-bold" style={{ color: selectedQuality.color }}>
                                    {(bandwidth / 1000).toFixed(1)} Mbps
                                </span>
                            </div>
                            <input type="range" min={200} max={25000} value={bandwidth}
                                onChange={e => setBandwidth(Number(e.target.value))}
                                className="w-full accent-[#00E6FF]"
                                style={{ background: `linear-gradient(to right, #00E6FF ${(bandwidth / 25000) * 100}%, rgba(255,255,255,0.1) 0%)` }} />
                            <div className="flex justify-between text-[10px] text-white/25 mt-1">
                                <span>0.2 Mbps</span>
                                <span>25 Mbps</span>
                            </div>
                        </div>

                        {/* Selected quality info */}
                        <div className="rounded-xl border p-4 transition-all" style={{ borderColor: selectedQuality.color + '40', backgroundColor: selectedQuality.color + '10' }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">ABR Selection</p>
                                    <p className="text-2xl font-black mt-1" style={{ color: selectedQuality.color }}>{selectedQuality.label}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white/40 text-xs">{selectedQuality.res}</p>
                                    <p className="text-white/40 text-xs">{selectedQuality.codec}</p>
                                    <p className="text-xs mt-1" style={{ color: selectedQuality.color }}>{selectedQuality.bitrate} kbps</p>
                                </div>
                            </div>
                        </div>

                        {/* Network jitter toggle */}
                        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                            <div>
                                <p className="text-white text-sm font-semibold">Network Jitter</p>
                                <p className="text-white/40 text-xs">Simulate fluctuating bandwidth</p>
                            </div>
                            <button onClick={() => setNetworkJitter(!networkJitter)}
                                className={`w-10 h-5 rounded-full transition-all ${networkJitter ? 'bg-orange-400' : 'bg-white/10'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform mx-0.5 ${networkJitter ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>

                        {/* Simulate buttons */}
                        <div className="flex gap-3">
                            <button onClick={isSimulating ? stopSimulation : startSimulation}
                                className={`flex-1 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${isSimulating ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-[#00E6FF] hover:bg-[#00c4da] text-black'}`}>
                                {isSimulating ? <><RefreshCw size={14} className="animate-spin" /> Stop</> : <><Play size={14} /> Simulate Stream</>}
                            </button>
                        </div>

                        {/* Buffer bar */}
                        {segments.length > 0 && <BufferBar segments={segments} currentSegment={currentSegment} />}
                    </motion.div>

                    {/* ABR Decision Log */}
                    {history.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                                <Cpu size={14} className="text-[#7B61FF]" /> ABR Decision Log
                            </h3>
                            <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                {history.map((h, i) => {
                                    const q = QUALITY_LEVELS.find(q => q.label === h.quality) || QUALITY_LEVELS[0]
                                    return (
                                        <div key={i} className="flex items-center gap-3 text-xs font-mono py-1">
                                            <span className="text-white/25 w-12">seg {String(h.seg).padStart(2, '0')}</span>
                                            <span className="text-white/40 w-20">{h.bandwidth} kbps</span>
                                            <span className="font-bold" style={{ color: q.color }}>→ {h.quality}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Right: HLS Manifests */}
                <div className="space-y-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-sm">Master Manifest (master.m3u8)</h3>
                            <CopyBtn text={manifest} />
                        </div>
                        <pre className="bg-black/50 border border-white/10 rounded-xl p-4 text-xs text-[#00E6FF] font-mono overflow-x-auto whitespace-pre-wrap max-h-64">{manifest}</pre>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-sm">
                                Segment Playlist ({selectedQuality.label})
                            </h3>
                            <CopyBtn text={segPlaylist} />
                        </div>
                        <pre className="bg-black/50 border border-white/10 rounded-xl p-4 text-xs text-yellow-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-64">{segPlaylist}</pre>
                    </motion.div>

                    {/* Algorithm explanation */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-[#7B61FF]/10 to-[#00E6FF]/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-white font-bold text-sm mb-4">ABR Algorithm (Throughput-Based)</h3>
                        <div className="space-y-3 text-xs text-white/60 font-mono leading-relaxed">
                            <p className="text-white/80">// Simplified ABR Decision Logic</p>
                            <p>1. <span className="text-[#00E6FF]">Measure</span> → Estimate throughput from last 3 segments</p>
                            <p>2. <span className="text-yellow-400">Compare</span> → Find highest quality where bitrate {'<'} 80% throughput</p>
                            <p>3. <span className="text-green-400">Switch</span> → Request next segment at selected quality</p>
                            <p>4. <span className="text-purple-400">Buffer</span> → If buffer {'<'} 2 segments, drop quality immediately</p>
                            <p>5. <span className="text-orange-400">Repeat</span> → Re-evaluate every segment (6 seconds)</p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
