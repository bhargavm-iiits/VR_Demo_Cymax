import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Grid, List } from 'lucide-react'
import Navbar from '../components/Navbar'
import MovieCard from '../components/MovieCard'
import Notification from '../components/Notification'
import useStore from '../store/useStore'
import useSocket from '../hooks/useSocket'
import { moviesAPI } from '../api/axios'
import BackButton from '../components/BackButton'

export default function Movies() {
    const { movies, setMovies } = useStore()
    const [search, setSearch] = useState('')
    const [genre, setGenre] = useState('All')
    const [filter, setFilter] = useState('all')  // all | accessible | locked
    const [loading, setLoading] = useState(true)
    useSocket()

    useEffect(() => {
        moviesAPI.list()
            .then(r => setMovies(r.data.movies || []))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const genres = ['All', ...new Set(movies.map(m => m.genre).filter(Boolean))]

    const filtered = movies.filter(m => {
        const matchSearch = m.title.toLowerCase().includes(search.toLowerCase())
        const matchGenre = genre === 'All' || m.genre === genre
        const matchFilter =
            filter === 'all' ? true :
                filter === 'accessible' ? m.is_accessible :
                    !m.is_accessible
        return matchSearch && matchGenre && matchFilter
    })

    return (
        <div className="min-h-screen bg-bg noise">
            <div className="blob w-96 h-96 bg-[#7B61FF] top-0 right-0 opacity-8" />
            <Navbar />
            <Notification />

            <div className="max-w-7xl mx-auto px-6 pt-28 pb-16">
                <div className="mb-8">
                    <BackButton />
                </div>

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <h1 className="text-4xl md:text-5xl font-black mb-3">
                        <span className="text-white">Movie </span>
                        <span className="gradient-text">Catalog</span>
                    </h1>
                    <p className="text-[#A0A0A0]">
                        {movies.filter(m => m.is_accessible).length} movies available
                        · {movies.filter(m => !m.is_accessible).length} locked
                    </p>
                </motion.div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">

                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
                        <input
                            type="text"
                            placeholder="Search movies..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full glass border border-white/10 rounded-xl
                         pl-11 pr-4 py-3 text-white text-sm
                         placeholder-[#A0A0A0] focus:outline-none
                         focus:border-[#7B61FF]/50 transition-all"
                        />
                    </div>

                    {/* Genre filter */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {genres.slice(0, 6).map(g => (
                            <button
                                key={g}
                                onClick={() => setGenre(g)}
                                className={`px-4 py-2.5 rounded-xl text-sm font-medium
                            whitespace-nowrap transition-all
                            ${genre === g
                                        ? 'btn-primary text-white'
                                        : 'glass border border-white/10 text-[#A0A0A0] hover:text-white'
                                    }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>

                    {/* Access filter */}
                    <div className="flex gap-2">
                        {[
                            { val: 'all', label: 'All' },
                            { val: 'accessible', label: 'Unlocked' },
                            { val: 'locked', label: 'Locked' },
                        ].map(({ val, label }) => (
                            <button
                                key={val}
                                onClick={() => setFilter(val)}
                                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                            ${filter === val
                                        ? 'bg-white/10 text-white border border-white/20'
                                        : 'text-[#A0A0A0] hover:text-white'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="glass rounded-2xl aspect-[2/3] animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filtered.map((movie, i) => (
                            <MovieCard key={movie.id} movie={movie} index={i} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <p className="text-4xl mb-4">🎬</p>
                        <p className="text-white font-semibold mb-2">No movies found</p>
                        <p className="text-[#A0A0A0] text-sm">Try adjusting your search or filters</p>
                    </div>
                )}
            </div>
        </div>
    )
}
