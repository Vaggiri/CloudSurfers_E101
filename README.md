# AI Website Navigation Assistant

This is an AI-powered Chrome Extension that helps users navigate complex websites. It acts as a smart sidecar, allowing users to ask "Where is X?" or "How do I do Y?" and getting direct navigation assistance.

It features a dual-mode AI backend:
1.  **Cloud Mode**: Uses Google Gemini (via Node.js) for high-intelligence reasoning and general queries.
2.  **Local Mode**: Uses a locally hosted `SentenceTransformer` model (via Python) for offline, privacy-focused, and fast semantic link matching.

## ✨ Key Features

-   **Dual AI Modes**: Toggle between Cloud (Gemini) and Local (Python) AI.
-   **Voice Commands**: Click the microphone to speak your query.
-   **Smart Shortcuts**:
    -   `Shift + F`: Toggle the chat window (won't trigger while typing).
    -   `Escape`: Close/Hide the chat window.
    -   `bot exit`: Type this command to close the chat.
-   **Link Highlighting**: The assistant highlights the relevant link on the page before clicking it.
-   **Local Model Fine-Tuning**: Train the local AI on your own custom data for better accuracy on specific sites.
-   **Firewall (Privacy Shield)**: Automatically blocks third-party trackers (ads, analytics) like `doubleclick` and `google-analytics` while keeping banking/login sites safe.
-   **Optimized Local Navigation**: Intelligent heuristics to instantly understand commands like "change password" or "edit settings" without wait times.

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Hackathon-Hacktide
```

### 2. Chrome Extension
1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer Mode** (top right).
3.  Click **Load unpacked** and select the `Hackathon-Hacktide` folder.

### 3. Backend Servers
You need to run **both** servers for full functionality.

**Node.js Server (Cloud Mode)**
```bash
cd server
npm install
# Create a .env file with GEMINI_API_KEY=your_key
node server.js
```
*Runs on port 3000.*

**Python Server (Local Mode)**
```bash
cd server
pip install flask flask-cors sentence-transformers
python ai_server.py
```
*Runs on port 5000.*

## 🧠 Local Model Training

You can fine-tune the local AI model to understand specific jargon or website mappings.

1.  **Edit Data**: Open `server/training_data.json` and add your examples:
    ```json
    {
      "query": "Where can I see my grades?",
      "positive": "Academic Reports",
      "negative": "Hostel Fee"
    }
    ```
2.  **Train**: Run the training script.
    ```bash
    cd server
    python train.py
    ```
3.  **Restart**: Restart `ai_server.py` to load the new model.

## 📂 Project Structure

-   `manifest.json`: Chrome extension configuration.
-   `content.js`: Main logic injected into webpages (UI, event listeners).
-   `styles.css`: Styling for the chat interface.
-   `server/`: Backend code.
    -   `server.js`: Node.js server for Gemini API.
    -   `ai_server.py`: Python server for local embeddings.
    -   `train.py`: Script to fine-tune the local model.

## 🚀 Usage

1.  Open any webpage.
2.  Press `Shift + F` or click the 🤖 icon to open the assistant.
3.  Type your question (e.g., "Login page", "Contact support").
4.  The AI will find the best link, highlight it, and navigate for you.
