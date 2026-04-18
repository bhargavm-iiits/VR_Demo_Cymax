import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, LogOut, Zap } from 'lucide-react'
import useStore from '../store/useStore'

export default function Navbar() {
    const { user, wsConnected, logout, pairingStatus } = useStore()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <motion.nav
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
        >
            <div className="max-w-7xl mx-auto glass rounded-2xl px-6 py-3
                      flex items-center justify-between">

                {/* Logo */}
                <Link to="/dashboard" className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg btn-primary
                          flex items-center justify-center">
                        <Zap size={16} className="text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">
                        <span className="gradient-text">VR</span>
                        <span className="text-white ml-1">Cinema</span>
                    </span>
                </Link>

                {/* Nav Links */}
                <div className="hidden md:flex items-center gap-8">
                    {[
                        { to: '/dashboard', label: 'Dashboard' },
                        { to: '/movies', label: 'Movies' },
                        { to: '/player', label: 'Player' },
                        { to: '/pairing', label: 'Pair VR' },
                    ].map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className="text-sm text-[#A0A0A0] hover:text-white
                         transition-colors duration-200 font-medium"
                        >
                            {label}
                        </Link>
                    ))}
                </div>

                {/* Right Side */}
                <div className="flex items-center gap-4">

                    {/* WS Status */}
                    <motion.div
                        animate={{ scale: wsConnected ? [1, 1.2, 1] : 1 }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full
              ${wsConnected
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                    >
                        {wsConnected
                            ? <Wifi size={12} />
                            : <WifiOff size={12} />
                        }
                        <span>{wsConnected ? 'Live' : 'Offline'}</span>
                    </motion.div>

                    {/* Pairing badge */}
                    {pairingStatus === 'paired' && (
                        <div className="hidden md:flex items-center gap-1.5
                            text-xs px-3 py-1.5 rounded-full
                            bg-[#7B61FF]/10 border border-[#7B61FF]/20
                            text-[#7B61FF]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#7B61FF] animate-pulse" />
                            VR Paired
                        </div>
                    )}

                    {/* User */}
                    {user && (
                        <div className="flex items-center gap-3">
                            <div className="hidden md:block text-right">
                                <p className="text-sm font-medium text-white">{user.username}</p>
                                <p className="text-xs text-[#A0A0A0] capitalize">
                                    {user.subscription_tier}
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-full btn-primary
                              flex items-center justify-center text-sm font-bold">
                                {user.username?.[0]?.toUpperCase()}
                            </div>
                        </div>
                    )}

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg glass hover:bg-white/10
                       text-[#A0A0A0] hover:text-white transition-all"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </motion.nav>
    )
}