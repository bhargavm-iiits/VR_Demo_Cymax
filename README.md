# VR Cinema Backend

A high-performance backend for a VR cinema platform, built with Python and Gradio. This service handles video streaming, user authentication, and secure content delivery.

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+ (for frontend)
- npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd VR_player
    ```

2.  **Backend Setup:**
    ```bash
    cd backend
    pip install -r requirements.txt
    ```

3.  **Frontend Setup:**
    ```bash
    cd ../frontend
    npm install
    ```

### Running the Application

Start the backend server:
```bash
cd backend
python app.py
```

The backend will be available at `http://localhost:7860`.

Start the frontend development server:
```bash
cd ../frontend
npm run dev
```

## 📂 Project Structure

```
VR_player/
├── backend/              # Python backend services
│   ├── app.py            # Main Gradio application
│   ├── auth.py           # Authentication logic
│   ├── video_stream.py   # Video streaming utilities
│   └── ...
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components (Home, VRPlayer, etc.)
│   │   ├── App.jsx       # Main application component
│   │   └── index.jsx     # Entry point
│   └── ...
└── README.md             # Project documentation
```

## 🛠️ Tech Stack

### Backend
- **Framework**: Gradio
- **Language**: Python 3.8+
- **Security**: Argon2 (password hashing), JWT (authentication)
- **Cryptography**: PyCryptodome (AES encryption)

### Frontend
- **Framework**: React
- **Language**: JavaScript (ES6+)
- **3D/VR**: Three.js, React Three Fiber
- **Styling**: CSS

## 🔐 Security Features

- **Password Hashing**: Argon2 (industry-standard, resistant to GPU cracking)
- **JWT Authentication**: Secure token-based authentication
- **AES Encryption**: End-to-end encryption for video metadata and streams
- **Rate Limiting**: Built-in protection against brute-force attacks

## 🎮 VR Player Features

- **360° Video Playback**: Immersive spherical video experience
- **Stereoscopic 3D**: Support for 3D SBS (Side-by-Side) content
- **Performance Optimized**: Efficient rendering with Three.js
- **Responsive UI**: Clean, modern interface with dark mode

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🚀 Deployment

### Production Build

**Backend:**
```bash
cd backend
python app.py --host [IP_ADDRESS] --port 7860
```

**Frontend:**
```bash
cd frontend
npm run build
```

### Docker Deployment

Build and run with Docker:
```bash
docker-compose up --build
```

## 📝 License

[MIT License](LICENSE)

## 🤝 Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.

## 📞 Support

For issues or questions, please open an issue on the GitHub repository.

## 👥 Team

- [Your Name]
- [Team Member 2]
- [Team Member 3]

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
    