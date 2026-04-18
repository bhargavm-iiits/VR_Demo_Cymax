import { useEffect, useRef, useState } from 'react'

export default function Splash({ onComplete }) {
    const videoRef = useRef(null)
    const [fadeOut,  setFadeOut]  = useState(false)
    const [loading,  setLoading]  = useState(true)   // show spinner while buffering
    const [errored,  setErrored]  = useState(false)

    const finish = () => {
        setFadeOut(true)
        setTimeout(onComplete, 700)
    }

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        // Clear loading once it can play
        const onCanPlay = () => setLoading(false)
        // When video ends naturally
        const onEnded   = () => finish()
        // If video errors (missing file, codec etc.) → skip
        const onError   = () => { setErrored(true); finish() }

        // 10-second hard fallback
        const fallback = setTimeout(finish, 10000)

        video.addEventListener('canplay',  onCanPlay)
        video.addEventListener('ended',    onEnded)
        video.addEventListener('error',    onError)

        video.play().catch(() => {
            // Browsers block autoplay WITH sound — try muted fallback
            video.muted = true
            video.play().catch(() => finish())  // still blocked → skip
        })

        return () => {
            clearTimeout(fallback)
            video.removeEventListener('canplay',  onCanPlay)
            video.removeEventListener('ended',    onEnded)
            video.removeEventListener('error',    onError)
        }
    }, [onComplete])

    return (
        <div
            onClick={finish}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: '#000',
                opacity: fadeOut ? 0 : 1,
                transition: 'opacity 0.7s ease',
                overflow: 'hidden',
                cursor: 'pointer',
            }}
        >
            {/* Video */}
            <video
                ref={videoRef}
                src="/cymax_intro.mp4"
                playsInline
                preload="auto"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                }}
            />

            {/* Buffering spinner — visible only while loading */}
            {loading && !errored && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    background: '#000',
                    pointerEvents: 'none',
                }}>
                    {/* CYMAX logo */}
                    <img
                        src="/cymax_logo_icon.png"
                        alt="CYMAX"
                        style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', marginBottom: 8 }}
                    />
                    {/* Spinner ring */}
                    <div style={{
                        width: 36, height: 36,
                        border: '3px solid rgba(0,230,255,0.15)',
                        borderTop: '3px solid #00E6FF',
                        borderRadius: '50%',
                        animation: 'spin 0.9s linear infinite',
                    }}/>
                    <p style={{
                        fontSize: 9,
                        letterSpacing: 6,
                        color: 'rgba(255,255,255,0.25)',
                        fontFamily: 'monospace',
                        textTransform: 'uppercase',
                    }}>
                        Loading
                    </p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
            )}

            {/* Skip hint */}
            {!loading && (
                <div style={{
                    position: 'absolute',
                    bottom: 28,
                    right: 36,
                    fontSize: 10,
                    letterSpacing: 6,
                    color: 'rgba(255,255,255,0.25)',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    userSelect: 'none',
                    pointerEvents: 'none',
                }}>
                    Click to skip
                </div>
            )}
        </div>
    )
}
