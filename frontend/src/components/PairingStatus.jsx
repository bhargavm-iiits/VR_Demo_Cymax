import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, Link2Off, RefreshCw, Copy, Check, AlertTriangle } from 'lucide-react'
import useStore from '../store/useStore'
import { streamAPI } from '../api/axios'

export default function PairingStatus() {
    const {
        pairingStatus, pairingCode, connectedDevice,
        setPairingCode, setPairingStatus, setConnectedDevice, setNotification
    } = useStore()

    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        let mounted = true

        const syncStatus = async () => {
            try {
                const res = await streamAPI.getStatus()
                if (!mounted) return

                const data = res.data || {}
                const deviceId = data.device?.vr_device_id || data.device_id || null
                const code = data.device?.pairing_code || data.pairing_code || null
                const paired = data.device?.vr_paired ?? data.paired ?? false

                setConnectedDevice(deviceId)
                setPairingCode(code)
                setPairingStatus(paired ? 'paired' : (code ? 'waiting' : 'idle'))
            } catch {
                if (!mounted) return
                setPairingStatus('error')
            }
        }

        syncStatus()
        const intervalId = window.setInterval(syncStatus, 5000)

        return () => {
            mounted = false
            window.clearInterval(intervalId)
        }
    }, [setConnectedDevice, setPairingCode, setPairingStatus])

    const generateCode = async () => {
        setLoading(true)
        try {
            const res = await streamAPI.getPairingCode()
            setPairingCode(res.data.pairing_code)
            setConnectedDevice(null)
            setPairingStatus('waiting')
        } catch (e) {
            setNotification({ type: 'error', msg: 'Failed to generate pairing code' })
        } finally {
            setLoading(false)
        }
    }

    const copyCode = () => {
        if (!pairingCode) return
        navigator.clipboard.writeText(pairingCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const statusConfig = {
        idle: {
            color: 'text-[#A0A0A0]',
            bg: 'bg-white/5',
            border: 'border-white/10',
            icon: <Link2Off size={20} className="text-[#A0A0A0]" />,
            label: 'Not Paired',
        },
        waiting: {
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/20',
            icon: <RefreshCw size={20} className="text-yellow-400 animate-spin" />,
            label: 'Waiting for VR Headset',
        },
        paired: {
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/20',
            icon: <Link2 size={20} className="text-green-400" />,
            label: 'Paired & Connected',
        },
        error: {
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            icon: <AlertTriangle size={20} className="text-red-400" />,
            label: 'Pairing Error',
        },
    }

    const cfg = statusConfig[pairingStatus] || statusConfig.idle

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-6 space-y-5"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Device Pairing</h3>
                <div className={`flex items-center gap-2 text-xs px-3 py-1.5
                        rounded-full border font-medium
                        ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                    {cfg.icon}
                    <span>{cfg.label}</span>
                </div>
            </div>

            {/* Status Content */}
            <AnimatePresence mode="wait">
                {pairingStatus === 'paired' && connectedDevice && (
                    <motion.div
                        key="paired"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20
                              flex items-center justify-center">
                                <Link2 size={18} className="text-green-400" />
                            </div>
                            <div>
                                <p className="text-green-400 font-medium text-sm">VR Headset Connected</p>
                                <p className="text-xs text-green-400/60 font-mono mt-0.5">
                                    ID: {connectedDevice}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {pairingStatus === 'waiting' && pairingCode && (
                    <motion.div
                        key="waiting"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        <p className="text-[#A0A0A0] text-sm">
                            Enter this code in your VR headset app:
                        </p>

                        {/* Code Display */}
                        <div className="relative">
                            <div className="bg-white/5 border border-white/10 rounded-2xl
                              p-6 text-center">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    {pairingCode.split('').map((char, i) => (
                                        <motion.span
                                            key={i}
                                            initial={{ y: -10, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="w-10 h-12 glass rounded-xl flex items-center justify-center
                                 text-2xl font-bold gradient-text border border-white/10"
                                        >
                                            {char}
                                        </motion.span>
                                    ))}
                                </div>
                                <p className="text-xs text-[#A0A0A0] mt-3">
                                    Valid for 10 minutes
                                </p>
                            </div>

                            {/* Copy button */}
                            <button
                                onClick={copyCode}
                                className="absolute top-3 right-3 p-2 glass rounded-lg
                           text-[#A0A0A0] hover:text-white transition-all"
                            >
                                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                        </div>

                        {/* Animated waiting dots */}
                        <div className="flex items-center justify-center gap-2">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                                    className="w-2 h-2 rounded-full bg-yellow-400"
                                />
                            ))}
                            <span className="text-xs text-yellow-400 ml-2">
                                Waiting for VR headset...
                            </span>
                        </div>
                    </motion.div>
                )}

                {(pairingStatus === 'idle' || pairingStatus === 'error') && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-4"
                    >
                        <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Link2Off size={28} className="text-[#A0A0A0]" />
                        </div>
                        <p className="text-[#A0A0A0] text-sm mb-4">
                            {pairingStatus === 'error'
                                ? 'Pairing failed. Try generating a new code.'
                                : 'Generate a code to pair your VR headset'
                            }
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={generateCode}
                            disabled={loading}
                            className="btn-primary text-white text-sm font-semibold
                         px-6 py-3 rounded-xl disabled:opacity-50"
                        >
                            {loading ? 'Generating...' : 'Generate Pairing Code'}
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Re-pair button when paired */}
            {pairingStatus === 'paired' && (
                <button
                    onClick={() => {
                        setPairingStatus('idle')
                        setPairingCode(null)
                        setConnectedDevice(null)
                    }}
                    className="w-full text-xs text-[#A0A0A0] hover:text-white py-2
                     transition-colors text-center"
                >
                    Disconnect & re-pair
                </button>
            )}
        </motion.div>
    )
}
