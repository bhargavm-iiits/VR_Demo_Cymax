import { useEffect } from 'react'
import useStore from '../store/useStore'
import { streamAPI } from '../api/axios'

export default function useSocket() {
    const { token, setWsConnected, setNotification } = useStore()

    useEffect(() => {
        setWsConnected(!!token)
    }, [token, setWsConnected])

    const sendCommand = async (command, payload = {}) => {
        try {
            await streamAPI.sendCommand({ command, ...payload })
        } catch (error) {
            setNotification({
                type: 'error',
                msg: error?.response?.data?.detail || 'Failed to send command to VR headset.',
            })
        }
    }

    return { sendCommand }
}
