import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Clock, Play, Pause, BarChart3, Trash2, Zap, Film, Monitor, Target, RefreshCw } from 'lucide-react'
import BackButton from '../components/BackButton'
import { getAnalyticsSummary, clearAnalytics, seedDemoData } from '../data/analyticsStore'

/* ── Animated Bar ───────────────────────────────────────────── */
function AnimatedBar({ value, maxValue, color, label, delay = 0 }) {
    const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
    return (
        <div className="flex items-end gap-2 flex-1">
            <div className="flex-1 flex flex-col items-center">
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, 3)}%` }}
                    transition={{ duration: 0.8, delay, ease: 'easeOut' }}
                    className="w-full rounded-t-lg min-h-[4px] relative group cursor-default"
                    style={{ backgroundColor: color }}
                >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-1 rounded text-[10px] text-white font-mono whitespace-nowrap border border-white/10">
                        {value}
                    </div>
                </motion.div>
                <span className="text-[10px] text-white/40 mt-2 font-bold">{label}</span>
            </div>
        </div>
    )
}

/* ── Stat Card ──────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
        >
            <div className={`${color} mb-3`}>{icon}</div>
            <p className="text-3xl font-black text-white">{value}</p>
            <p className="text-white/60 text-sm font-bold mt-1">{label}</p>
            {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
        </motion.div>
    )
}

/* ── Heatmap Bar ────────────────────────────────────────────── */
function EngagementHeatmap({ movies }) {
    if (movies.length === 0) return null

    const maxWatch = Math.max(...movies.map(m => m.totalWatchSeconds), 1)

    return (
        <div className="space-y-3">
            {movies.map((movie, i) => {
                const pct = (movie.totalWatchSeconds / maxWatch) * 100
                const minutes = Math.round(movie.totalWatchSeconds / 60)
                return (
                    <motion.div
                        key={movie.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-3"
                    >
                        <span className="text-xs text-white/50 w-32 truncate font-bold">{movie.title}</span>
                        <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 1, delay: 0.3 + i * 0.06, ease: 'easeOut' }}
                                className="h-full rounded-lg"
                                style={{
                                    background: `linear-gradient(90deg, ${i % 2 === 0 ? '#7B61FF' : '#00E6FF'}, ${i % 2 === 0 ? '#00E6FF' : '#7B61FF'})`,
                                }}
                            />
                        </div>
                        <span className="text-xs text-white/40 font-mono w-16 text-right">{minutes}m</span>
                        <span className="text-[10px] text-white/25 w-12 text-right">{movie.playCount} plays</span>
                    </motion.div>
                )
            })}
        </div>
    )
}

/* ── Retention Curve ────────────────────────────────────────── */
function RetentionCurve() {
    // Simulated retention data (percentage of viewers remaining at each point)
    const dataPoints = [100, 95, 88, 82, 75, 68, 60, 52, 45, 38, 32, 28, 24, 20]

    const maxH = 120
    const width = 100 / dataPoints.length

    return (
        <div className="space-y-3">
            <div className="flex items-end h-32 gap-[2px] px-1">
                {dataPoints.map((val, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${val}%` }}
                        transition={{ duration: 0.6, delay: 0.3 + i * 0.05, ease: 'easeOut' }}
                        className="flex-1 rounded-t-sm"
                        style={{
                            backgroundColor: val > 60 ? '#22c55e' : val > 30 ? '#eab308' : '#ef4444',
                            opacity: 0.7 + (val / 100) * 0.3,
                        }}
                        title={`${val}% viewers remaining at ${i * 10}%`}
                    />
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-white/25">
                <span>0%</span>
                <span>Video Progress</span>
                <span>100%</span>
            </div>
            <div className="flex gap-4 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> High Retention</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500" /> Medium</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Drop-off Zone</span>
            </div>
        </div>
    )
}

/* ── Device Distribution ────────────────────────────────────── */
function DeviceDistribution() {
    const devices = [
        { name: 'VR Headset', pct: 45, color: '#7B61FF', icon: '🥽' },
        { name: 'Web Controller', pct: 35, color: '#00E6FF', icon: '🖥️' },
        { name: 'Mobile', pct: 15, color: '#f97316', icon: '📱' },
        { name: 'Tablet', pct: 5, color: '#22c55e', icon: '📱' },
    ]

    return (
        <div className="space-y-4">
            {devices.map((d, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }} className="flex items-center gap-3">
                    <span className="text-lg">{d.icon}</span>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white/60 font-bold">{d.name}</span>
                            <span className="text-xs font-mono font-bold" style={{ color: d.color }}>{d.pct}%</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${d.pct}%` }}
                                transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: d.color }}
                            />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}

/* ── Main Component ─────────────────────────────────────────── */
export default function Analytics() {
    const [summary, setSummary] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        setSummary(getAnalyticsSummary())
    }, [refreshKey])

    const handleSeedDemo = () => {
        seedDemoData()
        setRefreshKey(k => k + 1)
    }

    const handleClear = () => {
        clearAnalytics()
        setRefreshKey(k => k + 1)
    }

    if (!summary) return null

    const maxDailyWatch = Math.max(...summary.last7Days.map(d => d.watchSeconds), 1)
    const maxDailyPlays = Math.max(...summary.last7Days.map(d => d.plays), 1)

    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">
            <div className="max-w-7xl mx-auto mb-6"><BackButton /></div>

            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                            Viewing <span className="text-[#00E6FF]">Analytics</span>
                        </h1>
                        <p className="text-white/50 text-sm uppercase tracking-widest">Real-Time Tracking · Watch Time · Engagement Metrics</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleSeedDemo}
                            className="flex items-center gap-2 px-4 py-2 bg-[#7B61FF]/15 border border-[#7B61FF]/30 text-[#7B61FF] text-xs font-bold rounded-xl hover:bg-[#7B61FF]/25 transition-all">
                            <Zap size={13} /> Load Demo Data
                        </button>
                        <button onClick={() => setRefreshKey(k => k + 1)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/50 text-xs font-bold rounded-xl hover:bg-white/10 transition-all">
                            <RefreshCw size={13} /> Refresh
                        </button>
                        <button onClick={handleClear}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl hover:bg-red-500/20 transition-all">
                            <Trash2 size={13} /> Clear
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon={<Clock size={20} />} label="Total Watch Time" value={`${summary.totalWatchHours}h`}
                    sub={`${summary.totalWatchMinutes} minutes total`} color="text-[#00E6FF]" delay={0} />
                <StatCard icon={<Play size={20} />} label="Total Plays" value={summary.totalPlays}
                    sub={`${summary.totalSessions} sessions`} color="text-green-400" delay={0.05} />
                <StatCard icon={<Pause size={20} />} label="Pause Events" value={summary.totalPauses}
                    sub="Interruption count" color="text-yellow-400" delay={0.1} />
                <StatCard icon={<Target size={20} />} label="Completion Rate" value={`${summary.completionRate}%`}
                    sub={`${summary.totalCompletions} completions`} color="text-[#7B61FF]" delay={0.15} />
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-8">
                    {/* Daily Watch Time Chart */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <BarChart3 size={16} className="text-[#00E6FF]" /> Daily Watch Time
                        </h3>
                        <p className="text-white/30 text-xs mb-6">Last 7 days (seconds)</p>
                        <div className="flex items-end gap-2 h-40">
                            {summary.last7Days.map((day, i) => (
                                <AnimatedBar
                                    key={day.date}
                                    value={day.watchSeconds}
                                    maxValue={maxDailyWatch}
                                    color="#00E6FF"
                                    label={day.label}
                                    delay={i * 0.08}
                                />
                            ))}
                        </div>
                    </motion.div>

                    {/* Daily Plays */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <Play size={16} className="text-green-400" /> Daily Plays
                        </h3>
                        <p className="text-white/30 text-xs mb-6">Last 7 days</p>
                        <div className="flex items-end gap-2 h-32">
                            {summary.last7Days.map((day, i) => (
                                <AnimatedBar
                                    key={day.date}
                                    value={day.plays}
                                    maxValue={maxDailyPlays}
                                    color="#7B61FF"
                                    label={day.label}
                                    delay={0.1 + i * 0.08}
                                />
                            ))}
                        </div>
                    </motion.div>

                    {/* Retention Curve */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <TrendingUp size={16} className="text-yellow-400" /> Viewer Retention Curve
                        </h3>
                        <p className="text-white/30 text-xs mb-6">Average viewer drop-off pattern</p>
                        <RetentionCurve />
                    </motion.div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    {/* Top Movies Heatmap */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <Film size={16} className="text-[#7B61FF]" /> Movie Engagement
                        </h3>
                        <p className="text-white/30 text-xs mb-6">Watch time by movie</p>
                        {summary.topMovies.length > 0 ? (
                            <EngagementHeatmap movies={summary.topMovies} />
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-white/25 text-sm">No data yet</p>
                                <p className="text-white/15 text-xs mt-1">Watch some content or load demo data</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Device Distribution */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <Monitor size={16} className="text-orange-400" /> Device Distribution
                        </h3>
                        <p className="text-white/30 text-xs mb-6">Viewing breakdown by device type</p>
                        <DeviceDistribution />
                    </motion.div>

                    {/* Session Summary */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-[#7B61FF]/10 to-[#00E6FF]/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-white font-bold text-sm mb-4">Session Summary</h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Total Sessions', value: summary.totalSessions, color: 'text-[#00E6FF]' },
                                { label: 'Avg. Session Length', value: `${summary.avgSessionMinutes}m`, color: 'text-green-400' },
                                { label: 'Movies Watched', value: summary.movieCount, color: 'text-[#7B61FF]' },
                                { label: 'Completion Rate', value: `${summary.completionRate}%`, color: 'text-yellow-400' },
                            ].map((stat, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                    <span className="text-white/50 text-sm">{stat.label}</span>
                                    <span className={`${stat.color} font-black text-lg`}>{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
