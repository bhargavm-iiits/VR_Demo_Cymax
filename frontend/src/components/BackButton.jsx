import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function BackButton({ label = 'Back', to = null, className = '' }) {
    const navigate = useNavigate()

    const handleClick = () => {
        if (to) navigate(to)
        else navigate(-1)
    }

    return (
        <button
            onClick={handleClick}
            className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white/70 transition-all hover:bg-white/[0.08] hover:text-white ${className}`}
        >
            <ArrowLeft size={16} />
            {label}
        </button>
    )
}
