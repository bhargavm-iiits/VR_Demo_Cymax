import { Suspense, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sphere, MeshDistortMaterial, Stars } from '@react-three/drei'
import * as THREE from 'three'

// ── Animated Glow Sphere ─────────────────────────────────────
function GlowSphere() {
    const meshRef = useRef()
    const { mouse } = useThree()

    useFrame(({ clock }) => {
        if (!meshRef.current) return
        const t = clock.getElapsedTime()
        meshRef.current.rotation.x = t * 0.1
        meshRef.current.rotation.y = t * 0.15
        // Mouse parallax
        meshRef.current.position.x += (mouse.x * 0.5 - meshRef.current.position.x) * 0.05
        meshRef.current.position.y += (mouse.y * 0.3 - meshRef.current.position.y) * 0.05
    })

    return (
        <group>
            {/* Outer glow */}
            <Sphere ref={meshRef} args={[1.8, 64, 64]}>
                <MeshDistortMaterial
                    color="#7B61FF"
                    attach="material"
                    distort={0.4}
                    speed={2}
                    roughness={0}
                    metalness={0.8}
                    transparent
                    opacity={0.15}
                />
            </Sphere>

            {/* Core sphere */}
            <Sphere args={[1.2, 64, 64]}>
                <MeshDistortMaterial
                    color="#00D1FF"
                    attach="material"
                    distort={0.3}
                    speed={1.5}
                    roughness={0.1}
                    metalness={1}
                    transparent
                    opacity={0.6}
                />
            </Sphere>

            {/* Inner core */}
            <Sphere args={[0.6, 32, 32]}>
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#7B61FF"
                    emissiveIntensity={2}
                    transparent
                    opacity={0.9}
                />
            </Sphere>
        </group>
    )
}

// ── Floating Particles ───────────────────────────────────────
function Particles({ count = 200 }) {
    const meshRef = useRef()

    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 20
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20
    }

    useFrame(({ clock }) => {
        if (!meshRef.current) return
        meshRef.current.rotation.y = clock.getElapsedTime() * 0.02
        meshRef.current.rotation.x = clock.getElapsedTime() * 0.01
    })

    return (
        <points ref={meshRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    array={positions}
                    count={count}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.05}
                color="#7B61FF"
                transparent
                opacity={0.8}
                sizeAttenuation
            />
        </points>
    )
}

// ── Ring Animation ───────────────────────────────────────────
function Rings() {
    const ring1 = useRef()
    const ring2 = useRef()

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime()
        if (ring1.current) ring1.current.rotation.z = t * 0.3
        if (ring2.current) ring2.current.rotation.z = -t * 0.2
    })

    return (
        <>
            <mesh ref={ring1} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.01, 16, 100]} />
                <meshStandardMaterial
                    color="#7B61FF"
                    emissive="#7B61FF"
                    emissiveIntensity={2}
                    transparent
                    opacity={0.4}
                />
            </mesh>
            <mesh ref={ring2} rotation={[Math.PI / 3, 0, 0]}>
                <torusGeometry args={[3.2, 0.008, 16, 100]} />
                <meshStandardMaterial
                    color="#00D1FF"
                    emissive="#00D1FF"
                    emissiveIntensity={2}
                    transparent
                    opacity={0.3}
                />
            </mesh>
        </>
    )
}

// ── Main Scene ───────────────────────────────────────────────
export default function Scene({ simple = false }) {
    return (
        <Canvas
            camera={{ position: [0, 0, 6], fov: 75 }}
            style={{ background: 'transparent' }}
            gl={{ alpha: true, antialias: true }}
        >
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} color="#7B61FF" intensity={2} />
            <pointLight position={[-10, -10, -10]} color="#00D1FF" intensity={1} />
            <spotLight
                position={[0, 5, 5]}
                angle={0.3}
                penumbra={1}
                intensity={2}
                color="#7B61FF"
            />

            <Suspense fallback={null}>
                <GlowSphere />
                {!simple && <Particles count={300} />}
                {!simple && <Rings />}
                <Stars
                    radius={100}
                    depth={50}
                    count={simple ? 500 : 2000}
                    factor={4}
                    saturation={0}
                    fade
                    speed={0.5}
                />
            </Suspense>
        </Canvas>
    )
}