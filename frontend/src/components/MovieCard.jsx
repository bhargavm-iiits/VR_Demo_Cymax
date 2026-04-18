import { motion } from 'framer-motion'
import { Play, Lock, Clock, Star, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

export default function MovieCard({ movie, index }) {
    const navigate = useNavigate()
    const { setSelectedMovie } = useStore()

    const isLocked = !movie.is_accessible

    const tierColors = {
        free: 'text-green-400 bg-green-500/10 border-green-500/20',
        basic: 'text-blue-400  bg-blue-500/10  border-blue-500/20',
        premium: 'text-[#7B61FF] bg-[#7B61FF]/10 border-[#7B61FF]/20',
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            whileHover={!isLocked ? { y: -8, scale: 1.02 } : {}}
            className="group relative rounded-2xl overflow-hidden
                 border border-white/8 cursor-pointer"
            onClick={() => !isLocked && navigate('/vr-player')}
        >
            {/* Thumbnail */}
            <div className="relative aspect-[2/3] overflow-hidden">
                {movie.thumbnail_url ? (
                    <img
                        src={movie.thumbnail_url}
                        alt={movie.title}
                        className={`w-full h-full object-cover transition-transform
                        duration-500 group-hover:scale-110
                        ${isLocked ? 'blur-sm brightness-50' : ''}`}
                    />
                ) : (
                    <div className={`w-full h-full flex items-center justify-center
                          ${isLocked ? 'opacity-30' : ''}
                          bg-gradient-to-br from-[#7B61FF]/20 to-[#00D1FF]/10`}>
                        <Play size={40} className="text-white/40" />
                    </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t
                        from-black/90 via-black/20 to-transparent" />

                {/* Locked overlay */}
                {isLocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Lock size={28} className="text-white/60 mb-2" />
                        <span className="text-white/60 text-xs font-medium uppercase tracking-wider">
                            {movie.required_subscription} Required
                        </span>
                    </div>
                )}

                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                    {movie.is_360_video && (
                        <span className="text-[10px] font-bold uppercase tracking-wider
                             px-2 py-1 rounded-full
                             bg-[#7B61FF]/20 text-[#7B61FF]
                             border border-[#7B61FF]/30">
                            360°
                        </span>
                    )}
                    <span className={`text-[10px] font-medium uppercase tracking-wider
                           px-2 py-1 rounded-full border
                           ${tierColors[movie.required_subscription] || tierColors.basic}`}>
                        {movie.required_subscription}
                    </span>
                </div>

                {/* Play button on hover */}
                {!isLocked && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ opacity: 1, scale: 1 }}
                        className="absolute inset-0 flex items-center justify-center
                       opacity-0 group-hover:opacity-100 transition-all duration-300"
                    >
                        <div className="w-14 h-14 rounded-full btn-primary
                            flex items-center justify-center
                            shadow-[0_0_30px_rgba(123,97,255,0.6)]">
                            <Play size={20} className="text-white ml-1" />
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Info */}
            <div className="p-4 bg-[#111111]">
                <h3 className={`font-semibold text-sm mb-1 truncate
                        ${isLocked ? 'text-white/40' : 'text-white'}`}>
                    {movie.title}
                </h3>

                <div className="flex items-center gap-3 text-[#A0A0A0] text-xs">
                    <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {movie.duration_minutes}m
                    </span>
                    {movie.genre && (
                        <span className="px-2 py-0.5 rounded-full bg-white/5
                             border border-white/8">
                            {movie.genre}
                        </span>
                    )}
                    <span>{movie.rating}</span>
                </div>

                {/* Secure streaming indicator */}
                {!isLocked && (
                    <div className="flex items-center gap-1 mt-2 text-[10px]
                          text-green-400/60">
                        <Shield size={10} />
                        <span>Secure Stream</span>
                    </div>
                )}
            </div>
        </motion.div>
    )
}