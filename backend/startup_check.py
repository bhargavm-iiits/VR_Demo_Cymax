"""
Startup diagnostic script — run this before uvicorn to catch import errors.
Render Start Command: python backend/startup_check.py && uvicorn src.server:socket_app --host 0.0.0.0 --port $PORT
"""
import sys
import traceback

print("=" * 60)
print("VR Cinema Backend — Startup Diagnostics")
print("=" * 60)

errors = []

# Check 1: Core dependencies
print("\n[1] Checking core imports...")
try:
    import fastapi
    import uvicorn
    import sqlalchemy
    print(f"  ✅ fastapi={fastapi.__version__}, sqlalchemy={sqlalchemy.__version__}")
except Exception as e:
    errors.append(f"Core import failed: {e}")
    print(f"  ❌ {e}")

# Check 2: Auth dependencies
print("\n[2] Checking auth dependencies...")
try:
    import argon2
    from jose import jwt
    print("  ✅ argon2-cffi, python-jose OK")
except Exception as e:
    errors.append(f"Auth dependency failed: {e}")
    print(f"  ❌ {e}")

# Check 3: Email validator
print("\n[3] Checking email-validator...")
try:
    import email_validator
    print("  ✅ email-validator OK")
except Exception as e:
    errors.append(f"email-validator failed: {e}")
    print(f"  ❌ {e}")

# Check 4: Crypto
print("\n[4] Checking pycryptodome...")
try:
    from Crypto.Cipher import AES
    print("  ✅ pycryptodome OK")
except Exception as e:
    errors.append(f"pycryptodome failed: {e}")
    print(f"  ❌ {e}")

# Check 5: Environment
print("\n[5] Checking environment config...")
try:
    from src.config.environment import env
    print(f"  ✅ Environment loaded")
    print(f"     DEBUG={env.DEBUG}")
    print(f"     DATABASE_URL={env.DATABASE_URL}")
    print(f"     AES_KEY={'SET (' + str(len(env.AES_KEY)) + ' chars)' if env.AES_KEY else 'NOT SET'}")
    print(f"     JWT_SECRET={'SET' if env.JWT_SECRET else 'NOT SET'}")
except Exception as e:
    errors.append(f"Environment config failed: {e}")
    print(f"  ❌ {e}")
    traceback.print_exc()

# Check 6: Full server import
print("\n[6] Checking full server import (critical)...")
try:
    import src.server
    print("  ✅ src.server imported successfully")
except Exception as e:
    errors.append(f"Server import failed: {e}")
    print(f"  ❌ CRITICAL: {e}")
    traceback.print_exc()

# Summary
print("\n" + "=" * 60)
if errors:
    print(f"❌ STARTUP FAILED — {len(errors)} error(s):")
    for err in errors:
        print(f"   • {err}")
    sys.exit(1)
else:
    print("✅ All checks passed — starting uvicorn...")
    print("=" * 60)
