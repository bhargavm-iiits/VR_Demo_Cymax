import { motion } from 'framer-motion'
import { Calendar, Clock, ArrowRight, Tag } from 'lucide-react'

const ARTICLES = [
    {
        id: 1,
        tag: 'Security',
        tagColor: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
        title: 'Why We Replaced bcrypt with Argon2id (OWASP 2024)',
        excerpt: 'passlib and bcrypt were causing compatibility issues with Python 3.11. Here\'s how we switched to argon2-cffi for memory-hard, GPU-resistant password hashing — and why it\'s the OWASP recommended approach for 2024.',
        readTime: '5 min',
        date: 'Mar 28, 2026',
        highlights: ['Memory-hard algorithm', 'GPU-resistant', 'OWASP winner', 'No 72-byte limit'],
    },
    {
        id: 2,
        tag: 'Encryption',
        tagColor: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
        title: 'Content Vault: AES-256-CBC Video Encryption at Scale',
        excerpt: 'How we designed our Content Vault to encrypt video files using AES-256-CBC with per-movie unique keys. Every .ts segment is individually encrypted. The original file is shredded after encryption.',
        readTime: '7 min',
        date: 'Mar 22, 2026',
        highlights: ['Per-movie unique keys', 'IV randomization', 'Key/file separation', 'Vault storage design'],
    },
    {
        id: 3,
        tag: 'Streaming',
        tagColor: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
        title: 'HLS + AES-128: Secure Video Delivery to VR Headsets',
        excerpt: 'HTTP Live Streaming (HLS) lets us deliver adaptive video to any device. Combine it with AES-128 segment encryption and time-limited stream tokens, and you have a production-ready secure delivery pipeline.',
        readTime: '9 min',
        date: 'Mar 15, 2026',
        highlights: ['Adaptive bitrate', 'AES-128 per segment', 'Token-gated key URL', 'No raw file exposure'],
    },
    {
        id: 4,
        tag: 'Authentication',
        tagColor: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
        title: 'JWT HS256 in FastAPI: Stateless Auth for VR Streaming',
        excerpt: 'Building a stateless authentication system using JSON Web Tokens signed with HMAC-SHA256. Every API request carries a self-contained, verifiable identity claim — no session storage required.',
        readTime: '6 min',
        date: 'Mar 8, 2026',
        highlights: ['Stateless design', 'Claim-based identity', 'Subscription tier check', 'WebSocket auth flow'],
    },
    {
        id: 5,
        tag: 'VR Tech',
        tagColor: 'text-green-400 border-green-400/30 bg-green-400/10',
        title: 'Web ↔ VR Headset Pairing: 6-Digit Code Protocol',
        excerpt: 'Our pairing system uses cryptographically random 6-character codes with a 10-minute expiry window. Once paired, the Web Controller and VR Headset communicate bidirectionally via WebSocket for real-time playback sync.',
        readTime: '4 min',
        date: 'Mar 1, 2026',
        highlights: ['36^6 combinations', 'Single-use codes', '10-min expiry', 'WebSocket sync'],
    },
    {
        id: 6,
        tag: 'Architecture',
        tagColor: 'text-[#00E6FF] border-[#00E6FF]/30 bg-[#00E6FF]/10',
        title: 'Temporary Runtime Decryption: Never Write Decrypted Content to Disk',
        excerpt: 'The golden rule of our DRM approach: decrypted video content lives only in memory during the exact duration of playback. The moment the session ends, the buffer is cleared. No local cache. No traceable file.',
        readTime: '8 min',
        date: 'Feb 22, 2026',
        highlights: ['In-memory only', 'No local cache', 'Session lifecycle', 'Buffer clearing'],
    },
]

export default function Blogs() {
    return (
        <div className="w-full min-h-screen pt-12 px-6 lg:px-12 pb-20 overflow-y-auto bg-[#050505] text-white">

            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <h1 className="text-3xl font-black uppercase tracking-widest mb-2">
                    Tech <span className="text-[#00E6FF]">Blog</span>
                </h1>
                <p className="text-white/50 text-sm uppercase tracking-widest">Architecture · Security · VR Streaming Deep Dives</p>
            </motion.div>

            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {ARTICLES.map((article, i) => (
                    <motion.article
                        key={article.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/25 hover:bg-white/8 transition-all cursor-pointer flex flex-col"
                    >
                        {/* Tag */}
                        <span className={`self-start text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${article.tagColor} mb-4 flex items-center gap-1`}>
                            <Tag size={9}/>
                            {article.tag}
                        </span>

                        {/* Title */}
                        <h2 className="text-white font-bold text-lg leading-snug mb-3 group-hover:text-[#00E6FF] transition-colors">
                            {article.title}
                        </h2>

                        {/* Excerpt */}
                        <p className="text-white/50 text-sm leading-relaxed flex-1 mb-4">
                            {article.excerpt}
                        </p>

                        {/* Highlights */}
                        <div className="flex flex-wrap gap-2 mb-5">
                            {article.highlights.map(h => (
                                <span key={h} className="text-[10px] text-white/40 border border-white/10 px-2 py-0.5 rounded-full">
                                    {h}
                                </span>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-white/10">
                            <div className="flex items-center gap-3 text-xs text-white/30">
                                <span className="flex items-center gap-1"><Calendar size={10}/>{article.date}</span>
                                <span className="flex items-center gap-1"><Clock size={10}/>{article.readTime}</span>
                            </div>
                            <span className="flex items-center gap-1 text-xs text-[#00E6FF] group-hover:gap-2 transition-all">
                                Read <ArrowRight size={12}/>
                            </span>
                        </div>
                    </motion.article>
                ))}
            </div>
        </div>
    )
}
