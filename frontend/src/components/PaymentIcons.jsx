// Exact brand SVG Icons for UPI payment apps

export function GPay({ size = 40 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="white"/>
            {/* Google G */}
            <path d="M20.5 18.5H27.2C27.4 19.2 27.5 20 27.5 20.8C27.5 24.6 24.8 27.5 20.5 27.5C16.6 27.5 13.5 24.4 13.5 20.5C13.5 16.6 16.6 13.5 20.5 13.5C22.4 13.5 24.0 14.2 25.2 15.3L23.2 17.3C22.4 16.6 21.5 16.2 20.5 16.2C18.1 16.2 16.2 18.1 16.2 20.5C16.2 22.9 18.1 24.8 20.5 24.8C22.5 24.8 23.9 23.7 24.4 22.2H20.5V18.5Z" fill="#4285F4"/>
            <text x="20.5" y="35" fontSize="7" fontWeight="700" fill="#4285F4" textAnchor="middle" fontFamily="'Google Sans', Arial, sans-serif">Pay</text>
        </svg>
    )
}

export function PhonePe({ size = 40 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#5F259F"/>
            {/* PhonePe stylized P */}
            <path d="M13 10H21C24.3 10 27 12.7 27 16C27 19.3 24.3 22 21 22H17V30H13V10Z" fill="white"/>
            <path d="M17 14H21C22.1 14 23 14.9 23 16C23 17.1 22.1 18 21 18H17V14Z" fill="#5F259F"/>
            <circle cx="28" cy="28" r="4" fill="#00BAF2"/>
        </svg>
    )
}

export function Paytm({ size = 40 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#002970"/>
            <rect x="6" y="14" width="12" height="12" rx="2" fill="#00BAF2"/>
            <rect x="10" y="18" width="8" height="8" rx="1" fill="#002970"/>
            <text x="21" y="24" fontSize="10" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">tm</text>
            <text x="6" y="34" fontSize="6.5" fontWeight="700" fill="#00BAF2" fontFamily="Arial, sans-serif">PAYTM</text>
        </svg>
    )
}

export function BHIM({ size = 40 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#00529B"/>
            {/* Ashoka chakra simplified */}
            <circle cx="20" cy="16" r="7" fill="#FF9933"/>
            <circle cx="20" cy="16" r="5" fill="white"/>
            <circle cx="20" cy="16" r="3" fill="#000080"/>
            <circle cx="20" cy="16" r="1.2" fill="white"/>
            {/* Spokes */}
            {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
                <line key={i}
                    x1={20 + 1.2 * Math.cos(deg * Math.PI / 180)}
                    y1={16 + 1.2 * Math.sin(deg * Math.PI / 180)}
                    x2={20 + 3 * Math.cos(deg * Math.PI / 180)}
                    y2={16 + 3 * Math.sin(deg * Math.PI / 180)}
                    stroke="white" strokeWidth="0.5"
                />
            ))}
            <text x="20" y="34" fontSize="9" fontWeight="900" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif">BHIM</text>
        </svg>
    )
}

export function AmazonPay({ size = 40 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="#232F3E"/>
            {/* amazon text */}
            <text x="20" y="19" fontSize="9" fontWeight="700" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif">amazon</text>
            {/* smile arrow */}
            <path d="M11 23 Q20 29 29 23" stroke="#FF9900" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M27 21 L29 23 L27 25" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <text x="20" y="35" fontSize="7" fontWeight="700" fill="#FF9900" textAnchor="middle" fontFamily="Arial, sans-serif">pay</text>
        </svg>
    )
}

export function UpiIcon({ size = 40 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="10" fill="white"/>
            {/* NPCI UPI colors: Purple + Orange */}
            <path d="M8 20L16 10H24L20 20L24 30H16L8 20Z" fill="#6B3FA0"/>
            <path d="M20 20L28 10H36V30H28L20 20Z" fill="#F37920"/>
            <text x="20" y="37" fontSize="6" fontWeight="700" fill="#6B3FA0" textAnchor="middle" fontFamily="Arial, sans-serif">UPI</text>
        </svg>
    )
}
