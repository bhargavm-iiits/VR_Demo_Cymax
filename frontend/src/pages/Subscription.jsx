import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Zap, Crown, Gift, ArrowRight, Headphones, Shield, Infinity, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { PLANS } from '../data/plans'
import BackButton from '../components/BackButton'

// Map plan id → icon (JSX only lives here, never serialized)
const PLAN_ICONS = {
    free:    <Gift size={22} />,
    basic:   <Zap  size={22} />,
    premium: <Crown size={22} />,
}

const FAQS = [
    { q: 'Can I switch plans anytime?',     a: 'Yes — upgrade, downgrade or cancel at any time. Changes take effect immediately.' },
    { q: 'What VR headsets are supported?', a: 'CYMAX works with Meta Quest 2/3/Pro, Pico 4, Apple Vision Pro, and any WebXR-compatible device.' },
    { q: 'How is content protected?',       a: 'All streams use AES-256-CBC encryption with time-limited JWT tokens. Content is never downloaded unencrypted.' },
    { q: 'Is there a family plan?',         a: 'Premium allows unlimited devices on a single account — perfect for households. Team plans coming in Q3 2026.' },
]

export default function Subscription() {
    const [annual,  setAnnual]  = useState(false)
    const [openFaq, setOpenFaq] = useState(null)
    const [hovered, setHovered] = useState(null)
    const { token }             = useStore()
    const navigate              = useNavigate()

    const getPrice = (base) => {
        if (base === 0) return '0'
        return annual ? (base * 10).toFixed(2) : base.toFixed(2)
    }

    // ✅ Only pass the plan ID — no JSX in navigation state
    const handleSelect = (plan) => {
        if (!token) { navigate('/login'); return }
        navigate('/payment', { state: { planId: plan.id, annual } })
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden">

            {/* Ambient blobs */}
            <div className="fixed w-[800px] h-[800px] rounded-full bg-[#7B61FF] opacity-[0.05] blur-[150px] -top-80 left-1/2 -translate-x-1/2 pointer-events-none" />
            <div className="fixed w-[500px] h-[500px] rounded-full bg-[#00E6FF] opacity-[0.04] blur-[120px] bottom-0 right-0 pointer-events-none" />

            <div className="max-w-6xl mx-auto px-6 py-20">
                <div className="mb-8">
                    <BackButton />
                </div>

                {/* ── Header ─────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
                    <div className="flex items-center justify-center gap-3 mb-8">
                        <img src="/cymax_logo_icon.png" alt="CYMAX" className="w-12 h-12 rounded-xl object-cover" />
                        <span className="text-white font-black text-xl tracking-tight">CYMAX</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
                        Choose Your{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00E6FF] via-[#7B61FF] to-[#ff3366]">
                            Experience
                        </span>
                    </h1>
                    <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed">
                        Unlock the full potential of VR cinema. Cancel anytime.
                    </p>

                    {/* Billing toggle */}
                    <div className="flex items-center justify-center gap-4 mt-8">
                        <span className={`text-sm font-bold transition-colors ${!annual ? 'text-white' : 'text-white/40'}`}>Monthly</span>
                        <button
                            onClick={() => setAnnual(a => !a)}
                            className={`w-14 h-7 rounded-full transition-all duration-300 ${annual ? 'bg-[#7B61FF]' : 'bg-white/10'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white shadow-md mx-1 transform transition-transform duration-300 ${annual ? 'translate-x-7' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-sm font-bold transition-colors ${annual ? 'text-white' : 'text-white/40'}`}>
                            Annual
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-400/15 text-green-400 border border-green-400/20">
                                Save 17%
                            </span>
                        </span>
                    </div>
                </motion.div>

                {/* ── Pricing Cards ───────────────────────────────── */}
                <div className="grid md:grid-cols-3 gap-6 mb-20">
                    {PLANS.map((plan, i) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onMouseEnter={() => setHovered(plan.id)}
                            onMouseLeave={() => setHovered(null)}
                            className="relative rounded-3xl p-7 border flex flex-col transition-all duration-300 cursor-pointer"
                            style={{
                                background: `radial-gradient(ellipse at top, ${plan.glow}, transparent 60%), rgba(255,255,255,0.03)`,
                                borderColor: hovered === plan.id ? plan.accent : plan.border,
                                transform: hovered === plan.id ? 'scale(1.02)' : 'scale(1)',
                                boxShadow: hovered === plan.id ? `0 0 48px ${plan.glow}` : 'none',
                            }}
                        >
                            {/* Badge */}
                            {plan.badge && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                    <span
                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full text-black"
                                        style={{ background: plan.accent, boxShadow: `0 0 16px ${plan.glow}` }}
                                    >
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            {/* Icon + name */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-11 h-11 rounded-2xl flex items-center justify-center border"
                                    style={{ borderColor: plan.border, background: plan.glow, color: plan.accent }}>
                                    {PLAN_ICONS[plan.id]}
                                </div>
                                <h2 className="text-xl font-black text-white">{plan.name}</h2>
                            </div>

                            {/* Price */}
                            <div className="mb-7">
                                <div className="flex items-end gap-1">
                                    <span className="text-white/40 text-xl font-bold">$</span>
                                    <span className="text-5xl font-black leading-none" style={{ color: plan.price > 0 ? plan.accent : 'white' }}>
                                        {getPrice(plan.price)}
                                    </span>
                                    {plan.price > 0 && (
                                        <span className="text-white/40 text-sm mb-1">/{annual ? 'yr' : 'mo'}</span>
                                    )}
                                </div>
                                {plan.price === 0 && <p className="text-white/30 text-sm mt-1">Always free, no card needed</p>}
                                {plan.price > 0 && annual && (
                                    <p className="text-green-400/70 text-xs mt-1">
                                        was ${(plan.price * 12).toFixed(2)}/yr — saving ${(plan.price * 2).toFixed(2)}
                                    </p>
                                )}
                            </div>

                            {/* Features */}
                            <ul className="space-y-2.5 flex-1 mb-8">
                                {plan.features.map((f, j) => (
                                    <li key={j} className={`flex items-center gap-2.5 text-sm ${f.ok ? 'text-white/80' : 'text-white/25 line-through'}`}>
                                        {f.ok
                                            ? <Check size={14} className="shrink-0" style={{ color: plan.accent }} />
                                            : <X size={14} className="shrink-0 text-white/20" />
                                        }
                                        {f.text}
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <button
                                onClick={() => handleSelect(plan)}
                                className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2 hover:opacity-90 active:scale-95"
                                style={{
                                    background: plan.price === 0
                                        ? 'rgba(255,255,255,0.07)'
                                        : `linear-gradient(135deg, ${plan.accent}bb, ${plan.accent})`,
                                    color: plan.price === 0 ? 'rgba(255,255,255,0.6)' : plan.id === 'basic' ? '#000' : '#fff',
                                    border: `1px solid ${plan.border}`,
                                    boxShadow: plan.price > 0 ? `0 0 24px ${plan.glow}` : 'none',
                                }}
                            >
                                {plan.cta} <ArrowRight size={14} />
                            </button>
                        </motion.div>
                    ))}
                </div>

                {/* ── Trust row ───────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-center gap-8 mb-20 border-y border-white/5 py-8">
                    {[
                        { icon: <Shield size={16} />,     text: 'AES-256 Encrypted'   },
                        { icon: <Headphones size={16} />, text: 'Headset Compatible'  },
                        { icon: <Infinity size={16} />,   text: 'No Contract Lock-in' },
                        { icon: <Zap size={16} />,        text: 'Instant Activation'  },
                    ].map(({ icon, text }) => (
                        <div key={text} className="flex items-center gap-2 text-white/30 text-sm">
                            <span className="text-white/20">{icon}</span>
                            {text}
                        </div>
                    ))}
                </div>

                {/* ── FAQ ─────────────────────────────────────────── */}
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-2xl font-black text-white text-center mb-8 uppercase tracking-widest">FAQ</h2>
                    <div className="space-y-3">
                        {FAQS.map((faq, i) => (
                            <div key={i}
                                className="border border-white/[0.08] rounded-2xl overflow-hidden bg-white/[0.02] cursor-pointer hover:border-white/15 transition-colors"
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                            >
                                <div className="flex items-center justify-between px-6 py-4">
                                    <p className="text-white/80 text-sm font-semibold pr-4">{faq.q}</p>
                                    <span className={`text-white/40 text-xl font-light shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                                </div>
                                <AnimatePresence initial={false}>
                                    {openFaq === i && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="px-6 pb-5 text-white/40 text-sm leading-relaxed border-t border-white/5 pt-3">
                                                {faq.a}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-center text-white/20 text-xs mt-16 uppercase tracking-widest">
                    © 2026 CYMAX VR Cinema · Secure Streaming Platform
                </p>
            </div>
        </div>
    )
}
