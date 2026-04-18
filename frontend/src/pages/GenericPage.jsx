import { motion } from 'framer-motion'
import { useParams, useLocation } from 'react-router-dom'
import BackButton from '../components/BackButton'

export default function GenericPage() {
    const location = useLocation()
    const pathName = location.pathname.split('/')[1] || 'Page'
    const title = pathName.charAt(0).toUpperCase() + pathName.slice(1)

    return (
        <div className="w-full min-h-screen text-white pt-2 px-2 pb-10 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-6 left-6 z-20">
                <BackButton />
            </div>
            {/* 3D Wireframe / Particle background mockup */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{
                backgroundImage: 'radial-gradient(#7B61FF 1px, transparent 1px), radial-gradient(#00D1FF 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 10px 10px',
                perspective: '1000px',
                transform: 'rotateX(60deg) scale(2) translateY(-100px)'
            }} />
            
            <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative z-10 glass p-12 text-center rounded-[3rem] border border-white/10 shadow-[0_0_50px_rgba(123,97,255,0.2)]"
            >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-3xl">🚀</span>
                </div>
                <h1 className="text-5xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    {title} Module
                </h1>
                <p className="text-gray-400 max-w-md mx-auto text-sm leading-relaxed">
                    This section of the CYMAX interactive portfolio is currently being rendered. 
                    Expect high-fidelity immersive 3D content to drop here soon.
                </p>
                <button className="mt-8 bg-white/10 hover:bg-white/20 transition-colors px-8 py-3 rounded-full font-bold border border-white/20">
                    Notify Me
                </button>
            </motion.div>
        </div>
    )
}
