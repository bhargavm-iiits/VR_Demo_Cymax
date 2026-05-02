"""
Firebase Service for handling storage and metadata.
Requires FIREBASE_CREDENTIALS path and FIREBASE_STORAGE_BUCKET in .env
"""

import os
import json
import logging
import firebase_admin
from firebase_admin import credentials, firestore, storage
from fastapi import UploadFile
from src.config.environment import env
import uuid

logger = logging.getLogger(__name__)

# Initialize Firebase App
_firebase_initialized = False

def init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return
        
    try:
        # Load from .env or default to local file
        cred_path = os.environ.get("FIREBASE_CREDENTIALS", "firebase-credentials.json")
        bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET")
        
        if not os.path.exists(cred_path):
            logger.warning(f"Firebase credentials not found at {cred_path}. Storage features will be disabled.")
            return
            
        if not bucket_name:
            logger.warning("FIREBASE_STORAGE_BUCKET not set. Storage features will be disabled.")
            return

        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {
            'storageBucket': bucket_name
        })
        _firebase_initialized = True
        logger.info("✅ Firebase initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Firebase: {e}")


class FirebaseService:
    def __init__(self):
        # We try to initialize if it hasn't been yet, but don't fail if creds are missing (for dev)
        init_firebase()

    @property
    def db(self):
        if not _firebase_initialized:
            return None
        return firestore.client()

    @property
    def bucket(self):
        if not _firebase_initialized:
            return None
        return storage.bucket()

    async def upload_video(self, file: UploadFile, user_id: int) -> str:
        """Uploads a video to Firebase Storage and returns the public URL"""
        if not self.bucket:
            raise ValueError("Firebase is not initialized. Please provide credentials.")
            
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'mp4'
        blob_path = f"videos/{user_id}/{uuid.uuid4()}.{file_extension}"
        blob = self.bucket.blob(blob_path)
        
        # Upload from file-like object
        contents = await file.read()
        blob.upload_from_string(contents, content_type=file.content_type)
        
        # Make the file publicly accessible or return a signed URL. 
        # For simplicity, we make it public and secure it at the app level, 
        # or we generate a signed URL that expires.
        # Generating a signed URL:
        import datetime
        url = blob.generate_signed_url(version="v4", expiration=datetime.timedelta(days=7), method="GET")
        return url

    def save_movie_metadata(self, metadata: dict) -> str:
        """Saves metadata to Firestore and returns the document ID"""
        if not self.db:
            logger.warning("Firebase not initialized. Storing metadata in memory mock.")
            return f"mock_{uuid.uuid4()}"
            
        doc_ref = self.db.collection('movies').document()
        doc_ref.set(metadata)
        return doc_ref.id

    def get_all_movies(self) -> list:
        """Fetch all movies from Firestore"""
        if not self.db:
            return []
            
        docs = self.db.collection('movies').stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
        
    def get_movie(self, movie_id: str) -> dict:
        if not self.db:
            return None
        doc = self.db.collection('movies').document(movie_id).get()
        if doc.exists:
            return {"id": doc.id, **doc.to_dict()}
        return None

firebase_service = FirebaseService()
