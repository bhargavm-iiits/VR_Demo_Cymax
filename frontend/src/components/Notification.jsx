import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react'
import useStore from '../store/useStore'

const icons = {
    success: <CheckCircle size={16} className="text-green-400" />,
    warning: <AlertTriangle size={16} className="text-yellow-400" />,
    error: <XCircle size={16} className="text-red-400" />,
}

const styles = {
    success: 'border-green-500/30 bg-green-500/10 text-green-100',
    warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100',
    error: 'border-red-500/30 bg-red-500/10 text-red-100',
}

export default function Notification() {
    const { notification, clearNotification } = useStore()

    useEffect(() => {
        if (!notification) return
        const t = setTimeout(clearNotification, 4000)
        return () => clearTimeout(t)
    }, [notification])

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, x: 100, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl
                        border backdrop-blur-xl max-w-xs
                        ${styles[notification.type] || styles.success}`}
                    >
                        {icons[notification.type]}
                        <p className="text-sm font-medium flex-1">{notification.msg}</p>
                        <button
                            onClick={clearNotification}
                            className="opacity-60 hover:opacity-100 transition-opacity ml-1"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}