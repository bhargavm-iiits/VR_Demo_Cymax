import React from 'react';
import { motion } from 'framer-motion';
import TiltCard from '../components/TiltCard';

export default function About() {
    return (
        <div className="flex w-full min-h-screen text-white pt-10 px-8 lg:px-16 overflow-y-auto hidden-scrollbar pb-20 justify-center">
            
            <div className="max-w-4xl w-full flex flex-col gap-10">
                {/* Intro Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center"
                >
                    <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-widest text-[#00E6FF] drop-shadow-[0_0_15px_rgba(0,230,255,0.4)] uppercase">
                        About CYMAX
                    </h1>
                    <p className="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                        Pioneering the future of immersive entertainment, CYMAX seamlessly fuses technology and storytelling to deliver unprecedented VR Theatre and Cinematic Experiences.
                    </p>
                </motion.div>

                {/* Leadership Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mt-8"
                >
                    <h2 className="text-2xl font-bold mb-6 text-white tracking-wide uppercase border-b border-white/10 pb-4">
                        Leadership & Trust
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* CEO Card */}
                        <TiltCard className="w-full" tiltMagnitude={10}>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] h-full">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#00E6FF] to-[#0A44FF] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(0,230,255,0.3)]">
                                        <span className="font-bold text-xl text-white">GM</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-lg font-bold text-white mb-1">Gouri Shankar Mamidi</p>
                                        <p className="text-xs text-[#00E6FF] font-semibold uppercase tracking-wider">CEO & Creative Force</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    A visionary architect and creative force with over three decades of expertise. Winner of the "Udyog Ratna Award" and creator of the "Police Information System".
                                </p>
                            </div>
                        </TiltCard>

                        {/* Government Trust Card */}
                        <TiltCard className="w-full" tiltMagnitude={10}>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-[0_10px_30px_rgba(0,0,0,0.5)] h-full">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-white/5 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-md">
                                        <span className="font-bold text-lg text-white">Govt</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-lg font-bold text-white mb-1">Trusted Partners</p>
                                        <p className="text-xs text-[#00E6FF] font-semibold uppercase tracking-wider">Public & Private Sectors</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    Trusted by major organizations including the Government of Telangana, Andhra Pradesh Government, DRDO, Ramoji Film City, and T-Hub.
                                </p>
                            </div>
                        </TiltCard>
                    </div>
                </motion.div>

                {/* Company Story / Extra VR stuff */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-8 bg-black/40 border border-[#00E6FF]/20 rounded-2xl p-8 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#00E6FF] opacity-5 mix-blend-screen blur-[100px] pointer-events-none" />
                    <h2 className="text-xl font-bold mb-4 text-[#00E6FF] tracking-wide uppercase">The VR Theatre Vision</h2>
                    <p className="text-gray-300 text-sm leading-relaxed mb-4">
                        CYMAX Infotainment specializes in immersive technologies. Our primary focus areas include AR/VR/MR/XR Solutions, providing virtual architecture, VR movies, virtual production, and immersive experiences for various industries.
                    </p>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Under the leadership of G. Raghava Reddy and Gouri Shankar Mamidi, we continue to push the boundaries of what is possible in digital storytelling and holographic technology.
                    </p>
                </motion.div>

            </div>
        </div>
    )
}
