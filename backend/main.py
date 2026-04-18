"""
main.py — Robust entry point for Render deployment.
Start Command: python -u main.py
"""
import sys
import os

# Force stdout/stderr to be unbuffered so logs appear immediately on Render
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

print("=" * 60, flush=True)
print("VR Cinema Backend — Starting Up", flush=True)
print("=" * 60, flush=True)

# ── Step 1: Diagnose ──────────────────────────────────────────
print("[1] Python version:", sys.version, flush=True)
print("[2] Working directory:", os.getcwd(), flush=True)
print("[3] PORT env var:", os.environ.get("PORT", "NOT SET"), flush=True)
print("[4] DATABASE_URL:", os.environ.get("DATABASE_URL", "NOT SET"), flush=True)
print("[5] AES_KEY set:", "YES" if os.environ.get("AES_KEY") else "NO", flush=True)
print("[6] JWT_SECRET set:", "YES" if os.environ.get("JWT_SECRET") else "NO", flush=True)

# ── Step 2: Import the app ────────────────────────────────────
print("\n[7] Importing application...", flush=True)
try:
    from src.server import socket_app
    print("    ✅ src.server imported OK", flush=True)
except Exception as e:
    import traceback
    print(f"\n❌ IMPORT FAILED: {e}", flush=True)
    print("\nFull traceback:", flush=True)
    traceback.print_exc()
    sys.exit(1)

# ── Step 3: Start uvicorn ─────────────────────────────────────
print("\n[8] Starting uvicorn...", flush=True)
import uvicorn

port = int(os.environ.get("PORT", "8000"))
print(f"    Listening on 0.0.0.0:{port}", flush=True)

uvicorn.run(
    socket_app,
    host="0.0.0.0",
    port=port,
    log_level="info",
)
