// Analytics Store — Real localStorage tracking for VR Cinema
// Tracks: play events, watch time, pause frequency, drop-off

const STORAGE_KEY = 'cymax_analytics'

function getStore() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
        return {}
    }
}

function saveStore(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Track a user event
 * @param {string} type - Event type: 'play' | 'pause' | 'seek' | 'watch_end' | 'page_view'
 * @param {object} data - Event payload
 */
export function trackEvent(type, data = {}) {
    const store = getStore()

    if (!store.events) store.events = []
    if (!store.sessions) store.sessions = { total: 0, history: [] }
    if (!store.movies) store.movies = {}
    if (!store.daily) store.daily = {}

    const now = Date.now()
    const dateKey = new Date().toISOString().split('T')[0]

    // Log raw event
    store.events.push({
        type,
        data,
        timestamp: now,
        date: dateKey,
    })

    // Keep last 500 events max
    if (store.events.length > 500) store.events = store.events.slice(-500)

    // Movie-specific tracking
    if (data.movieId) {
        if (!store.movies[data.movieId]) {
            store.movies[data.movieId] = {
                title: data.title || data.movieId,
                playCount: 0,
                pauseCount: 0,
                totalWatchSeconds: 0,
                seekCount: 0,
                completions: 0,
                lastWatched: null,
                dropOffPoints: [],
            }
        }
        const movie = store.movies[data.movieId]

        switch (type) {
            case 'play':
                movie.playCount++
                movie.lastWatched = now
                break
            case 'pause':
                movie.pauseCount++
                if (data.position) movie.dropOffPoints.push(data.position)
                break
            case 'seek':
                movie.seekCount++
                break
            case 'watch_end':
                if (data.duration) {
                    movie.totalWatchSeconds += data.duration
                    if (data.duration > 30) movie.completions++
                }
                break
        }
    }

    // Daily aggregation
    if (!store.daily[dateKey]) {
        store.daily[dateKey] = { watchSeconds: 0, plays: 0, pauses: 0, sessions: 0 }
    }
    if (type === 'play') store.daily[dateKey].plays++
    if (type === 'pause') store.daily[dateKey].pauses++
    if (type === 'watch_end' && data.duration) store.daily[dateKey].watchSeconds += data.duration

    // Session tracking
    if (type === 'play') {
        store.sessions.total++
        store.sessions.history.push({ start: now, movieId: data.movieId })
        if (store.sessions.history.length > 50) store.sessions.history = store.sessions.history.slice(-50)
    }

    saveStore(store)
}

/**
 * Get all analytics data
 */
export function getAnalytics() {
    const store = getStore()
    return {
        events: store.events || [],
        movies: store.movies || {},
        daily: store.daily || {},
        sessions: store.sessions || { total: 0, history: [] },
    }
}

/**
 * Get summary statistics
 */
export function getAnalyticsSummary() {
    const { events, movies, daily, sessions } = getAnalytics()

    const movieArr = Object.entries(movies).map(([id, data]) => ({ id, ...data }))
    const totalWatchSeconds = movieArr.reduce((sum, m) => sum + m.totalWatchSeconds, 0)
    const totalPlays = movieArr.reduce((sum, m) => sum + m.playCount, 0)
    const totalPauses = movieArr.reduce((sum, m) => sum + m.pauseCount, 0)
    const totalCompletions = movieArr.reduce((sum, m) => sum + m.completions, 0)

    // Last 7 days daily data
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        last7Days.push({
            date: key,
            label: d.toLocaleDateString('en', { weekday: 'short' }),
            ...(daily[key] || { watchSeconds: 0, plays: 0, pauses: 0, sessions: 0 }),
        })
    }

    // Top movies by watch time
    const topMovies = [...movieArr].sort((a, b) => b.totalWatchSeconds - a.totalWatchSeconds).slice(0, 6)

    // Average session length
    const avgSessionSeconds = sessions.total > 0 ? Math.round(totalWatchSeconds / sessions.total) : 0

    return {
        totalWatchSeconds,
        totalWatchMinutes: Math.round(totalWatchSeconds / 60),
        totalWatchHours: (totalWatchSeconds / 3600).toFixed(1),
        totalPlays,
        totalPauses,
        totalCompletions,
        totalSessions: sessions.total,
        avgSessionSeconds,
        avgSessionMinutes: Math.round(avgSessionSeconds / 60),
        last7Days,
        topMovies,
        movieCount: movieArr.length,
        completionRate: totalPlays > 0 ? Math.round((totalCompletions / totalPlays) * 100) : 0,
    }
}

/**
 * Clear all analytics data
 */
export function clearAnalytics() {
    localStorage.removeItem(STORAGE_KEY)
}

/**
 * Seed demo data for presentation purposes
 */
export function seedDemoData() {
    const demoMovies = [
        { id: 'dwaraka', title: 'DWARAKA' },
        { id: 'jungle_book', title: 'JUNGLE BOOK' },
        { id: 'stargate', title: 'STARGATE' },
        { id: 'jurassic', title: 'JURASSIC PARADISE' },
        { id: 'ocean_quest', title: 'OCEAN QUEST' },
        { id: 'lia', title: 'LIA' },
    ]

    clearAnalytics()

    // Generate 7 days of demo data
    for (let day = 6; day >= 0; day--) {
        const d = new Date()
        d.setDate(d.getDate() - day)

        const sessionsToday = 2 + Math.floor(Math.random() * 5)
        for (let s = 0; s < sessionsToday; s++) {
            const movie = demoMovies[Math.floor(Math.random() * demoMovies.length)]
            const watchDuration = 30 + Math.floor(Math.random() * 600)

            trackEvent('play', { movieId: movie.id, title: movie.title })
            if (Math.random() > 0.4) {
                trackEvent('pause', { movieId: movie.id, position: Math.floor(Math.random() * 120) })
            }
            if (Math.random() > 0.6) {
                trackEvent('seek', { movieId: movie.id })
            }
            trackEvent('watch_end', { movieId: movie.id, title: movie.title, duration: watchDuration })
        }
    }
}
