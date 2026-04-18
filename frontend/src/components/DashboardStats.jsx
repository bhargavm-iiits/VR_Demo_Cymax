import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Monitor, Wifi, Shield, Activity, Link2 } from 'lucide-react'
import useStore from '../store/useStore'
import { streamAPI } from '../api/axios'

export default function DashboardStats({ interactive = false, onStatSelect = null, refreshToken = 0 }) {
    const { wsConnected, pairingStatus, connectedDevice, user } = useStore()
    const [overview, setOverview] = useState({
        active_users: 0,
        connected_headsets: 0,
        active_sessions: 0,
        active_pairings: 0,
    })

    useEffect(() => {
        let mounted = true

        const loadOverview = async () => {
            try {
                const res = await streamAPI.getSystemOverview()
                if (mounted) setOverview(res.data || {})
            } catch {
                if (mounted) {
                    setOverview({
                        active_users: 0,
                        connected_headsets: 0,
                        active_sessions: 0,
                        active_pairings: 0,
                    })
                }
            }
        }

        loadOverview()
        const intervalId = window.setInterval(loadOverview, 10000)

        return () => {
            mounted = false
            window.clearInterval(intervalId)
        }
    }, [refreshToken])

    const stats = [
        {
            icon: <Wifi size={20} />,
            label: 'Controller',
            value: wsConnected ? 'Online' : 'Offline',
            sub: 'Browser session',
            color: wsConnected ? 'text-green-400' : 'text-red-400',
            glow: wsConnected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
        },
        {
            icon: <Users size={20} />,
            label: 'Active Users',
            value: overview.active_users ?? 0,
            sub: 'Across live sessions',
            color: 'text-[#00D1FF]',
            glow: 'rgba(0,209,255,0.2)',
        },
        {
            icon: <Monitor size={20} />,
            label: 'Headsets',
            value: overview.connected_headsets ?? 0,
            sub: connectedDevice ? `This device: ${connectedDevice.slice(0, 8)}...` : 'No paired device yet',
            color: pairingStatus === 'paired' ? 'text-[#7B61FF]' : 'text-white/70',
            glow: pairingStatus === 'paired' ? 'rgba(123,97,255,0.2)' : 'rgba(255,255,255,0.08)',
        },
        {
            icon: <Link2 size={20} />,
            label: 'Pairings',
            value: overview.active_pairings ?? 0,
            sub: pairingStatus === 'paired' ? 'Current headset paired' : pairingStatus === 'waiting' ? 'Waiting for headset' : 'No active pairing',
            color: pairingStatus === 'paired' ? 'text-green-400' : pairingStatus === 'waiting' ? 'text-yellow-400' : 'text-white/70',
            glow: pairingStatus === 'paired' ? 'rgba(34,197,94,0.2)' : pairingStatus === 'waiting' ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.08)',
        },
        {
            icon: <Activity size={20} />,
            label: 'Sessions',
            value: overview.active_sessions ?? 0,
            sub: 'Active controller sessions',
            color: 'text-green-400',
            glow: 'rgba(34,197,94,0.2)',
        },
        {
            icon: <Shield size={20} />,
            label: 'Access',
            value: user?.subscription_tier || 'free',
            sub: 'AES-256 + JWT gated',
            color: 'text-[#7B61FF]',
            glow: 'rgba(123,97,255,0.2)',
        },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((stat, i) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`glass rounded-2xl p-4 relative overflow-hidden group ${interactive ? 'cursor-pointer hover:-translate-y-1 hover:border-white/20 transition-all' : ''}`}
                    style={{ boxShadow: `0 0 30px ${stat.glow}` }}
                    onClick={interactive ? () => onStatSelect?.(stat) : undefined}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onKeyDown={interactive ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onStatSelect?.(stat)
                        }
                    } : undefined}
                >
                    <div className={`mb-3 ${stat.color}`}>{stat.icon}</div>
                    <p className={`text-lg font-bold capitalize ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-white font-medium mt-0.5">{stat.label}</p>
                    <p className="text-[10px] text-[#A0A0A0] mt-1 truncate">{stat.sub}</p>
                </motion.div>
            ))}
        </div>
    )
}
