import SidebarNav from './SidebarNav'
import Notification from './Notification'

export default function MainLayout({ children }) {
    return (
        <div className="min-h-screen bg-bg text-white font-sans selection:bg-[#7B61FF] selection:text-white">
            {/* The global background noise and blobs can stay here for cohesion */}
            <div className="noise hidden md:block" />
            <div className="blob fixed w-[600px] h-[600px] bg-[#7B61FF] top-[-10%] left-[-10%] opacity-30 pointer-events-none" />
            <div className="blob fixed w-[500px] h-[500px] bg-[#e50914] bottom-[-10%] right-[-5%] opacity-20 pointer-events-none" 
                 style={{ animationDelay: '-4s', animationDuration: '10s' }} />
            
            <SidebarNav />
            <Notification />
            
            <main className="md:pl-[80px] min-h-screen w-full relative z-10 transition-all duration-300">
                {children}
            </main>
        </div>
    )
}
