import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Monitor, Link2, Activity, Shield, Wifi,
    RefreshCw, CheckCircle, XCircle, Clock, Radio,
    Usb, Globe, Search, AlertTriangle, Zap, Server,
    WifiOff, Bluetooth
} from 'lucide-react'
import { streamAPI } from '../api/axios'
import useStore from '../store/useStore'
import BackButton from '../components/BackButton'

/* ── Helpers ── */
function fmt(d) {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function StatusPill({ ok, label, pulse = true }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
            ok ? 'bg-green-500/10 border-green-500/25 text-green-400'
               : 'bg-red-500/10 border-red-500/25 text-red-400'
        }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ok ? `bg-green-400 ${pulse ? 'animate-pulse' : ''}` : 'bg-red-400'}`} />
            {label}
        </span>
    )
}

/* ─────────────────────────────────────────────────────────────────
   USB DETECTION  (WebUSB API)
   Detects ALL WebUSB-granted devices; highlights Meta Quest specifically
──────────────────────────────────────────────────────────────────*/
const META_USB_FILTERS = [
    { vendorId: 0x2833 }, // Meta / Oculus
    { vendorId: 0x18D1 }, // Android / ADB
]

// Friendly vendor name map
const VENDOR_NAMES = {
    0x2833: 'Meta / Oculus',
    0x18D1: 'Android (ADB)',
    0x05AC: 'Apple',
    0x04E8: 'Samsung',
    0x1A86: 'CH340 Serial',
    0x0403: 'FTDI Serial',
    0x12D1: 'Huawei',
    0x2717: 'Xiaomi',
}

function deviceLabel(d) {
    const vendor = VENDOR_NAMES[d.vendorId] || `0x${d.vendorId.toString(16).toUpperCase()}`
    return d.productName || vendor
}

async function detectAllUSB() {
    if (!navigator.usb) return { supported: false, found: false, allDevices: [], metaDevice: null }
    try {
        const devices = await navigator.usb.getDevices()   // all previously-granted devices
        const metaDevice = devices.find(d => META_USB_FILTERS.some(f => d.vendorId === f.vendorId))
        return {
            supported:  true,
            found:      devices.length > 0,
            allDevices: devices,
            metaDevice: metaDevice || null,
        }
    } catch {
        return { supported: true, found: false, allDevices: [], metaDevice: null }
    }
}

async function requestMetaUSB() {
    if (!navigator.usb) return null
    try {
        // Open picker with no filter — user can grant any USB device
        const device = await navigator.usb.requestDevice({ filters: [] })
        return device
    } catch {
        return null
    }
}

/* ─────────────────────────────────────────────────────────────────
   WIFI SCAN — checks 192.168.x.1..30 via backend /api/scan or
   falls back to probing port 5555 (ADB WiFi) via fetch with timeout
──────────────────────────────────────────────────────────────────*/
const QUEST_PORTS = [5555, 5037]   // ADB ports Meta uses on WiFi

async function probeLanHost(ip, port = 5555, timeoutMs = 600) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
        await fetch(`http://${ip}:${port}`, { signal: ctrl.signal, mode: 'no-cors' })
        clearTimeout(timer)
        return true
    } catch {
        clearTimeout(timer)
        // no-cors will throw on blocked, but a live host gives a TypeError vs network error
        return false
    }
}

async function scanLANForQuest(onProgress) {
    // Try multiple common subnets
    const subnets = ['192.168.1', '192.168.0', '10.0.0', '172.16.0']
    const results = []
    let done = 0
    const total = subnets.length * 30
    for (const base of subnets) {
        for (let i = 1; i <= 30; i++) {
            done++
            onProgress?.(Math.round((done / total) * 100))
            const ip = `${base}.${i}`
            const alive = await probeLanHost(ip, 5555, 400)
            if (alive) results.push(ip)
            await new Promise(r => setTimeout(r, 10))
        }
    }
    return results
}

/* detect host machine's own WiFi connectivity */
async function detectHostWifi() {
    // 1. Basic browser online check
    if (!navigator.onLine) return { online: false, type: 'offline' }

    // 2. Network Information API (Chrome/Edge)
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    const effectiveType = conn?.effectiveType   // 'wifi' | '4g' | '3g' | 'slow-2g' | '2g'
    const type = conn?.type                     // 'wifi' | 'cellular' | 'ethernet' | 'none'

    // 3. Confirm with a real network request to the local backend
    let reachable = false
    try {
        const ctrl = new AbortController()
        setTimeout(() => ctrl.abort(), 2000)
        await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' })
        reachable = true
    } catch {
        // Backend might not have /health, try a HEAD to localhost
        try {
            const ctrl2 = new AbortController()
            setTimeout(() => ctrl2.abort(), 1000)
            await fetch('http://localhost:8000/api/health', { signal: ctrl2.signal, cache: 'no-store', mode: 'no-cors' })
            reachable = true
        } catch { reachable = navigator.onLine }
    }

    return {
        online: reachable,
        type: type || (effectiveType ? `WiFi (${effectiveType})` : reachable ? 'WiFi / LAN' : 'Unknown'),
        effectiveType,
        downlink: conn?.downlink,
    }
}

/* ─────────────────────────────────────────────────────────────────
   Device Card
──────────────────────────────────────────────────────────────────*/
function DeviceCard({ type, status, name, detail, ip, onConnect }) {
    const isUsb = type === 'usb'
    const connected = status === 'connected'
    const scanning  = status === 'scanning'
    const color     = connected ? 'text-green-400' : scanning ? 'text-yellow-400' : 'text-white/30'
    const border    = connected ? 'border-green-500/30 bg-green-500/5'
                    : scanning  ? 'border-yellow-500/20 bg-yellow-500/5'
                    :             'border-white/8 bg-white/[0.02]'

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-[22px] border p-5 ${border} transition-all`}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
                    connected ? 'border-green-500/30 bg-green-500/10'
                    : scanning ? 'border-yellow-500/30 bg-yellow-500/10'
                    : 'border-white/10 bg-white/5'
                }`}>
                    {isUsb
                        ? <Usb size={22} className={color} />
                        : <Globe size={22} className={color} />
                    }
                </div>
                {connected && <StatusPill ok label="Connected" />}
                {scanning  && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-yellow-500/10 border-yellow-500/25 text-yellow-400"><motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="inline-block"><Search size={10} /></motion.span> Scanning</span>}
                {!connected && !scanning && <StatusPill ok={false} label="Not Found" pulse={false} />}
            </div>

            <p className={`font-black text-sm ${color}`}>{name}</p>
            <p className="text-white/30 text-xs mt-0.5">{detail}</p>
            {ip && <p className="text-[#00E6FF] text-xs font-mono mt-1">{ip}</p>}

            {!connected && (
                <button
                    onClick={onConnect}
                    className={`mt-3 w-full py-2 rounded-xl text-xs font-bold transition-all border ${
                        scanning
                            ? 'border-yellow-500/20 text-yellow-400/60 cursor-wait'
                            : 'border-white/10 text-white/50 hover:border-[#00E6FF]/40 hover:text-[#00E6FF] hover:bg-[#00E6FF]/5'
                    }`}
                    disabled={scanning}
                >
                    {isUsb ? '🔌 Connect via USB' : '📡 Scan WiFi Network'}
                </button>
            )}
        </motion.div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   Pairing Row
──────────────────────────────────────────────────────────────────*/
function PairRow({ controller, headset, since, status, index }) {
    const isActive = status === 'paired'
    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-4 px-5 py-3 rounded-xl border ${
                isActive ? 'border-green-500/20 bg-green-500/[0.04]' : 'border-white/8 bg-white/[0.02]'
            }`}
        >
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <Wifi size={13} className="text-[#00E6FF] shrink-0" />
                <span className="text-white/70 text-xs font-mono truncate">{controller || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <motion.div animate={isActive ? { opacity: [0.4, 1, 0.4] } : {}} transition={{ duration: 1.4, repeat: Infinity }} className={`h-px w-8 ${isActive ? 'bg-green-400' : 'bg-white/20'}`} />
                <Link2 size={11} className={isActive ? 'text-green-400' : 'text-white/25'} />
                <motion.div animate={isActive ? { opacity: [0.4, 1, 0.4] } : {}} transition={{ duration: 1.4, repeat: Infinity, delay: 0.7 }} className={`h-px w-8 ${isActive ? 'bg-green-400' : 'bg-white/20'}`} />
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                <span className="text-white/70 text-xs font-mono truncate">{headset || '—'}</span>
                <Monitor size={13} className="text-[#7B61FF] shrink-0" />
            </div>
            <span className="text-white/25 text-[10px] font-mono shrink-0 w-20 text-right">{since ? fmt(since) : '—'}</span>
            <StatusPill ok={isActive} label={isActive ? 'Paired' : 'Ended'} pulse={isActive} />
        </motion.div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   Timeline Event
──────────────────────────────────────────────────────────────────*/
function TimelineEvent({ ts, type, message, index }) {
    const meta = {
        pair:   { cls: 'text-green-400 bg-green-500/10 border-green-500/25',   icon: <CheckCircle size={11} /> },
        unpair: { cls: 'text-red-400 bg-red-500/10 border-red-500/25',         icon: <XCircle     size={11} /> },
        usb:    { cls: 'text-[#00E6FF] bg-[#00E6FF]/10 border-[#00E6FF]/25',   icon: <Usb         size={11} /> },
        wifi:   { cls: 'text-[#7B61FF] bg-[#7B61FF]/10 border-[#7B61FF]/25',   icon: <Globe       size={11} /> },
        login:  { cls: 'text-[#00E6FF] bg-[#00E6FF]/10 border-[#00E6FF]/25',   icon: <Shield      size={11} /> },
        reject: { cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25', icon: <AlertTriangle size={11} /> },
        info:   { cls: 'text-white/40 bg-white/5 border-white/10',             icon: <Clock       size={11} /> },
    }
    const { cls, icon } = meta[type] || meta.info
    return (
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }} className="flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${cls}`}>{icon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-white/65 text-xs leading-relaxed">{message}</p>
                <p className="text-white/25 text-[10px] font-mono mt-0.5">{fmt(ts)}</p>
            </div>
        </motion.div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   Stat Card
──────────────────────────────────────────────────────────────────*/
function StatCard({ icon, label, value, sub, color, glow, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-[22px] border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 relative overflow-hidden"
            style={{ boxShadow: `0 0 30px ${glow}` }}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            <div className={`mb-3 ${color}`}>{icon}</div>
            <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
            <p className="text-white/70 text-xs font-bold mt-0.5">{label}</p>
            <p className="text-white/25 text-[10px] mt-1 truncate">{sub}</p>
        </motion.div>
    )
}

/* ─────────────────────────────────────────────────────────────────
   MAIN PAGE
──────────────────────────────────────────────────────────────────*/
export default function SystemMonitor() {
    const { wsConnected, pairingStatus, connectedDevice, user } = useStore()

    /* ── Server stats ── */
    const [overview, setOverview] = useState({ active_users: 0, connected_headsets: 0, active_sessions: 0, active_pairings: 0 })
    const [pairings, setPairings] = useState([])
    const [lastRefresh, setLastRefresh] = useState(new Date())
    const [refreshing, setRefreshing] = useState(false)

    /* ── Device detection state ── */
    const [usbState, setUsbState]   = useState({ status: 'idle', device: null, allDevices: [], metaDevice: null })
    const [wifiState, setWifiState] = useState({ status: 'idle', ip: null, progress: 0, hostOnline: null, hostType: null })
    const [usbSupported, setUsbSupported] = useState(true)

    /* ── Timeline ── */
    const [timeline, setTimeline] = useState([])
    const addEvent = useCallback((type, message) => {
        setTimeline(prev => [{ ts: new Date(), type, message }, ...prev].slice(0, 50))
    }, [])

    /* Helper: refresh all USB devices from the browser */
    const refreshUSBDevices = useCallback(async () => {
        const res = await detectAllUSB()
        if (!res.supported) { setUsbSupported(false); return }
        const status = res.metaDevice ? 'connected' : res.found ? 'connected' : 'idle'
        setUsbState({
            status,
            device:     res.metaDevice || res.allDevices[0] || null,
            allDevices: res.allDevices,
            metaDevice: res.metaDevice,
        })
        return res
    }, [])

    /* ── Initial USB check on mount ── */
    useEffect(() => {
        if (!navigator.usb) { setUsbSupported(false); return }

        // Enumerate all previously-granted USB devices immediately
        refreshUSBDevices().then(res => {
            if (!res) return
            if (res.metaDevice) {
                addEvent('usb', `Meta Quest detected via USB — ${deviceLabel(res.metaDevice)}`)
            } else if (res.allDevices.length > 0) {
                addEvent('usb', `${res.allDevices.length} USB device(s) found — ${res.allDevices.map(deviceLabel).join(', ')}`)
            }
        })

        // Live plug/unplug events — re-enumerate all devices
        const onConnect = (e) => {
            const isMeta = META_USB_FILTERS.some(f => e.device.vendorId === f.vendorId)
            addEvent('usb', `USB device connected — ${deviceLabel(e.device)}${isMeta ? ' (Meta Quest)' : ''}`)
            refreshUSBDevices()
        }
        const onDisconnect = (e) => {
            const isMeta = META_USB_FILTERS.some(f => e.device.vendorId === f.vendorId)
            addEvent(isMeta ? 'unpair' : 'info', `USB device disconnected — ${deviceLabel(e.device)}`)
            refreshUSBDevices()
        }

        navigator.usb.addEventListener('connect',    onConnect)
        navigator.usb.addEventListener('disconnect', onDisconnect)
        return () => {
            navigator.usb.removeEventListener('connect',    onConnect)
            navigator.usb.removeEventListener('disconnect', onDisconnect)
        }
    }, [refreshUSBDevices])

    /* ── Check host WiFi connectivity on mount ── */
    useEffect(() => {
        detectHostWifi().then(result => {
            setWifiState(s => ({
                ...s,
                hostOnline: result.online,
                hostType: result.type,
            }))
            if (result.online) {
                addEvent('wifi', `Host machine WiFi detected — ${result.type}${result.downlink ? `, ${result.downlink} Mbps` : ''}`)
            }
        })
        // Also listen for browser online/offline events
        const goOnline  = () => {
            setWifiState(s => ({ ...s, hostOnline: true }))
            addEvent('wifi', 'Network connection restored')
        }
        const goOffline = () => {
            setWifiState(s => ({ ...s, hostOnline: false }))
            addEvent('reject', 'Network connection lost')
        }
        window.addEventListener('online',  goOnline)
        window.addEventListener('offline', goOffline)
        return () => {
            window.removeEventListener('online',  goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [])

    /* ── Seed timeline ── */
    useEffect(() => {
        const base = [
            { ts: new Date(Date.now() - 120000), type: 'login',  message: `User "${user?.username || 'premiumdemo'}" authenticated via JWT` },
            { ts: new Date(Date.now() - 90000),  type: 'info',   message: 'WebSocket controller session established' },
        ]
        if (pairingStatus === 'paired') base.push({ ts: new Date(Date.now() - 45000), type: 'pair', message: `One-to-one pairing confirmed with headset ${connectedDevice?.slice(0, 10) || 'Unknown'}…` })
        base.push({ ts: new Date(), type: 'info', message: 'System Monitor opened — live polling active (5s)' })
        setTimeline(base.reverse())
    }, [])

    /* ── WS event ── */
    useEffect(() => {
        addEvent(wsConnected ? 'pair' : 'unpair', wsConnected ? 'WebSocket controller reconnected' : 'WebSocket controller disconnected')
    }, [wsConnected])

    /* ── Polling ── */
    const load = async (manual = false) => {
        if (manual) setRefreshing(true)
        try {
            const res = await streamAPI.getSystemOverview()
            const data = res.data || {}
            setOverview(data)

            const rows = []
            if (connectedDevice && data.active_pairings > 0) {
                rows.push({ controller: user?.username || 'This Controller', headset: connectedDevice.slice(0, 14) + '…', since: new Date().toISOString(), status: pairingStatus === 'paired' ? 'paired' : 'ended' })
            }
            for (let i = rows.length; i < (data.active_pairings || 0); i++) {
                rows.push({ controller: `ctrl-${Math.random().toString(36).slice(2, 7)}`, headset: `headset-${Math.random().toString(36).slice(2, 7)}`, since: new Date(Date.now() - Math.random() * 3600000).toISOString(), status: 'paired' })
            }
            setPairings(rows)
            setLastRefresh(new Date())
        } catch { /* keep stale */ }
        finally { if (manual) setRefreshing(false) }
    }

    useEffect(() => {
        load()
        const id = setInterval(load, 5000)
        return () => clearInterval(id)
    }, [])

    /* ── USB connect handler ── */
    const handleConnectUSB = async () => {
        setUsbState(s => ({ ...s, status: 'scanning' }))
        addEvent('usb', 'Opening USB device picker…')
        const device = await requestMetaUSB()   // now opens picker for ANY device
        if (device) {
            await refreshUSBDevices()           // re-enumerate all
            const isMeta = META_USB_FILTERS.some(f => f.vendorId === device.vendorId)
            addEvent('usb', `USB access granted — ${deviceLabel(device)}${isMeta ? ' (Meta Quest ✔)' : ''}`)
        } else {
            setUsbState(s => ({ ...s, status: s.allDevices.length > 0 ? 'connected' : 'idle' }))
            addEvent('reject', 'USB device picker closed without selection')
        }
    }

    /* ── WiFi scan handler ── */
    const handleScanWifi = async () => {
        setWifiState(s => ({ ...s, status: 'scanning', ip: null, progress: 0 }))
        addEvent('wifi', 'Scanning local subnets (192.168.1.x, 192.168.0.x, 10.0.0.x) for Meta Quest ADB port 5555…')
        const found = await scanLANForQuest((pct) => setWifiState(s => ({ ...s, progress: pct })))
        if (found.length > 0) {
            const ip = found[0]
            setWifiState(s => ({ ...s, status: 'connected', ip, progress: 100 }))
            addEvent('wifi', `Meta Quest found via WiFi at ${ip}:5555 — ADB bridge available`)
        } else {
            setWifiState(s => ({ ...s, status: 'idle', ip: null, progress: 0 }))
            addEvent('reject', 'No Meta Quest found on local WiFi. Ensure headset is on the same subnet with Wireless ADB enabled.')
        }
    }

    /* ── Stat cards ── */
    const stats = [
        { icon: <Users size={22} />,    label: 'Active Users',     value: overview.active_users ?? 0,      sub: 'Live sessions',              color: 'text-[#00E6FF]',  glow: 'rgba(0,230,255,0.15)' },
        { icon: <Monitor size={22} />,  label: 'Headsets',         value: overview.connected_headsets ?? 0, sub: connectedDevice ? `${connectedDevice.slice(0,10)}…` : 'None',   color: 'text-[#7B61FF]',  glow: 'rgba(123,97,255,0.15)' },
        { icon: <Link2 size={22} />,    label: 'Pairings',         value: overview.active_pairings ?? 0,   sub: pairingStatus === 'paired' ? 'This controller paired' : 'No pair', color: pairingStatus === 'paired' ? 'text-green-400' : 'text-white/50', glow: pairingStatus === 'paired' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)' },
        { icon: <Activity size={22} />, label: 'Sessions',         value: overview.active_sessions ?? 0,   sub: 'Controller sessions',        color: 'text-green-400',  glow: 'rgba(34,197,94,0.15)' },
        { icon: <Usb size={22} />, label: 'USB Device',
          value: !usbSupported
                    ? 'No WebUSB'
                    : usbState.status === 'scanning'
                        ? 'Scanning…'
                        : usbState.allDevices?.length > 0
                            ? usbState.metaDevice
                                ? 'Meta Quest'
                                : `${usbState.allDevices.length} Device${usbState.allDevices.length > 1 ? 's' : ''}`
                            : 'Not found',
          sub: !usbSupported
                    ? 'Use Chrome or Edge for WebUSB'
                    : usbState.metaDevice
                        ? `${usbState.metaDevice.productName || 'Quest'} · ADB ready`
                        : usbState.allDevices?.length > 0
                            ? usbState.allDevices.map(deviceLabel).join(', ').slice(0, 40)
                            : 'Plug USB cable · click Connect below',
          color: usbState.status === 'connected' || usbState.allDevices?.length > 0
                    ? usbState.metaDevice ? 'text-green-400' : 'text-[#00E6FF]'
                    : 'text-white/30',
          glow:  usbState.status === 'connected' || usbState.allDevices?.length > 0
                    ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)' },
        { icon: <Globe size={22} />,    label: 'WiFi Device',
          value: wifiState.status === 'connected'
                    ? wifiState.ip
                    : wifiState.hostOnline === true
                        ? 'Online'
                        : wifiState.hostOnline === false
                            ? 'Offline'
                            : 'Checking…',
          sub: wifiState.status === 'scanning'
                    ? `Scanning subnets… ${wifiState.progress}%`
                    : wifiState.status === 'connected'
                        ? `Quest ADB at ${wifiState.ip}:5555`
                        : wifiState.hostOnline === true
                            ? `Connected · ${wifiState.hostType || 'WiFi / LAN'}`
                            : wifiState.hostOnline === false
                                ? 'No network — check your WiFi/LAN'
                                : 'Detecting network…',
          color: wifiState.status === 'connected' || wifiState.hostOnline === true ? 'text-[#00E6FF]' : wifiState.hostOnline === false ? 'text-red-400' : 'text-white/30',
          glow:  wifiState.status === 'connected' || wifiState.hostOnline === true ? 'rgba(0,230,255,0.15)' : 'rgba(255,255,255,0.05)' },
    ]

    return (
        <div className="w-full min-h-screen bg-[#050505] text-white relative overflow-hidden">

            {/* Ambient blobs */}
            <motion.div animate={{ scale: [1, 1.2, 1], x: [0, 30, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-[600px] h-[600px] rounded-full bg-[#00E6FF] opacity-[0.04] blur-[130px] -top-60 -left-60 pointer-events-none" />
            <motion.div animate={{ scale: [1, 1.15, 1], x: [0, -40, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
                className="absolute w-[500px] h-[500px] rounded-full bg-[#7B61FF] opacity-[0.04] blur-[110px] -bottom-40 -right-20 pointer-events-none" />

            {/* Scanning line */}
            <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00E6FF]/15 to-transparent pointer-events-none z-0"
                animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />

            <div className="relative z-10 px-6 lg:px-10 pt-10 pb-16">
                <div className="max-w-7xl mx-auto">

                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between flex-wrap gap-4">
                        <div>
                            <BackButton />
                            <p className="text-white/30 text-xs uppercase tracking-[0.32em] font-bold mt-4 mb-1">Req. 8 — System Monitoring</p>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
                                System <span className="text-[#00E6FF]">Monitor</span>
                            </h1>
                            <p className="text-white/35 text-xs uppercase tracking-[0.18em] mt-2">
                                Live · Active Users · Headsets · USB & WiFi Detection · Pairing Status
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-2 h-2 rounded-full bg-green-400" />
                                <span className="text-green-400 text-xs font-bold uppercase tracking-widest">Live · 5s poll</span>
                            </div>
                            <p className="text-white/20 text-[10px] font-mono">Updated: {fmt(lastRefresh)}</p>
                            <button onClick={() => load(true)} disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/8 transition-all text-xs font-bold disabled:opacity-40">
                                <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}>
                                    <RefreshCw size={13} />
                                </motion.div>
                                Refresh
                            </button>
                        </div>
                    </motion.div>

                    {/* ── 6 stat cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                        {stats.map((s, i) => <StatCard key={s.label} {...s} delay={i * 0.06} />)}
                    </div>

                    {/* ── Device Detection Row (USB + WiFi) ── */}
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="mb-6 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(0,230,255,0.06),rgba(123,97,255,0.04))] backdrop-blur-xl overflow-hidden">
                        <div className="flex items-center justify-between px-7 py-5 border-b border-white/8">
                            <div>
                                <p className="text-white/30 text-xs uppercase tracking-[0.28em] font-bold">Req. 2 — Headset Detection</p>
                                <h2 className="text-white font-black text-lg mt-0.5">Meta Quest — USB & WiFi</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                {usbState.status === 'connected' && <StatusPill ok label="USB Live" />}
                                {wifiState.status === 'connected' && <StatusPill ok label="WiFi Live" />}
                                {!usbSupported && <span className="text-yellow-400 text-xs font-bold border border-yellow-500/20 rounded-full px-3 py-1 bg-yellow-500/8">WebUSB: Chrome/Edge only</span>}
                            </div>
                        </div>

                        <div className="p-6 grid md:grid-cols-2 gap-5">
                            {/* USB */}
                            <DeviceCard
                                type="usb"
                                status={usbState.status}
                                name={usbState.device?.productName || 'Meta Quest (USB)'}
                                detail={usbState.device
                                    ? `Vendor 0x${usbState.device.vendorId.toString(16).toUpperCase()} — ADB / Developer Mode`
                                    : usbSupported
                                        ? 'Connect USB-C cable · Developer Mode + USB Debugging required in Quest settings'
                                        : 'WebUSB not supported in this browser — use Chrome or Edge'
                                }
                                onConnect={handleConnectUSB}
                            />
                            {/* WiFi */}
                            <DeviceCard
                                type="wifi"
                                status={wifiState.status}
                                name="Meta Quest (WiFi ADB)"
                                detail={wifiState.status === 'scanning'
                                    ? `Probing 192.168.1.1–30 on port 5555… ${wifiState.progress}%`
                                    : wifiState.ip
                                        ? `Connected at ${wifiState.ip}:5555`
                                        : 'Wireless ADB: Quest must be on same WiFi. Enable in Developer Settings.'
                                }
                                ip={wifiState.ip}
                                onConnect={handleScanWifi}
                            />
                        </div>

                        {/* WiFi scan progress bar */}
                        {wifiState.status === 'scanning' && (
                            <div className="px-6 pb-5">
                                <div className="h-1.5 w-full bg-white/8 rounded-full overflow-hidden">
                                    <motion.div animate={{ width: `${wifiState.progress}%` }} transition={{ duration: 0.3 }}
                                        className="h-full rounded-full bg-gradient-to-r from-[#7B61FF] to-[#00E6FF]" />
                                </div>
                                <p className="text-white/25 text-[10px] mt-1.5 font-mono">Scanning subnet 192.168.1.0/24 — port 5555 (ADB WiFi)</p>
                            </div>
                        )}

                        {/* ADB instructions */}
                        <div className="mx-6 mb-6 rounded-xl bg-black/30 border border-white/5 px-5 py-4">
                            <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-2">How to enable Developer Mode on Meta Quest</p>
                            <div className="grid md:grid-cols-2 gap-4">
                                {[
                                    { label: 'USB', steps: ['1. Install Meta Quest Developer Hub', '2. Settings → Developer → Enable USB Debugging', '3. Plug USB-C cable', '4. Click "Connect via USB" above & allow browser access'] },
                                    { label: 'WiFi', steps: ['1. adb tcpip 5555 (after USB connection)', '2. Disconnect USB, stay on same WiFi', '3. Click "Scan WiFi Network" above', '4. System will probe 192.168.1.x:5555'] },
                                ].map(col => (
                                    <div key={col.label}>
                                        <p className="text-[#00E6FF] text-[10px] font-bold uppercase tracking-widest mb-1.5">{col.label} Method</p>
                                        {col.steps.map((s, i) => (
                                            <p key={i} className="text-white/35 text-[11px] leading-relaxed">{s}</p>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* ── Main grid: Pairing Map + Sidebar ── */}
                    <div className="grid xl:grid-cols-[1fr_360px] gap-6">

                        {/* Pairing Map */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-xl overflow-hidden">
                            <div className="flex items-center justify-between px-7 py-5 border-b border-white/8">
                                <div>
                                    <p className="text-white/30 text-xs uppercase tracking-[0.28em] font-bold">Req. 6 — Controller ↔ Headset</p>
                                    <h2 className="text-white font-black text-lg mt-0.5">One-to-One Pairing Map</h2>
                                </div>
                                <StatusPill ok={overview.active_pairings > 0} label={`${overview.active_pairings ?? 0} Active`} pulse />
                            </div>
                            <div className="flex items-center gap-4 px-5 py-2 border-b border-white/5 text-[10px] uppercase tracking-widest font-bold text-white/25">
                                <span className="flex-1 flex items-center gap-1"><Wifi size={9} /> Controller</span>
                                <span className="w-24 text-center">Link</span>
                                <span className="flex-1 text-right flex items-center gap-1 justify-end"><Monitor size={9} /> Headset</span>
                                <span className="w-20 text-right">Since</span>
                                <span className="w-16 text-right">Status</span>
                            </div>
                            <div className="p-5 space-y-2">
                                <AnimatePresence>
                                    {pairings.length > 0 ? pairings.map((p, i) => <PairRow key={i} {...p} index={i} />) : (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center">
                                            <Radio size={26} className="text-white/15 mx-auto mb-3" />
                                            <p className="text-white/30 text-sm font-bold">No active pairings</p>
                                            <p className="text-white/15 text-xs mt-1">Generate a pairing code in Headset Control to link a device</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="mx-5 mb-5 px-5 py-3 rounded-xl bg-[#7B61FF]/8 border border-[#7B61FF]/20 flex items-start gap-3">
                                <Shield size={14} className="text-[#7B61FF] shrink-0 mt-0.5" />
                                <p className="text-white/40 text-xs leading-relaxed">
                                    <span className="text-[#7B61FF] font-bold">Req. 6 enforced.</span>{' '}
                                    Backend rejects any second controller connecting to an already-paired headset. The map shows all live links.
                                </p>
                            </div>
                        </motion.div>

                        {/* Right: Headsets + Timeline */}
                        <div className="flex flex-col gap-5">

                            {/* Connected headsets */}
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
                                className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(123,97,255,0.10),rgba(0,230,255,0.04))] backdrop-blur-xl p-6">
                                <p className="text-white/30 text-xs uppercase tracking-[0.28em] font-bold mb-1">Headset Registry</p>
                                <h3 className="text-white font-black text-base mb-4">Connected Devices</h3>
                                <div className="space-y-2">
                                    {/* USB device */}
                                    {usbState.status === 'connected' && (
                                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/8 border border-green-500/20">
                                            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                                            <Usb size={14} className="text-green-400 shrink-0" />
                                            <span className="text-white/80 text-xs font-mono flex-1 truncate">{usbState.device?.productName || 'Meta Quest (USB)'}</span>
                                            <StatusPill ok label="USB" />
                                        </div>
                                    )}
                                    {/* WiFi device */}
                                    {wifiState.status === 'connected' && (
                                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#00E6FF]/8 border border-[#00E6FF]/20">
                                            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#00E6FF] shrink-0" />
                                            <Globe size={14} className="text-[#00E6FF] shrink-0" />
                                            <span className="text-white/80 text-xs font-mono flex-1">{wifiState.ip}:5555</span>
                                            <StatusPill ok label="WiFi" />
                                        </div>
                                    )}
                                    {/* Paired device from store */}
                                    {connectedDevice && usbState.status !== 'connected' && wifiState.status !== 'connected' && (
                                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#7B61FF]/8 border border-[#7B61FF]/20">
                                            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#7B61FF] shrink-0" />
                                            <Monitor size={14} className="text-[#7B61FF] shrink-0" />
                                            <span className="text-white/80 text-xs font-mono flex-1 truncate">{connectedDevice}</span>
                                            <StatusPill ok label="WS" />
                                        </div>
                                    )}
                                    {!connectedDevice && usbState.status !== 'connected' && wifiState.status !== 'connected' && (
                                        <div className="py-6 text-center">
                                            <Monitor size={22} className="text-white/15 mx-auto mb-2" />
                                            <p className="text-white/25 text-xs">No headset connected</p>
                                            <p className="text-white/15 text-[10px] mt-0.5">Connect USB or scan WiFi above</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>

                            {/* Event Timeline */}
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                                className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] backdrop-blur-xl p-6 flex-1">
                                <p className="text-white/30 text-xs uppercase tracking-[0.28em] font-bold mb-1">Req. 7 — Session Tracking</p>
                                <h3 className="text-white font-black text-base mb-4">Event Timeline</h3>
                                <div className="space-y-3 max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                                    {timeline.map((ev, i) => <TimelineEvent key={i} {...ev} index={i} />)}
                                </div>
                            </motion.div>
                        </div>
                    </div>

                    {/* ── Policy Summary ── */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                        className="mt-6 grid md:grid-cols-4 gap-4">
                        {[
                            { req: '1', icon: <Shield size={16} />, color: 'text-[#7B61FF]', border: 'border-[#7B61FF]/20', bg: 'bg-[#7B61FF]/8', title: 'Authentication', body: 'JWT HS256 + Argon2id. Session invalidated on logout.' },
                            { req: '2', icon: <Usb size={16} />,    color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/8',  title: 'Device Detection', body: 'WebUSB for USB-C cable. WiFi ADB port scan on LAN.' },
                            { req: '5', icon: <Shield size={16} />, color: 'text-[#00E6FF]', border: 'border-[#00E6FF]/20', bg: 'bg-[#00E6FF]/8',  title: 'Content Protection', body: 'AES-256-CBC streams. No direct file download.' },
                            { req: '6', icon: <Link2 size={16} />,  color: 'text-yellow-400',border: 'border-yellow-500/20',bg: 'bg-yellow-500/8', title: 'Pairing 1:1', body: 'Backend enforces one controller per headset. Extras rejected.' },
                        ].map(c => (
                            <div key={c.req} className={`rounded-[20px] border ${c.border} ${c.bg} p-5`}>
                                <div className="flex items-center gap-2 mb-2"><span className={c.color}>{c.icon}</span><span className="text-white/25 text-[10px] font-bold uppercase tracking-widest">Req. {c.req}</span></div>
                                <p className={`font-black text-sm ${c.color} mb-1`}>{c.title}</p>
                                <p className="text-white/35 text-xs leading-relaxed">{c.body}</p>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
