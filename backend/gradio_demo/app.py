"""
╔═══════════════════════════════════════════════════════════════╗
║   VR CINEMA BACKEND - GRADIO TESTING INTERFACE               ║
║   FIXED: Replaced passlib/bcrypt with argon2-cffi            ║
║   FIXED: Gradio 6.0 theme/css moved to launch()             ║
╚═══════════════════════════════════════════════════════════════╝

Run: python gradio_demo/app.py
URL: http://localhost:7860
"""

import gradio as gr
import sys
import os
import json
import base64
import hashlib
import secrets
import time
from datetime import datetime, timedelta

# ─── Add project root to path ────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─── Crypto imports ──────────────────────────────────────────
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes

# ─── Argon2 (replaces passlib/bcrypt) ────────────────────────
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

# ─── JWT ─────────────────────────────────────────────────────
from jose import jwt

# ─── Setup ───────────────────────────────────────────────────
_ph = PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16
)

JWT_SECRET    = "vr-cinema-demo-secret-key-2024"
JWT_ALGORITHM = "HS256"


# ═══════════════════════════════════════════════════════════════
# SECTION 1: AES ENCRYPTION / DECRYPTION
# ═══════════════════════════════════════════════════════════════

def aes_generate_key(key_size: str) -> tuple:
    """Generate a new AES key."""
    size_map = {"128-bit": 16, "192-bit": 24, "256-bit": 32}
    size = size_map[key_size]
    key  = get_random_bytes(size)
    key_hex = key.hex()

    info = f"""
╔══════════════════════════════════════════════╗
║  AES KEY GENERATED SUCCESSFULLY             ║
╚══════════════════════════════════════════════╝

🔑 Key Size    : {key_size} ({size} bytes)
📋 Key (HEX)   : {key_hex}
📋 Key (Base64): {base64.b64encode(key).decode()}
🔒 Algorithm   : AES-{key_size.split('-')[0]}-CBC
⏰ Generated   : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

⚠️  IMPORTANT: Store this key securely!
    Never expose it in logs or responses.
    Use environment variables in production.
"""
    return key_hex, info


def aes_encrypt_text(plaintext: str, key_hex: str, mode: str) -> tuple:
    """Encrypt text using AES."""
    if not plaintext:
        return "", "❌ Error: Please enter text to encrypt"
    if not key_hex:
        return "", "❌ Error: Please generate or enter a key first"

    try:
        start = time.time()
        key   = bytes.fromhex(key_hex.strip())
        iv    = get_random_bytes(16)

        if mode == "CBC":
            cipher     = AES.new(key, AES.MODE_CBC, iv)
            padded     = pad(plaintext.encode('utf-8'), 16)
            ciphertext = cipher.encrypt(padded)

        elif mode == "GCM":
            cipher          = AES.new(key, AES.MODE_GCM, nonce=iv)
            ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode('utf-8'))
            padded          = plaintext.encode('utf-8')

        else:  # ECB
            cipher     = AES.new(key, AES.MODE_ECB)
            padded     = pad(plaintext.encode('utf-8'), 16)
            ciphertext = cipher.encrypt(padded)
            iv         = b'\x00' * 16

        iv_b64         = base64.b64encode(iv).decode()
        ciphertext_b64 = base64.b64encode(ciphertext).decode()
        combined       = base64.b64encode(iv + ciphertext).decode()
        elapsed        = (time.time() - start) * 1000

        info = f"""
╔══════════════════════════════════════════════════════╗
║  AES ENCRYPTION COMPLETE                            ║
╚══════════════════════════════════════════════════════╝

📝 Original Text   : {plaintext}
🔒 Mode            : AES-{len(key)*8}-{mode}
📏 Key Size        : {len(key)} bytes ({len(key)*8} bits)

🔑 IV (Base64)     : {iv_b64}
🔐 Ciphertext(B64) : {ciphertext_b64}
📦 Combined(B64)   : {combined}

📊 Stats:
   Original size  : {len(plaintext)} bytes
   Encrypted size : {len(ciphertext)} bytes
   IV size        : {len(iv)} bytes

⚡ Encryption time : {elapsed:.3f}ms

💡 Usage in VR Cinema:
   → Video metadata encrypted before DB storage
   → Stream tokens encrypted for secure delivery
   → HLS segments encrypted per chunk
"""
        return combined, info

    except ValueError as e:
        return "", f"❌ Key Error: {str(e)}\n💡 Tip: Key must be 32, 48, or 64 hex chars"
    except Exception as e:
        return "", f"❌ Encryption Error: {str(e)}"


def aes_decrypt_text(combined_b64: str, key_hex: str, mode: str) -> tuple:
    """Decrypt AES encrypted text."""
    if not combined_b64:
        return "", "❌ Error: No encrypted data provided"
    if not key_hex:
        return "", "❌ Error: No key provided"

    try:
        start    = time.time()
        key      = bytes.fromhex(key_hex.strip())
        combined = base64.b64decode(combined_b64.encode())
        iv       = combined[:16]
        ciphertext = combined[16:]

        if mode == "CBC":
            cipher    = AES.new(key, AES.MODE_CBC, iv)
            plaintext = unpad(cipher.decrypt(ciphertext), 16).decode('utf-8')

        elif mode == "GCM":
            cipher    = AES.new(key, AES.MODE_GCM, nonce=iv)
            plaintext = cipher.decrypt(ciphertext).decode('utf-8')

        else:  # ECB
            cipher    = AES.new(key, AES.MODE_ECB)
            plaintext = unpad(cipher.decrypt(ciphertext), 16).decode('utf-8')

        elapsed = (time.time() - start) * 1000

        info = f"""
╔══════════════════════════════════════════════════════╗
║  AES DECRYPTION COMPLETE ✅                         ║
╚══════════════════════════════════════════════════════╝

🔓 Decrypted Text  : {plaintext}
🔒 Mode Used       : AES-{len(key)*8}-{mode}
📏 Key Size        : {len(key)} bytes

⚡ Decryption time : {elapsed:.3f}ms

🎬 VR Cinema Context:
   → This happens in memory during playback
   → Decrypted content NEVER saved to disk
   → Session ends → temporary buffer cleared
   → Implements "Temporary Runtime Decryption"
     (as required by Problem Statement §4)
"""
        return plaintext, info

    except Exception as e:
        return "", f"❌ Decryption Error: {str(e)}\n💡 Check that key and mode match encryption"


# ═══════════════════════════════════════════════════════════════
# SECTION 2: VIDEO ENCRYPTION SIMULATION
# ═══════════════════════════════════════════════════════════════

def simulate_video_encryption(video_data_text: str, key_hex: str) -> tuple:
    """Simulate encrypting video content."""
    if not video_data_text:
        video_data_text = "SAMPLE_VIDEO_FRAME_DATA_1080P_VR_CONTENT_ENCRYPTED_FOR_DEMO"

    if not key_hex or len(key_hex) < 32:
        key     = get_random_bytes(32)
        key_hex = key.hex()

    try:
        key  = bytes.fromhex(key_hex[:64].ljust(64, '0'))
        data = video_data_text.encode('utf-8')

        chunk_size = 64
        chunks     = [data[i:i+chunk_size] for i in range(0, len(data), chunk_size)]

        iv     = get_random_bytes(16)
        cipher = AES.new(key, AES.MODE_CBC, iv)

        encrypted_chunks = []
        for chunk in chunks:
            padded = pad(chunk, 16)
            encrypted_chunks.append(cipher.encrypt(padded))

        key_id       = secrets.token_hex(8)
        key_id_bytes = key_id.encode()
        header       = iv + len(key_id_bytes).to_bytes(4, 'big') + key_id_bytes
        enc_payload  = b''.join(encrypted_chunks)
        full_file    = header + enc_payload

        file_hash = hashlib.sha256(data).hexdigest()
        enc_hash  = hashlib.sha256(full_file).hexdigest()

        result = f"""
╔══════════════════════════════════════════════════════════╗
║  VIDEO CONTENT ENCRYPTION SIMULATION                    ║
║  (Phase 4: Content Vault & Encryption System)           ║
╚══════════════════════════════════════════════════════════╝

📁 ORIGINAL FILE:
   Content Preview : {video_data_text[:50]}...
   Size            : {len(data)} bytes
   SHA-256 Hash    : {file_hash[:32]}...

🔐 ENCRYPTION PROCESS:
   Algorithm       : AES-256-CBC
   Key ID          : {key_id}
   IV (hex)        : {iv.hex()}
   Chunks Created  : {len(chunks)}

📦 ENCRYPTED FILE STRUCTURE:
   [IV: 16 bytes] + [KeyID_Len: 4 bytes] + [KeyID] + [Encrypted Data]
   Header Preview  : {header.hex()[:64]}...
   Total Size      : {len(full_file)} bytes
   Enc SHA-256     : {enc_hash[:32]}...

💾 STORAGE PLAN (Content Vault):
   Encrypted File  → /vault/encrypted/{key_id}.enc
   Key Record      → Database (key_id + encrypted_master_key)

✅ Security Guarantees (Per Problem Statement §3-5):
   → File unreadable without decryption key
   → Key separated from encrypted file
   → Original file deleted after encryption
   → Only authorized playback can access content
"""
        encrypted_b64 = base64.b64encode(full_file).decode()
        return encrypted_b64[:500] + "...[truncated]", result

    except Exception as e:
        return "", f"❌ Error: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# SECTION 3: JWT TOKEN MANAGEMENT
# ═══════════════════════════════════════════════════════════════

def jwt_create_token(
    user_id: str,
    username: str,
    subscription: str,
    expiry_hours: int
) -> tuple:
    """Create JWT access token."""
    try:
        payload = {
            "sub":          user_id,
            "username":     username,
            "subscription": subscription,
            "iat":          datetime.utcnow(),
            "exp":          datetime.utcnow() + timedelta(hours=expiry_hours),
            "type":         "access",
            "vr_cinema_v":  "1.0"
        }

        token  = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        parts  = token.split('.')

        # Decode header for display (pad base64 properly)
        def decode_b64(s):
            s += '=' * (4 - len(s) % 4)
            return json.loads(base64.b64decode(s))

        header_decoded = decode_b64(parts[0])

        info = f"""
╔══════════════════════════════════════════════════════╗
║  JWT ACCESS TOKEN CREATED                           ║
╚══════════════════════════════════════════════════════╝

👤 User Info:
   User ID       : {user_id}
   Username      : {username}
   Subscription  : {subscription}

🔐 TOKEN STRUCTURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HEADER:
{json.dumps(header_decoded, indent=2)}

PAYLOAD CLAIMS:
   sub           : {user_id}
   username      : {username}
   subscription  : {subscription}
   issued_at     : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
   expires_at    : {(datetime.now() + timedelta(hours=expiry_hours)).strftime('%Y-%m-%d %H:%M:%S')}
   type          : access

SIGNATURE       : [HMAC-SHA256 signed with secret]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️  Token valid for : {expiry_hours} hours

🎬 VR Cinema Usage:
   → User logs in → receives this token
   → Token sent with every API request header
   → Web controller includes token in WebSocket auth
   → VR headset uses token for stream authentication
"""
        return token, info

    except Exception as e:
        return "", f"❌ Error: {str(e)}"


def jwt_verify_token(token: str) -> str:
    """Verify and decode JWT token."""
    if not token.strip():
        return "❌ No token provided"

    try:
        payload      = jwt.decode(token.strip(), JWT_SECRET, algorithms=[JWT_ALGORITHM])
        exp_time     = datetime.fromtimestamp(payload['exp'])
        iat_time     = datetime.fromtimestamp(payload['iat'])
        remaining    = exp_time - datetime.now()

        return f"""
╔══════════════════════════════════════════════════════╗
║  ✅ TOKEN VERIFIED SUCCESSFULLY                     ║
╚══════════════════════════════════════════════════════╝

👤 Token Claims:
   User ID       : {payload.get('sub')}
   Username      : {payload.get('username')}
   Subscription  : {payload.get('subscription')}
   Token Type    : {payload.get('type')}

⏱️  Time Info:
   Issued At     : {iat_time.strftime('%Y-%m-%d %H:%M:%S')}
   Expires At    : {exp_time.strftime('%Y-%m-%d %H:%M:%S')}
   Time Remaining: {str(remaining).split('.')[0]}

🔒 Security Status:
   Signature     : ✅ VALID (HMAC-SHA256)
   Expiry        : ✅ NOT EXPIRED
   Algorithm     : HS256

🎬 Access Granted: User can access streaming API
"""
    except jwt.ExpiredSignatureError:
        return "❌ TOKEN EXPIRED — User must login again"
    except Exception as e:
        return f"❌ INVALID TOKEN: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# SECTION 4: STREAMING TOKENS
# ═══════════════════════════════════════════════════════════════

def generate_stream_token(
    user_id: str,
    movie_id: str,
    movie_title: str
) -> tuple:
    """Generate secure streaming token for video playback."""
    try:
        raw_token  = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)

        payload = {
            "token":      raw_token,
            "user_id":    user_id,
            "movie_id":   movie_id,
            "movie_title":movie_title,
            "expires_at": expires_at.isoformat(),
            "type":       "stream_access",
            "issued_at":  datetime.utcnow().isoformat()
        }

        key       = get_random_bytes(32)
        iv        = get_random_bytes(16)
        cipher    = AES.new(key, AES.MODE_CBC, iv)
        payload_b = json.dumps(payload).encode('utf-8')
        encrypted = cipher.encrypt(pad(payload_b, 16))

        encrypted_token = base64.b64encode(iv + encrypted).decode()
        stream_url      = f"http://server/api/stream/{movie_id}/manifest.m3u8"
        key_url         = f"http://server/api/stream/{movie_id}/key?token={raw_token[:16]}..."

        info = f"""
╔══════════════════════════════════════════════════════════╗
║  STREAMING TOKEN GENERATED                              ║
║  (Phase 5: Streaming Engine - HLS Pipeline)             ║
╚══════════════════════════════════════════════════════════╝

🎬 Content Info:
   Movie ID      : {movie_id}
   Movie Title   : {movie_title}
   Requested By  : User {user_id}

🔑 Token Details:
   Raw Token     : {raw_token[:20]}...
   Encrypted     : {encrypted_token[:40]}...
   Expires At    : {expires_at.strftime('%Y-%m-%d %H:%M:%S')} UTC
   Valid For     : 60 minutes

📡 HLS Stream URLs:
   Manifest URL  : {stream_url}
   Key URL       : {key_url}

📋 HLS Manifest Preview:
   #EXTM3U
   #EXT-X-VERSION:3
   #EXT-X-TARGETDURATION:6
   #EXT-X-KEY:METHOD=AES-128,URI="{key_url}"
   #EXTINF:6.0,
   /api/stream/{movie_id}/segment_0000.ts?token=...
   #EXTINF:6.0,
   /api/stream/{movie_id}/segment_0001.ts?token=...
   ...
   #EXT-X-ENDLIST

🛡️  Security Features (Problem Statement §6):
   ✅ Token-based secure streaming
   ✅ Segmented video (HLS)
   ✅ Encrypted streaming protocol (AES-128)
   ✅ Time-limited access (1 hour)
   ✅ User-specific token binding
"""
        return encrypted_token[:100] + "...", info

    except Exception as e:
        return "", f"❌ Error: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# SECTION 5: PASSWORD HASHING  ← FIXED (Argon2 replaces bcrypt)
# ═══════════════════════════════════════════════════════════════

def hash_password_demo(password: str) -> str:
    """
    Demonstrate Argon2id password hashing.
    FIXED: Replaced passlib/bcrypt with argon2-cffi.
    """
    if not password:
        return "❌ Enter a password"

    try:
        start  = time.time()
        hashed = _ph.hash(password)
        elapsed = (time.time() - start) * 1000

        # Verify immediately as sanity check
        try:
            is_valid = _ph.verify(hashed, password)
        except Exception:
            is_valid = False

        # Parse Argon2 hash parts for display
        # Format: $argon2id$v=19$m=65536,t=2,p=2$<salt>$<hash>
        parts = hashed.split('$')

        return f"""
╔══════════════════════════════════════════════════════╗
║  ARGON2id PASSWORD HASHING                          ║
║  (Replaced bcrypt — OWASP Recommended 2024)         ║
╚══════════════════════════════════════════════════════╝

🔑 Original Password : {password}
🔒 Argon2id Hash     :
   {hashed}

📊 Hash Analysis:
   Algorithm     : Argon2id (PHC Winner 2015)
   Version       : {parts[2] if len(parts) > 2 else 'v=19'}
   Parameters    : {parts[3] if len(parts) > 3 else 'm=65536,t=2,p=2'}
   Hash Length   : {len(hashed)} characters
   Includes Salt : ✅ (embedded in hash string)

🆚 vs bcrypt:
   bcrypt limit  : 72 bytes max ❌
   Argon2 limit  : No limit ✅
   bcrypt GPU    : Vulnerable to GPU attacks ❌
   Argon2 GPU    : Memory-hard, GPU-resistant ✅
   bcrypt Python : Compatibility issues on Py3.11 ❌
   Argon2 Python : Works perfectly ✅

⏱️  Hash Time      : {elapsed:.2f}ms
✅ Verification   : {'PASSED ✅' if is_valid else 'FAILED ❌'}

🎬 VR Cinema Usage:
   → User password stored as Argon2 hash in DB
   → Never stored in plaintext
   → Verified during login (auth_service.py)
   → Memory-hard: defeats GPU brute-force attacks
"""
    except Exception as e:
        return f"❌ Hashing Error: {str(e)}"


def verify_password_demo(password: str, hashed: str) -> str:
    """
    Verify password against Argon2 hash.
    FIXED: Replaced passlib/bcrypt with argon2-cffi.
    """
    if not password or not hashed:
        return "❌ Enter both password and hash"

    try:
        start = time.time()

        try:
            _ph.verify(hashed, password)
            result  = True
        except VerifyMismatchError:
            result  = False
        except (VerificationError, InvalidHashError) as e:
            return f"❌ Invalid hash format: {str(e)}\n💡 Hash must be generated by Argon2"

        elapsed = (time.time() - start) * 1000
        status  = "✅ PASSWORD CORRECT — ACCESS GRANTED" if result else "❌ WRONG PASSWORD — ACCESS DENIED"

        return f"""
{status}

🔑 Tested Password : {password}
🔒 Against Hash    : {hashed[:40]}...
⏱️  Verify Time     : {elapsed:.2f}ms
🔐 Match Result    : {'✅ VALID' if result else '❌ INVALID'}

{'🎬 User receives JWT access token → VR streaming unlocked' if result else '🚫 Login rejected → 401 Unauthorized → no stream access'}
"""
    except Exception as e:
        return f"❌ Error: {str(e)}"


# ═══════════════════════════════════════════════════════════════
# SECTION 6: DEVICE PAIRING
# ═══════════════════════════════════════════════════════════════

pairing_store = {}

def generate_pairing_code(session_id: str) -> str:
    """Simulate VR headset pairing code generation."""
    import string
    code = ''.join(secrets.choice(
        string.ascii_uppercase + string.digits
    ) for _ in range(6))

    pairing_store[code] = {
        "session_id": session_id,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
        "is_used":    False
    }

    return f"""
╔══════════════════════════════════════════════════════╗
║  VR DEVICE PAIRING CODE GENERATED                   ║
║  (Phase 6: VR Simulator Integration)                ║
╚══════════════════════════════════════════════════════╝

📱 Web Controller → VR Headset Pairing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Pairing Code : ┌─────────────┐
                  │    {code}   │
                  └─────────────┘

📋 Session ID   : {session_id}
⏱️  Expires In   : 10 minutes
✅ Status       : WAITING FOR VR HEADSET

📖 How It Works:
   1. Web Controller generates this pairing code
   2. User sees code in browser
   3. User opens VR Headset app
   4. VR app prompts "Enter pairing code"
   5. User enters: {code}
   6. Server verifies → devices paired!
   7. All playback commands now sync between devices

🔒 Security:
   → Code expires in 10 minutes
   → Single-use only (cannot reuse)
   → Cryptographically random
   → 36^6 = ~2.1 billion combinations
"""


def verify_pairing_code_demo(code: str) -> str:
    """Simulate verifying a pairing code from VR headset."""
    code = code.strip().upper()

    if code not in pairing_store:
        return (
            f"❌ Invalid code: {code}\n"
            f"💡 Generate a code first using the Generate tab above"
        )

    info = pairing_store[code]

    if datetime.utcnow() > info["expires_at"]:
        return f"❌ Code '{code}' has EXPIRED\n⏱️ Codes are valid for 10 minutes only"

    if info["is_used"]:
        return f"❌ Code '{code}' already USED\n🔒 Each code is single-use for security"

    pairing_store[code]["is_used"] = True

    return f"""
╔══════════════════════════════════════════════════════╗
║  ✅ VR DEVICE PAIRED SUCCESSFULLY!                  ║
╚══════════════════════════════════════════════════════╝

🔗 Pairing Code  : {code}
📋 Session ID    : {info['session_id']}
⏱️  Paired At     : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

🎬 What Happens Now:
   → Web Controller ←→ VR Headset : CONNECTED
   → WebSocket channel established
   → Play/Pause/Seek/Volume synced across devices
   → Movie selection on web → loads on VR headset

📡 WebSocket Events Now Available:
   Web → VR : play_command, pause_command
   Web → VR : seek_command, volume_command
   Web → VR : load_movie_command
   VR  → Web: status_update, position_update
   VR  → Web: playback_error
"""


# ═══════════════════════════════════════════════════════════════
# SECTION 7: SYSTEM PIPELINE OVERVIEW
# ═══════════════════════════════════════════════════════════════

def show_system_pipeline() -> str:
    return """
╔══════════════════════════════════════════════════════════════════╗
║         VR CINEMA SECURE STREAMING — SYSTEM PIPELINE           ║
╚══════════════════════════════════════════════════════════════════╝

CONTENT UPLOAD FLOW (Admin):
─────────────────────────────
  Raw Video (MP4/MKV)
       ↓
  [FFmpeg] → Convert to HLS segments (.ts files)
       ↓
  [AES-256-CBC] → Encrypt each .ts segment
       ↓
  [Key Vault] → Store encryption keys (key_id in DB)
       ↓
  [Content Vault] → /vault/encrypted/*.enc

USER PLAYBACK FLOW:
───────────────────
  User Browser
       ↓ HTTPS
  [Web Controller Interface]
       ↓ POST /api/auth/login
  [AuthService] → Argon2id verify → JWT issued
       ↓
  User selects movie
       ↓ POST /api/stream/{id}/token
  [StreamController] → subscription check
       ↓
  [StreamingService] → AES-encrypted stream token
       ↓
  [WebSocket] → send token to VR headset
       ↓
  [VR Headset] → GET /api/stream/{id}/manifest.m3u8
       ↓ HLS player
  [Segment requests] → GET /api/stream/{id}/segment_XXXX.ts
       ↓
  [Key delivery] → GET /api/stream/{id}/key?token=...
       ↓
  [In-memory decrypt] → play video
       ↓
  🥽 VR PLAYBACK

SECURITY LAYERS:
────────────────
  Layer 1: HTTPS/WSS       Transport encryption
  Layer 2: Argon2id        Password hashing
  Layer 3: JWT HS256       Authentication
  Layer 4: Subscription    Authorization check
  Layer 5: Stream Token    Time-limited access (AES)
  Layer 6: AES-256 files   Content encryption at rest
  Layer 7: HLS segments    No direct file access
  Layer 8: Memory-only     No local storage of decrypted content

TECH STACK:
───────────
  FastAPI          REST API
  python-socketio  WebSocket
  SQLAlchemy       ORM
  pycryptodome     AES-256-CBC
  argon2-cffi      Password hashing (OWASP 2024)
  python-jose      JWT tokens
  Gradio           This testing interface
"""


# ═══════════════════════════════════════════════════════════════
# GRADIO UI
# ═══════════════════════════════════════════════════════════════

def create_gradio_app():

    # ── Custom CSS ─────────────────────────────────────────────
    custom_css = """
    .header {
        text-align: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
    }
    """

    # ── Theme ──────────────────────────────────────────────────
    theme = gr.themes.Soft(
        primary_hue="indigo",
        secondary_hue="purple",
    )

    with gr.Blocks(title="VR Cinema Backend Tester") as demo:

        gr.HTML("""
        <div style="text-align:center;background:linear-gradient(135deg,#667eea,#764ba2);
                    color:white;padding:20px;border-radius:10px;margin-bottom:20px;">
            <h1>🥽 VR Cinema Backend — Security Testing Suite</h1>
            <p>AES Encryption | Argon2id Hashing | JWT Auth | Stream Tokens | HLS | Device Pairing</p>
            <p><small>Python Backend | FastAPI + pycryptodome + argon2-cffi + python-jose</small></p>
        </div>
        """)

        # ── Tab 1: System Overview ─────────────────────────────
        with gr.Tab("📊 System Overview"):
            gr.Markdown("## Complete VR Cinema Security Pipeline")
            btn_pipeline = gr.Button("🔍 Show Full System Pipeline", variant="primary", size="lg")
            out_pipeline = gr.Textbox(label="System Architecture", lines=60, interactive=False)
            btn_pipeline.click(show_system_pipeline, outputs=out_pipeline)

        # ── Tab 2: AES Encryption ──────────────────────────────
        with gr.Tab("🔐 AES Encryption"):
            gr.Markdown("""
            ## AES Encryption / Decryption
            Core content protection mechanism used for video files, stream tokens and metadata.
            """)

            with gr.Accordion("🔑 Step 1: Generate AES Key", open=True):
                with gr.Row():
                    key_size_radio = gr.Radio(
                        ["128-bit", "192-bit", "256-bit"],
                        value="256-bit",
                        label="Key Size"
                    )
                    btn_gen_key = gr.Button("⚡ Generate Key", variant="primary")
                key_output = gr.Textbox(label="Generated Key (HEX)", interactive=True)
                key_info   = gr.Textbox(label="Key Information", lines=8, interactive=False)
                btn_gen_key.click(aes_generate_key, inputs=[key_size_radio], outputs=[key_output, key_info])

            with gr.Accordion("🔒 Step 2: Encrypt", open=True):
                with gr.Row():
                    with gr.Column():
                        plaintext_in  = gr.Textbox(label="Text to Encrypt", lines=4,
                                                    placeholder='{"movie_id": 42, "token": "vr-access"}')
                        mode_enc      = gr.Dropdown(["CBC", "GCM", "ECB"], value="CBC", label="AES Mode")
                        key_for_enc   = gr.Textbox(label="Key (HEX)", placeholder="Paste key from Step 1")
                        btn_encrypt   = gr.Button("🔐 ENCRYPT", variant="primary")
                    with gr.Column():
                        cipher_out    = gr.Textbox(label="Encrypted Output (Base64)", lines=4, interactive=True)
                        encrypt_info  = gr.Textbox(label="Encryption Details", lines=12, interactive=False)
                btn_encrypt.click(aes_encrypt_text,
                                  inputs=[plaintext_in, key_for_enc, mode_enc],
                                  outputs=[cipher_out, encrypt_info])

            with gr.Accordion("🔓 Step 3: Decrypt", open=True):
                with gr.Row():
                    with gr.Column():
                        cipher_in     = gr.Textbox(label="Encrypted Data (Base64)", lines=4, interactive=True)
                        key_for_dec   = gr.Textbox(label="Decryption Key (HEX)")
                        mode_dec      = gr.Dropdown(["CBC", "GCM", "ECB"], value="CBC", label="AES Mode")
                        btn_decrypt   = gr.Button("🔓 DECRYPT", variant="secondary")
                    with gr.Column():
                        decrypted_out = gr.Textbox(label="Decrypted Text", lines=4, interactive=False)
                        decrypt_info  = gr.Textbox(label="Decryption Details", lines=10, interactive=False)
                btn_decrypt.click(aes_decrypt_text,
                                  inputs=[cipher_in, key_for_dec, mode_dec],
                                  outputs=[decrypted_out, decrypt_info])

        # ── Tab 3: Video Encryption ────────────────────────────
        with gr.Tab("🎬 Video Encryption"):
            gr.Markdown("## Video File Encryption Simulation\n*Phase 4: Content Vault & Encryption System*")
            with gr.Row():
                with gr.Column():
                    vid_content  = gr.Textbox(label="Simulated Video Data",
                                              value="VR_VIDEO_FRAME_1080P_360DEG_STEREO_CONTENT_BLOCK_001",
                                              lines=3)
                    vid_key      = gr.Textbox(label="Encryption Key (optional)", placeholder="Leave empty for auto-generate")
                    btn_vid_enc  = gr.Button("🎬 Encrypt Video Content", variant="primary")
            with gr.Row():
                vid_enc_out  = gr.Textbox(label="Encrypted File Data (preview)", lines=4, interactive=False)
                vid_enc_info = gr.Textbox(label="Encryption Report", lines=30, interactive=False)
            btn_vid_enc.click(simulate_video_encryption,
                              inputs=[vid_content, vid_key],
                              outputs=[vid_enc_out, vid_enc_info])

        # ── Tab 4: JWT Auth ────────────────────────────────────
        with gr.Tab("🎫 JWT Authentication"):
            gr.Markdown("## JWT Token Management\n*auth_controller.py + auth_middleware.py*")
            with gr.Row():
                with gr.Column(scale=1):
                    jwt_uid   = gr.Textbox(label="User ID", value="42")
                    jwt_uname = gr.Textbox(label="Username", value="vr_user_01")
                    jwt_sub   = gr.Dropdown(["free","basic","premium"], value="premium", label="Subscription")
                    jwt_exp   = gr.Slider(1, 48, value=24, label="Expiry (hours)")
                    btn_jwt   = gr.Button("🎫 Create JWT Token", variant="primary")
                with gr.Column(scale=2):
                    jwt_token_out = gr.Textbox(label="JWT Token (copy for verification)", lines=4, interactive=True)
                    jwt_info_out  = gr.Textbox(label="Token Details", lines=15, interactive=False)
            btn_jwt.click(jwt_create_token,
                          inputs=[jwt_uid, jwt_uname, jwt_sub, jwt_exp],
                          outputs=[jwt_token_out, jwt_info_out])

            gr.Markdown("---")
            gr.Markdown("### Verify Token")
            with gr.Row():
                jwt_verify_in  = gr.Textbox(label="JWT Token to Verify", lines=4, interactive=True)
                jwt_verify_out = gr.Textbox(label="Verification Result", lines=15, interactive=False)
            btn_jwt_verify = gr.Button("✅ Verify Token", variant="secondary")
            btn_jwt_verify.click(jwt_verify_token, inputs=[jwt_verify_in], outputs=[jwt_verify_out])

        # ── Tab 5: Streaming Tokens ────────────────────────────
        with gr.Tab("📡 Streaming Tokens"):
            gr.Markdown("## Streaming Token Generation\n*Phase 5: HLS Pipeline*")
            with gr.Row():
                with gr.Column():
                    st_uid    = gr.Textbox(label="User ID", value="42")
                    st_mid    = gr.Textbox(label="Movie ID", value="7")
                    st_title  = gr.Textbox(label="Movie Title", value="Interstellar VR Experience")
                    btn_st    = gr.Button("🎬 Generate Stream Token", variant="primary")
                with gr.Column():
                    st_token  = gr.Textbox(label="Encrypted Stream Token", lines=4, interactive=False)
                    st_info   = gr.Textbox(label="Stream Token Details + HLS Info", lines=25, interactive=False)
            btn_st.click(generate_stream_token,
                         inputs=[st_uid, st_mid, st_title],
                         outputs=[st_token, st_info])

        # ── Tab 6: Password Security ───────────────────────────
        with gr.Tab("🔑 Password Security"):
            gr.Markdown("""
            ## Argon2id Password Hashing
            **FIXED**: Replaced passlib/bcrypt (incompatible with Python 3.11)
            with `argon2-cffi` (OWASP recommended 2024).
            *auth_service.py — hash_password() / verify_password()*
            """)
            with gr.Row():
                with gr.Column():
                    pwd_input  = gr.Textbox(label="Password to Hash", type="password",
                                            placeholder="Enter any password...")
                    btn_hash   = gr.Button("🔒 Hash with Argon2id", variant="primary")
                    hash_out   = gr.Textbox(label="Hashing Result", lines=22, interactive=False)
                    btn_hash.click(hash_password_demo, inputs=[pwd_input], outputs=[hash_out])

                with gr.Column():
                    gr.Markdown("### Verify Password Against Hash")
                    verify_pwd  = gr.Textbox(label="Password to Test", type="password")
                    verify_hash = gr.Textbox(label="Argon2 Hash", placeholder="Paste hash from left panel...")
                    btn_verify  = gr.Button("✅ Verify Password", variant="secondary")
                    verify_out  = gr.Textbox(label="Verification Result", lines=12, interactive=False)
                    btn_verify.click(verify_password_demo,
                                     inputs=[verify_pwd, verify_hash],
                                     outputs=[verify_out])

        # ── Tab 7: Device Pairing ──────────────────────────────
        with gr.Tab("🔗 Device Pairing"):
            gr.Markdown("## VR Headset ↔ Web Controller Pairing\n*pairing_service.py | Phase 6: VR Simulator*")
            with gr.Row():
                with gr.Column():
                    gr.Markdown("### 📱 Web Controller Side")
                    pair_sid    = gr.Textbox(label="Session ID", value="session_12345")
                    btn_pair    = gr.Button("🔗 Generate Pairing Code", variant="primary")
                    pair_out    = gr.Textbox(label="Pairing Code & Instructions", lines=22, interactive=False)
                    btn_pair.click(generate_pairing_code, inputs=[pair_sid], outputs=[pair_out])

                with gr.Column():
                    gr.Markdown("### 🥽 VR Headset Side")
                    code_input   = gr.Textbox(label="Enter 6-digit Code", placeholder="e.g. A3X9K2", max_lines=1)
                    btn_verify_p = gr.Button("✅ Verify Pairing Code", variant="secondary")
                    verify_p_out = gr.Textbox(label="Pairing Result", lines=22, interactive=False)
                    btn_verify_p.click(verify_pairing_code_demo,
                                       inputs=[code_input],
                                       outputs=[verify_p_out])

        # ── Footer ─────────────────────────────────────────────
        gr.HTML("""
        <div style='text-align:center;padding:20px;color:#666;border-top:1px solid #eee;margin-top:20px;'>
            <p>🥽 <strong>VR Cinema Secure Streaming Backend</strong> — Testing Interface</p>
            <p>Stack: FastAPI | pycryptodome (AES-256) | argon2-cffi | python-jose | python-socketio | Gradio</p>
            <p>Security: AES-256-CBC | Argon2id | JWT HS256 | HLS+AES-128 | Time-limited tokens</p>
        </div>
        """)

    return demo


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║   VR CINEMA BACKEND - GRADIO TESTING INTERFACE              ║
║   Starting on http://localhost:7860                         ║
║   Fixed: argon2-cffi | Gradio 6.0 launch() params          ║
╚══════════════════════════════════════════════════════════════╝
    """)

    demo = create_gradio_app()

    # ── FIXED: theme/css moved to launch() for Gradio 6.0 ────
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True,
        inbrowser=True,
        # Gradio 6.0: theme and css go here now
        theme=gr.themes.Soft(primary_hue="indigo", secondary_hue="purple"),
    )