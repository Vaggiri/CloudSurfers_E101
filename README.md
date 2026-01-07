# AI Navigation Assistant 🤖

A powerful Chrome Extension that helps users navigate complex websites using AI. It features a "Dual Mode" system, allowing users to switch between a cloud-based Gemini model and a local, privacy-focused Python model.

## ✨ Features

*   **Dual Mode AI**:
    *   **Cloud Mode (☁️)**: Uses Google Gemini API for high-reasoning tasks.
    *   **Local Mode (🏠)**: Uses a local Python server with `SentenceTransformers` for privacy and offline capability.
*   **Multilingual Support**: Understands navigation queries in English even on non-English (Hindi, Tamil, etc.) websites.
*   **Voice Input**: Speak your commands using the built-in microphone 🎤.
*   **Draggable UI**: A glassmorphism-styled chat window that floats on top of any webpage.
*   **Smart Highlighting**: Visually highlights the target element before clicking.

## 🛠️ Installation

### 1. Clone/Download
Clone this repository to your local machine.

### 2. Backend Setup
The extension relies on two servers. Run the one corresponding to your desired mode (or both).

#### Option A: Cloud Server (Node.js)
Required for Cloud Mode.
1.  Navigate to `server/`.
2.  Install dependencies:
    ```bash
    npm install express cors body-parser dotenv @google/generative-ai
    ```
3.  Run the server:
    ```bash
    node server.js
    ```
    *Runs on Port 3000.*

#### Option B: Local Server (Python)
Required for Local Mode.
1.  Navigate to `server/`.
2.  Install dependencies:
    ```bash
    pip install flask flask-cors sentence-transformers
    ```
3.  Run the server:
    ```bash
    python ai_server.py
    ```
    *Runs on Port 5000. Note: First run will download the AI model (~400MB).*

### 3. Load Chrome Extension
1.  Open Chrome and go to `chrome://extensions`.
2.  Enable **Developer mode** (top right).
3.  Click **Load unpacked**.
4.  Select the root folder of this project (`Hackathon-Hacktide`).

## 📖 Usage

1.  **Open the Assistant**: Click the floating 🤖 icon on any webpage.
2.  **Select Mode**: Use the toggle switch at the top to choose **Cloud** or **Local**.
3.  **Ask**: Type "Where can I login?" or click the Microphone 🎤 and say it.
4.  **Navigate**: The assistant will analyze the page, find the relevant link, highlight it, and click it for you.

## 🏗️ Architecture

*   **Frontend**: Plain HTML/CSS/JS (Content Script) injected into pages. Uses `chrome.runtime` for communication.
*   **Backend (Cloud)**: Node.js + Express. Proxies requests to Google Gemini.
*   **Backend (Local)**: Python + Flask. Uses `paraphrase-multilingual-MiniLM-L12-v2` for semantic similarity matching.
