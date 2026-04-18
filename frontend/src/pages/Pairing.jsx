import { Suspense, lazy } from 'react'
import { motion } from 'framer-motion'
import { Monitor, Smartphone, ArrowRight } from 'lucide-react'
import Navbar from '../components/Navbar'
import PairingStatus from '../components/PairingStatus'
import Notification from '../components/Notification'
import useSocket from '../hooks/useSocket'

const Scene = lazy(() => import('../three/Scene'))

const steps = [
    { n: '01', title: 'Open VR App', desc: 'Launch the VR Cinema app on your headset' },
    { n: '02', title: 'Navigate to Pairing', desc: 'Go to Settings → Pair with Controller' },
    { n: '03', title: 'Generate Code', desc: 'Click "Generate Pairing Code" below' },
    { n: '04', title: 'Enter Code in VR', desc: 'Type the 6-character code shown below' },
    { n: '05', title: 'Enjoy!', desc: 'Control your VR headset from this screen' },
]

export default function Pairing() {
    useSocket()

    return (
        <div className="min-h-screen bg-bg noise">
            <div className="blob w-96 h-96 bg-[#7B61FF] top-20 left-10 opacity-10" />
            <div className="blob w-96 h-96 bg-[#00D1FF] bottom-20 right-10 opacity-8"
                style={{ animationDelay: '-5s' }} />
            <Navbar />
            <Notification />

            <div className="max-w-5xl mx-auto px-6 pt-28 pb-16">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-14"
                >
                    <h1 className="text-4xl md:text-6xl font-black mb-4">
                        <span className="text-white">Connect Your </span>
                        <span className="gradient-text">VR Headset</span>
                    </h1>
                    <p className="text-[#A0A0A0] text-lg max-w-md mx-auto">
                        One controller, one headset. Secure 1:1 pairing with
                        cryptographically random codes.
                    </p>
                </motion.div>

                {/* Device illustration */}
                <div className="flex items-center justify-center gap-8 mb-14">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass rounded-3xl p-8 flex flex-col items-center gap-3"
                    >
                        <div className="w-16 h-16 btn-primary rounded-2xl
                            flex items-center justify-center animate-glow">
                            <Smartphone size={28} />
                        </div>
                        <span className="text-white font-semibold text-sm">Web Controller</span>
                        <span className="text-[#A0A0A0] text-xs">Your browser</span>
                    </motion.div>

                    <motion.div
                        animate={{ x: [0, 10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        <ArrowRight size={32} className="gradient-text" />
                    </motion.div>

                    {/* 3D sphere */}
                    <div className="w-32 h-32">
                        <Suspense fallback={
                            <div className="w-32 h-32 rounded-full btn-primary animate-pulse" />
                        }>
                            <Scene simple />
                        </Suspense>
                    </div>

                    <motion.div
                        animate={{ x: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        <ArrowRight size={32} className="gradient-text rotate-180" />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass rounded-3xl p-8 flex flex-col items-center gap-3"
                    >
                        <div className="w-16 h-16 bg-[#00D1FF]/20 border border-[#00D1FF]/30
                            rounded-2xl flex items-center justify-center">
                            <Monitor size={28} className="text-[#00D1FF]" />
                        </div>
                        <span className="text-white font-semibold text-sm">VR Headset</span>
                        <span className="text-[#A0A0A0] text-xs">Quest / Pico / etc.</span>
                    </motion.div>
                </div>

                {/* Main grid */}
                <div className="grid lg:grid-cols-2 gap-8">

                    {/* Steps */}
                    <div className="space-y-4">
                        <h2 className="text-white font-bold text-lg mb-6">How to Pair</h2>
                        {steps.map(({ n, title, desc }, i) => (
                            <motion.div
                                key={n}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex gap-4 glass rounded-2xl p-4"
                            >
                                <span className="gradient-text font-black text-lg w-8 shrink-0">{n}</span>
                                <div>
                                    <p className="text-white font-semibold text-sm">{title}</p>
                                    <p className="text-[#A0A0A0] text-xs mt-0.5">{desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Pairing widget */}
                    <div>
                        <h2 className="text-white font-bold text-lg mb-6">Pairing Status</h2>
                        <PairingStatus />
                    </div>
                </div>
            </div>
        </div>
    )
}
