import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PlaySquare, Film, Users, LayoutGrid, Headphones, Crown, LogOut, Clapperboard, Activity } from 'lucide-react'
import useStore from '../store/useStore'

function LogoutButton() {
    const logout   = useStore(s => s.logout)
    const navigate = useNavigate()
    const handleLogout = () => { logout(); navigate('/login') }
    return (
        <button onClick={handleLogout} className="p-3 text-white/30 hover:text-red-400 transition-colors group relative">
            <LogOut size={20} />
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-secondary rounded-lg text-xs font-semibold
                          text-white opacity-0 -translate-x-4 pointer-events-none transition-all duration-300
                          group-hover:opacity-100 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl border border-white/10">
                Sign Out
            </div>
        </button>
    )
}

export default function SidebarNav() {
    const location  = useLocation()
    // Read role — "full" = Bhargav_Cymax (sees Media Vault), "limited" = everyone else
    const userRole  = useStore(s => s.userRole)
    const isFullUser = userRole === 'full'

    const navItems = [
        { icon: LayoutGrid,   path: '/dashboard', label: 'Home' },
        { icon: PlaySquare,   path: '/services',  label: 'System Overview' },
        // Media Vault: ONLY shown to role="full" (Bhargav_Cymax)
        ...(isFullUser ? [{ icon: Film, path: '/media', label: 'Media Vault 🔒' }] : []),
        { icon: Headphones,   path: '/headset',   label: 'Headset Control' },
        { icon: Users,        path: '/about',     label: 'About Us' },
        { icon: Clapperboard, path: '/vr-player', label: 'VR Player' },
        { icon: Activity,     path: '/monitor',   label: 'System Monitor' },
    ]

    return (
        <motion.nav
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-[80px] h-screen fixed left-0 top-0 hidden md:flex flex-col items-center py-8 z-50
                      bg-[#ffffff05] border-r border-white/5 backdrop-blur-xl"
        >
            {/* Logo */}
            <Link to="/dashboard" className="mb-10 relative group">
                <div className="w-14 h-14 rounded-2xl overflow-hidden
                              shadow-[0_0_20px_rgba(0,230,255,0.25)]
                              group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(0,230,255,0.4)]
                              transition-all duration-300">
                    <img
                        src="/cymax_logo_icon.png"
                        alt="CYMAX"
                        className="w-full h-full object-cover"
                    />
                </div>
            </Link>

            {/* Nav Links */}
            <div className="flex flex-col items-center gap-4 flex-1 overflow-y-auto custom-scrollbar py-2">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path
                    const Icon     = item.icon
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className="relative group p-2.5 shrink-0"
                        >
                            <Icon
                                size={20}
                                className={`transition-colors duration-300 ${
                                    isActive ? 'text-white' : 'text-[#A0A0A0] group-hover:text-white'
                                }`}
                            />
                            {isActive && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className="absolute inset-0 bg-white/10 rounded-2xl -z-10"
                                />
                            )}
                            {/* Tooltip */}
                            <div className="absolute left-full ml-4 px-3 py-1.5 bg-secondary rounded-lg text-xs font-semibold
                                          text-white opacity-0 -translate-x-4 pointer-events-none transition-all duration-300
                                          group-hover:opacity-100 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl border border-white/10">
                                {item.label}
                            </div>
                        </Link>
                    )
                })}
            </div>

            {/* Bottom: Subscription + Logout */}
            <div className="mt-auto flex flex-col items-center gap-3">
                <Link to="/subscription" className="p-3 text-[#7B61FF] hover:text-white transition-colors group relative">
                    <Crown size={22} />
                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-secondary rounded-lg text-xs font-semibold
                                  text-white opacity-0 -translate-x-4 pointer-events-none transition-all duration-300
                                  group-hover:opacity-100 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl border border-white/10">
                        Subscription
                    </div>
                </Link>
                <LogoutButton />
            </div>
        </motion.nav>
    )
}
