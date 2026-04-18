import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
    User, Plus, ChevronDown, Settings, LogOut,
    Crown, Baby, Shield, Edit2, Trash2, X, Check
} from 'lucide-react'
import useStore from '../store/useStore'

// ── Avatar colour palette ────────────────────────────────────────
const COLORS = ['#7B61FF', '#00E6FF', '#ff3366', '#ffaa00', '#00ff99', '#ff6b6b', '#a78bfa']
const ICONS  = ['👤', '🎮', '👶', '🎬', '🚀', '🎭', '🌊']

const PROFILE_TYPES = [
    { value: 'adult',  label: 'Adult',  icon: <User size={13}/>,   desc: 'Full access, all ratings' },
    { value: 'teen',   label: 'Teen',   icon: <Shield size={13}/>, desc: 'PG-13 & below only' },
    { value: 'kids',   label: 'Kids',   icon: <Baby size={13}/>,   desc: 'G-rated content only' },
]

// ── Default profiles seeded on first login ───────────────────────
export const seedDefaultProfiles = (username) => [
    { id: 'main', name: username || 'Main', type: 'adult', color: COLORS[0], icon: '👤', isOwner: true },
    { id: 'kids', name: 'Kids',            type: 'kids',  color: '#00ff99', icon: '👶', isOwner: false },
]

// ── Mini avatar ──────────────────────────────────────────────────
function Avatar({ profile, size = 9, ring = false }) {
    return (
        <div
            className={`w-${size} h-${size} rounded-full flex items-center justify-center text-base font-bold shrink-0 select-none
                        ${ring ? 'ring-2 ring-offset-1 ring-offset-[#0d0d0d]' : ''}`}
            style={{ background: profile.color, ringColor: profile.color }}
        >
            {profile.icon}
        </div>
    )
}

// ── Add/Edit Profile Modal ────────────────────────────────────────
function ProfileModal({ initial, onSave, onClose }) {
    const [name, setName] = useState(initial?.name || '')
    const [type, setType] = useState(initial?.type || 'adult')
    const [color, setColor] = useState(initial?.color || COLORS[0])
    const [icon, setIcon] = useState(initial?.icon || '👤')

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-7 w-full max-w-sm mx-6 shadow-2xl"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-black text-lg">{initial ? 'Edit Profile' : 'New Profile'}</h3>
                    <button onClick={onClose} className="text-white/30 hover:text-white"><X size={18}/></button>
                </div>

                {/* Preview avatar */}
                <div className="flex justify-center mb-5">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl" style={{ background: color }}>
                        {icon}
                    </div>
                </div>

                {/* Icon picker */}
                <div className="flex gap-2 justify-center mb-4">
                    {ICONS.map(ic => (
                        <button key={ic} onClick={() => setIcon(ic)}
                            className={`w-9 h-9 rounded-full text-xl flex items-center justify-center border-2 transition-all
                                        ${icon === ic ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ background: color + '40' }}>
                            {ic}
                        </button>
                    ))}
                </div>

                {/* Colour picker */}
                <div className="flex gap-2 justify-center mb-5">
                    {COLORS.map(c => (
                        <button key={c} onClick={() => setColor(c)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-125' : 'border-transparent'}`}
                            style={{ background: c }}/>
                    ))}
                </div>

                {/* Name */}
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Profile name"
                    maxLength={16}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-4 focus:outline-none focus:border-[#7B61FF]/60 placeholder-white/30"
                />

                {/* Type */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    {PROFILE_TYPES.map(pt => (
                        <button key={pt.value} onClick={() => setType(pt.value)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all
                                        ${type === pt.value ? 'border-[#7B61FF] bg-[#7B61FF]/15 text-white' : 'border-white/10 text-white/40 hover:border-white/20'}`}>
                            {pt.icon}
                            <span className="font-bold">{pt.label}</span>
                        </button>
                    ))}
                </div>

                <button
                    disabled={!name.trim()}
                    onClick={() => onSave({ id: initial?.id || Date.now().toString(), name: name.trim(), type, color, icon, isOwner: initial?.isOwner || false })}
                    className="w-full py-3 bg-gradient-to-r from-[#7B61FF] to-[#00E6FF] text-black font-black rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                    <Check size={14}/> {initial ? 'Save Changes' : 'Create Profile'}
                </button>
            </motion.div>
        </motion.div>
    )
}

// ── Main ProfileDropdown ─────────────────────────────────────────
export default function ProfileDropdown() {
    const {
        user, profiles, activeProfile, subscriptionTier,
        setProfiles, setActiveProfile, logout
    } = useStore()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [editTarget, setEditTarget] = useState(null)   // null = new profile
    const dropRef = useRef(null)

    // Seed default profiles on first use
    useEffect(() => {
        if (user && profiles.length === 0) {
            const defaults = seedDefaultProfiles(user.username)
            setProfiles(defaults)
            setActiveProfile(defaults[0])
        }
    }, [user, profiles.length])

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const active = activeProfile || profiles[0]

    const handleSwitch = (profile) => {
        setActiveProfile(profile)
        setOpen(false)
    }

    const handleSaveProfile = (profile) => {
        const exists = profiles.find(p => p.id === profile.id)
        const next = exists ? profiles.map(p => p.id === profile.id ? profile : p) : [...profiles, profile]
        setProfiles(next)
        if (activeProfile?.id === profile.id) setActiveProfile(profile)
        setShowSettings(false)
        setEditTarget(null)
    }

    const handleDelete = (id) => {
        if (profiles.length <= 1) return
        const next = profiles.filter(p => p.id !== id)
        setProfiles(next)
        if (activeProfile?.id === id) setActiveProfile(next[0])
    }

    const tierLabel = { free: 'Free', basic: 'Basic', premium: 'Premium' }[subscriptionTier] || 'Free'
    const tierColor = { free: '#ffffff40', basic: '#00E6FF', premium: '#7B61FF' }[subscriptionTier]

    return (
        <>
            {/* Modals */}
            <AnimatePresence>
                {showSettings && (
                    <ProfileModal
                        initial={editTarget}
                        onSave={handleSaveProfile}
                        onClose={() => { setShowSettings(false); setEditTarget(null) }}
                    />
                )}
            </AnimatePresence>

            {/* Trigger */}
            <div ref={dropRef} className="relative">
                <button
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/20 transition-all"
                >
                    {active ? (
                        <Avatar profile={active} size={8} ring />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-[#7B61FF]/30 flex items-center justify-center">
                            <User size={14} className="text-[#7B61FF]" />
                        </div>
                    )}
                    <div className="hidden sm:block text-left">
                        <p className="text-white text-xs font-bold leading-tight">{active?.name || user?.username || 'Profile'}</p>
                        <p className="text-[10px] leading-tight font-bold uppercase tracking-widest" style={{ color: tierColor }}>
                            {tierLabel}
                        </p>
                    </div>
                    <ChevronDown size={14} className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {/* Central Modal */}
                <AnimatePresence>
                    {open && (
                        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[200]">
                            {/* Clickable backdrop */}
                            <div className="absolute inset-0" onClick={() => setOpen(false)} />
                            
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                                transition={{ duration: 0.18 }}
                                className="relative w-80 max-w-[90vw] bg-[#0d0d0d] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-[210]"
                            >
                                <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-white/30 hover:text-white z-10"><X size={16}/></button>
                            {/* Account header */}
                            <div className="px-4 pt-4 pb-3 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    {active && <Avatar profile={active} size={10} ring />}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold text-sm truncate">{user?.username}</p>
                                        <p className="text-white/30 text-xs truncate">{user?.email || 'CYMAX Account'}</p>
                                    </div>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                                        style={{ background: tierColor + '20', color: tierColor, border: `1px solid ${tierColor}40` }}>
                                        {subscriptionTier === 'premium' && <Crown size={9}/>}
                                        {tierLabel}
                                    </div>
                                </div>
                            </div>

                            {/* Profile list */}
                            <div className="px-2 py-2">
                                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-2 py-1">Switch Profile</p>
                                {profiles.map(profile => (
                                    <div key={profile.id}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group transition-all
                                                    ${activeProfile?.id === profile.id ? 'bg-white/8 border border-white/10' : 'hover:bg-white/5'}`}
                                        onClick={() => handleSwitch(profile)}
                                    >
                                        <Avatar profile={profile} size={8} ring={activeProfile?.id === profile.id} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-semibold truncate">{profile.name}</p>
                                            <p className="text-white/30 text-[10px] capitalize">{profile.type} profile</p>
                                        </div>
                                        {/* Edit/Delete */}
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={e => { e.stopPropagation(); setEditTarget(profile); setShowSettings(true) }}
                                                className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
                                                <Edit2 size={12}/>
                                            </button>
                                            {!profile.isOwner && (
                                                <button onClick={e => { e.stopPropagation(); handleDelete(profile.id) }}
                                                    className="p-1 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400">
                                                    <Trash2 size={12}/>
                                                </button>
                                            )}
                                        </div>
                                        {activeProfile?.id === profile.id && (
                                            <Check size={13} className="text-[#00E6FF] shrink-0"/>
                                        )}
                                    </div>
                                ))}

                                {/* Add profile */}
                                {profiles.length < 5 && (
                                    <button
                                        onClick={() => { setEditTarget(null); setShowSettings(true) }}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 w-full transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                                            <Plus size={14}/>
                                        </div>
                                        <span className="text-sm">Add Profile</span>
                                    </button>
                                )}
                            </div>

                            {/* Footer actions */}
                            <div className="border-t border-white/5 px-2 py-2 space-y-0.5">
                                <button
                                    onClick={() => { navigate('/subscription'); setOpen(false) }}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 w-full transition-all text-sm"
                                >
                                    <Crown size={15} className="text-[#7B61FF]"/> Manage Subscription
                                </button>
                                <button
                                    onClick={() => { logout(); navigate('/login') }}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 w-full transition-all text-sm"
                                >
                                    <LogOut size={15}/> Sign Out
                                </button>
                            </div>
                        </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </>
    )
}
