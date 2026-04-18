import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
    ArrowLeft, CheckCircle, Landmark, QrCode, Shield, Loader2, XCircle
} from 'lucide-react'
import useStore from '../store/useStore'
import { getPlanById } from '../data/plans'

// ── CONFIG ───────────────────────
const UPI_ID   = 'cymax.vr@upi'
const UPI_NAME = 'CYMAX VR Cinema'

const buildUpiUrl = (amount, note) =>
    `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`

const isMobileDevice = () =>
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

const openCenteredWindow = (url, title = 'Payment Provider') => {
    const width = 520
    const height = 760
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))
    const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    return window.open(url, title, features)
}

const getUpiTarget = (methodId, amount, note) => {
    const query = `pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`
    const genericUrl = `upi://pay?${query}`

    const methodTargets = {
        phonepe: {
            appUrl: `phonepe://pay?${query}`,
            webUrl: 'https://www.phonepe.com/how-to-pay/pay-by-phonepe/web/',
        },
        gpay: {
            appUrl: `tez://upi/pay?${query}`,
            webUrl: 'https://pay.google.com/intl/en_us/about/pay-online/',
        },
        amazonpay: {
            appUrl: genericUrl,
            webUrl: 'https://www.amazon.in/amazonpay/home',
        },
        paytm: {
            appUrl: `paytmmp://pay?${query}`,
            webUrl: 'https://paytm.com/',
        },
    }

    return {
        genericUrl,
        ...(methodTargets[methodId] || { appUrl: genericUrl, webUrl: '' }),
    }
}


const PAYMENT_METHODS = [
    {
        id: 'phonepe',
        name: 'PhonePe',
        color: '#5f259f',
        icon: '/payment-icons/phonepay.png',
        type: 'upi'
    },
    {
        id: 'gpay',
        name: 'Google Pay',
        color: '#4285F4',
        icon: '/payment-icons/gpay.png',
        type: 'upi'
    },
    {
        id: 'amazonpay',
        name: 'Amazon Pay',
        color: '#FF9900',
        icon: '/payment-icons/amazonpay.png',
        type: 'upi'
    },
    {
        id: 'paytm',
        name: 'Paytm',
        color: '#002970',
        icon: '/payment-icons/paytm.png',
        type: 'upi'
    },
    {
        id: 'bank',
        name: 'Bank Transfer',
        color: '#3B82F6',
        iconComponent: Landmark,
        type: 'bank'
    }
]

function Toast({ message, type, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000)
        return () => clearTimeout(timer)
    }, [onClose])

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full flex items-center gap-3 backdrop-blur-md shadow-2xl z-50 text-sm font-bold tracking-wide border
                ${type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-100' : 'bg-green-500/10 border-green-500/20 text-green-100'}`}
        >
            {type === 'error' ? <XCircle size={18} className="text-red-400"/> : <CheckCircle size={18} className="text-green-400"/>}
            {message}
        </motion.div>
    )
}

export default function Payment() {
    const location  = useLocation()
    const navigate  = useNavigate()
    const { setSubscriptionTier, token } = useStore()

    const planId = location.state?.planId
    const annual = location.state?.annual ?? false
    const plan   = planId ? getPlanById(planId) : null

    const [selectedMethod, setSelectedMethod] = useState(null)
    const [status, setStatus] = useState('selection') // 'selection' | 'redirecting' | 'awaiting_verification' | 'success' | 'failure'
    const [toast, setToast] = useState(null)
    const [showQr, setShowQr] = useState(false)

    // Bank Form State
    const [bankForm, setBankForm] = useState({ name: '', account: '', ifsc: '', bankName: '' })

    useEffect(() => {
        if (!token)  { navigate('/login');        return }
        if (!planId) { navigate('/subscription'); return }
    }, [token, planId, navigate])

    if (!plan) return null

    const amount = plan.price === 0 ? 0 : annual
        ? (plan.price * 10).toFixed(2)
        : plan.price.toFixed(2)

    const note  = `CYMAX ${plan.name} ${annual ? 'Annual' : 'Monthly'}`
    const upiUrl = buildUpiUrl(amount, note)

    const TIER_COLORS = { free: '#ffffff80', basic: '#00E6FF', premium: '#7B61FF' }
    const accentColor = TIER_COLORS[plan.id] || '#00E6FF'
    const amountInInr = (parseFloat(amount) * 83).toFixed(0)

    const handleFreeActivate = () => {
        setStatus('redirecting')
        setTimeout(() => {
            setSubscriptionTier('free')
            setStatus('success')
            setTimeout(() => navigate('/dashboard'), 2500)
        }, 1500)
    }

    const validateBankForm = () => {
        if (!bankForm.name.trim()) return 'Account Holder Name is required.'
        if (!bankForm.account.trim() || bankForm.account.length < 8) return 'Enter a valid Account Number.'
        if (!bankForm.ifsc.trim() || bankForm.ifsc.length < 11) return 'Enter a valid 11-character IFSC Code.'
        if (!bankForm.bankName.trim()) return 'Bank Name is required.'
        return null
    }

    const persistPendingPayment = () => {
        sessionStorage.setItem('cymax_pending_payment', JSON.stringify({
            planId,
            annual,
            methodId: selectedMethod?.id || null,
            amount,
        }))
    }

    const clearPendingPayment = () => {
        sessionStorage.removeItem('cymax_pending_payment')
    }

    const handlePaymentSuccess = () => {
        clearPendingPayment()
        setSubscriptionTier(plan.id)
        setStatus('success')
        setTimeout(() => navigate('/dashboard'), 3000)
    }

    const handlePaymentFailure = () => {
        clearPendingPayment()
        setStatus('failure')
        setToast({ message: 'Payment failed. Please try again.', type: 'error' })
    }

    useEffect(() => {
        const pending = sessionStorage.getItem('cymax_pending_payment')
        if (!pending || status !== 'selection') return

        try {
            const parsed = JSON.parse(pending)
            if (parsed?.planId === planId) {
                const method = PAYMENT_METHODS.find(item => item.id === parsed.methodId) || null
                if (method) setSelectedMethod(method)
                setStatus('awaiting_verification')
            } else {
                clearPendingPayment()
            }
        } catch {
            clearPendingPayment()
        }
    }, [planId, status])

    const handleProceed = () => {
        if (!selectedMethod) {
            setToast({ message: 'Please select a payment method', type: 'error' })
            return
        }

        if (selectedMethod.type === 'bank') {
            const error = validateBankForm()
            if (error) {
                setToast({ message: error, type: 'error' })
                return
            }
        }

        persistPendingPayment()
        setStatus('redirecting')

        if (selectedMethod.type === 'upi' && !showQr) {
            const { appUrl, genericUrl, webUrl } = getUpiTarget(selectedMethod.id, amount, note)

            if (isMobileDevice()) {
                window.location.href = appUrl
                setTimeout(() => {
                    window.location.href = webUrl || genericUrl
                }, 900)
            } else {
                const popup = openCenteredWindow(webUrl || genericUrl, `${selectedMethod.name} Payment`)
                if (!popup) {
                    window.location.href = webUrl || genericUrl
                }
            }
        }
        
        setTimeout(() => {
            setStatus('awaiting_verification')
        }, 1200)
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden font-sans">
            {/* Ambient blobs */}
            <div className="fixed w-[600px] h-[600px] rounded-full opacity-[0.05] blur-[100px] -top-60 left-1/2 -translate-x-1/2 pointer-events-none"
                style={{ background: accentColor }}/>
            
            <AnimatePresence>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </AnimatePresence>

            <div className="max-w-xl mx-auto px-5 py-14 relative z-10">

                {status === 'selection' && (
                    <motion.button onClick={() => navigate('/subscription')}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-white/40 hover:text-white text-sm font-bold mb-8 transition-colors">
                        <ArrowLeft size={16}/> Back to Plans
                    </motion.button>
                )}

                <AnimatePresence mode="wait">

                    {/* ── STEP 1: Selection ─────────────────────── */}
                    {status === 'selection' && (
                        <motion.div
                            key="selection"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {/* Summary Card */}
                            <div className="bg-white/[0.02] rounded-2xl p-6 mb-8 flex flex-col items-center text-center shadow-lg backdrop-blur-md">
                                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Total Amount</p>
                                <p className="text-4xl font-black mb-1" style={{ color: accentColor }}>
                                    {plan.price === 0 ? 'FREE' : `₹${(parseFloat(amount) * 83).toFixed(0)}`}
                                </p>
                                {plan.price > 0 && <p className="text-white/30 text-xs mb-4">(~${amount} USD)</p>}
                                <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs font-bold text-white/70">
                                    CYMAX {plan.name} • {annual ? 'Annually' : 'Monthly'}
                                </div>
                            </div>

                            {plan.price === 0 ? (
                                <div className="text-center py-10">
                                    <button onClick={handleFreeActivate}
                                        className="px-10 py-4 bg-gradient-to-r from-white/10 to-white/20 border border-white/10 rounded-xl font-black text-white text-sm uppercase tracking-widest hover:bg-white/25 transition-all flex items-center gap-2 mx-auto">
                                        <CheckCircle size={16}/> Activate Free Plan
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-bold text-white/70">Payment Method</h3>
                                        <button onClick={() => setShowQr(!showQr)} 
                                            className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors
                                            ${showQr ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
                                            <QrCode size={14}/> {showQr ? 'Hide QR' : 'Show UPI QR'}
                                        </button>
                                    </div>

                                    {/* Tiles */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        {PAYMENT_METHODS.map(method => {
                                            const isSelected = selectedMethod?.id === method.id
                                            return (
                                                <button key={method.id}
                                                    onClick={() => {
                                                        setSelectedMethod(method)
                                                        setShowQr(false)
                                                    }}
                                                    className={`relative overflow-hidden flex flex-col items-center justify-center gap-3 p-5 rounded-xl transition-all duration-300
                                                        ${isSelected 
                                                            ? 'bg-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)]' 
                                                            : 'bg-white/[0.04] hover:bg-white/[0.07] hover:shadow-md opacity-90 hover:opacity-100'}
                                                    `}
                                                >
                                                    {isSelected && (
                                                        <motion.div layoutId="outline"
                                                            className="absolute inset-0 rounded-xl border-2 pointer-events-none"
                                                            style={{ borderColor: accentColor }}
                                                            initial={false}
                                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                        />
                                                    )}
                                                    <div className={`w-24 h-24 mx-auto flex items-center justify-center rounded-2xl overflow-hidden transition-all
                                                        ${isSelected ? 'shadow-[0_0_24px_rgba(255,255,255,0.08)]' : ''}
                                                    `}>
                                                        {method.iconComponent ? (
                                                            <div className="w-full h-full rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                                                                <method.iconComponent size={30} className="text-white/90"/>
                                                            </div>
                                                        ) : (
                                                            <img
                                                                src={method.icon}
                                                                alt={method.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}
                                                    </div>
                                                    <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-white/80'}`}>
                                                        {method.name}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Expandable Sections */}
                                    <AnimatePresence>
                                        {showQr && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
                                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 flex flex-col items-center text-center">
                                                    <div className="p-3 bg-white rounded-xl shadow-lg mb-4">
                                                        <QRCodeSVG value={upiUrl} size={150} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin={false}/>
                                                    </div>
                                                    <p className="text-xs text-white/50 mb-1">Scan to pay with any UPI App</p>
                                                    <p className="text-sm font-bold">{UPI_ID}</p>
                                                    <button onClick={() => {
                                                        navigator.clipboard.writeText(UPI_ID)
                                                        setToast({ message: 'UPI ID copied!', type: 'success' })
                                                    }} className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition">Copy UPI ID</button>
                                                </div>
                                            </motion.div>
                                        )}

                                        {selectedMethod?.type === 'bank' && !showQr && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
                                                <div className="bg-white/[0.04] rounded-2xl p-5 space-y-4">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Transfer Details</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] text-white/40 uppercase mb-1.5 pl-1">Holder Name</label>
                                                            <input type="text" value={bankForm.name} onChange={e => setBankForm({...bankForm, name: e.target.value})} className="w-full bg-black/40 border-none rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder-white/20 text-white" placeholder="John Doe"/>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-white/40 uppercase mb-1.5 pl-1">Account Number</label>
                                                            <input type="text" value={bankForm.account} onChange={e => setBankForm({...bankForm, account: e.target.value.replace(/\D/g, '')})} className="w-full bg-black/40 border-none rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder-white/20 text-white" placeholder="000123456789"/>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-white/40 uppercase mb-1.5 pl-1">IFSC Code</label>
                                                            <input type="text" value={bankForm.ifsc} onChange={e => setBankForm({...bankForm, ifsc: e.target.value.toUpperCase()})} maxLength={11} className="w-full bg-black/40 border-none rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder-white/20 text-white" placeholder="BANK0001234"/>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-white/40 uppercase mb-1.5 pl-1">Bank Name</label>
                                                            <input type="text" value={bankForm.bankName} onChange={e => setBankForm({...bankForm, bankName: e.target.value})} className="w-full bg-black/40 border-none rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-white/20 transition-all placeholder-white/20 text-white" placeholder="State Bank of India"/>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button 
                                        onClick={handleProceed}
                                        disabled={!selectedMethod && !showQr}
                                        className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group"
                                        style={{ background: selectedMethod ? accentColor : '#333', color: plan.id === 'basic' && selectedMethod ? '#000' : '#fff' }}
                                    >
                                        <span className="flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
                                            Proceed to Pay
                                        </span>
                                    </button>

                                    <div className="flex items-center justify-center gap-2 mt-6 text-white/30 text-[10px] font-bold uppercase tracking-wider">
                                        <Shield size={12}/> Secure Payment Gateway
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ── STEP 2: Redirecting ─────────────────────── */}
                    {status === 'redirecting' && (
                        <motion.div
                            key="redirecting"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-20 text-center"
                        >
                            <Loader2 size={48} className="animate-spin mb-6" style={{ color: accentColor }}/>
                            <h3 className="text-xl font-bold mb-2">Processing Payment</h3>
                            <p className="text-sm text-white/50 mb-6 max-w-[280px]">
                                {selectedMethod?.type === 'upi' ? "Redirecting securely to your UPI app. Do not refresh this page." : "Verifying your bank details. Please hold on."}
                            </p>
                        </motion.div>
                    )}

                    {/* ── STEP 3: Success ─────────────────────────── */}
                    {status === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-16"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                                className="w-24 h-24 mx-auto mb-7 rounded-full flex items-center justify-center"
                                style={{ background: accentColor + '20', boxShadow: `0 0 60px ${accentColor}40` }}
                            >
                                <CheckCircle size={40} style={{ color: accentColor }}/>
                            </motion.div>
                            <h2 className="text-3xl font-black text-white mb-3">
                                Payment Successful!
                            </h2>
                            <p className="text-white/60 text-sm mb-6">You are now subscribed to <span style={{ color: accentColor }} className="font-bold">{plan.name}</span>.</p>
                            
                            <div className="bg-white/5 rounded-xl p-4 max-w-[240px] mx-auto text-left mb-8 backdrop-blur-sm">
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-white/40">Amount Paid</span>
                                    <span className="font-bold text-white">₹{(parseFloat(amount) * 83).toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Reference ID</span>
                                    <span className="font-mono text-white/80">{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                                </div>
                            </div>

                            <p className="text-white/30 text-xs flex items-center justify-center gap-2">
                                <Loader2 size={12} className="animate-spin"/> Redirecting to dashboard…
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
