import { useEffect, useState, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

export default function TiltCard({ children, className = '', tiltMagnitude = 15 }) {
    const ref = useRef(null)
    const [isHovered, setIsHovered] = useState(false)

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 20 })
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 20 })

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [tiltMagnitude, -tiltMagnitude])
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-tiltMagnitude, tiltMagnitude])

    const handleMouseMove = (e) => {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        
        const width = rect.width
        const height = rect.height
        
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        
        const xPct = mouseX / width - 0.5
        const yPct = mouseY / height - 0.5
        
        x.set(xPct)
        y.set(yPct)
    }

    const handleMouseLeave = () => {
        setIsHovered(false)
        x.set(0)
        y.set(0)
    }

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            whileHover={{ scale: 1.02 }}
            className={`relative perspective-1000 ${className}`}
        >
            {/* The actual content wraps in a translational layer so it visually pops */}
            <motion.div
                style={{
                    transform: isHovered ? "translateZ(30px)" : "translateZ(0px)",
                    transition: "transform 0.2s ease-out"
                }}
                className="w-full h-full"
            >
                {children}

                {/* Spectacular 3D dynamic glare effect */}
                {isHovered && (
                     <div 
                        className="absolute inset-0 pointer-events-none rounded-inherit z-50 transition-opacity duration-300"
                        style={{
                            background: `radial-gradient(circle at ${x.get() * 100 + 50}% ${y.get() * 100 + 50}%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
                        }}
                    />
                )}
            </motion.div>
        </motion.div>
    )
}
