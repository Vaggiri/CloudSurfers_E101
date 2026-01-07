// Content script to inject chat interface and handle interactions

console.log("AI Navigation Assistant Content Script Loaded");

// Create Chat Interface
function createChatInterface() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'ai-nav-assistant-root';
    chatContainer.innerHTML = `
    <div class="ai-nav-chat-icon" id="ai-nav-toggle">
      🤖
    </div>
    <div class="ai-nav-chat-window hidden" id="ai-nav-window">
      <div class="ai-nav-header">
        <span>AI Nav Assistant</span>
        <button id="ai-nav-close">×</button>
      </div>
      <div class="ai-nav-mode-toggle">
         <span class="ai-nav-mode-label" id="ai-nav-mode-text">Mode: Cloud ☁️</span>
         <label class="toggle-switch">
           <input type="checkbox" id="ai-nav-mode-checkbox" checked>
           <span class="slider"></span>
         </label>
      </div>
      <div class="ai-nav-messages" id="ai-nav-messages">
        <div class="message bot">Hello! I'm your navigation assistant. Ask me anything about this page.</div>
      </div>
      <div class="ai-nav-input-area">
        <input type="text" id="ai-nav-input" placeholder="Where do you want to go?">
        <button id="ai-nav-mic" title="Voice Command">🎤</button>
        <button id="ai-nav-send">➤</button>
      </div>
    </div>
  `;
    document.body.appendChild(chatContainer);

    // Load initial state
    chrome.storage.local.get(['ai_mode'], (result) => {
        const mode = result.ai_mode || 'cloud';
        const checkbox = document.getElementById('ai-nav-mode-checkbox');

        if (checkbox) checkbox.checked = (mode === 'cloud');
        updateModeLabel(mode);
    });

    // Event Listeners
    const rootEl = document.getElementById('ai-nav-assistant-root');
    const toggleEl = document.getElementById('ai-nav-toggle');
    const headerEl = rootEl.querySelector('.ai-nav-header');

    // Toggle Switch Listener
    document.getElementById('ai-nav-mode-checkbox').addEventListener('change', (e) => {
        const isCloud = e.target.checked;
        const mode = isCloud ? 'cloud' : 'local';
        chrome.storage.local.set({ ai_mode: mode });
        updateModeLabel(mode);
    });

    // Make draggable with click handling for toggle
    makeDraggable(rootEl, toggleEl, toggleChat);
    makeDraggable(rootEl, headerEl);

    document.getElementById('ai-nav-close').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag start on close button
        toggleChat();
    });
    document.getElementById('ai-nav-send').addEventListener('click', handleUserMessage);
    document.getElementById('ai-nav-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserMessage();
    });

    // Setup Voice Input
    setupVoiceInput();
}

function toggleChat() {
    const root = document.getElementById('ai-nav-assistant-root');
    const windowEl = document.getElementById('ai-nav-window');
    const toggle = document.getElementById('ai-nav-toggle');
    const isOpening = windowEl.classList.contains('hidden');

    windowEl.classList.toggle('hidden');
    toggle.classList.toggle('hidden');

    if (isOpening) {
        // Force layout update to check new dimensions
        const rect = root.getBoundingClientRect();

        // Only adjust if we are in "manual positioning" mode (style.top is set via drag)
        if (root.style.top) {
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;
            const margin = 20;

            let newLeft = rect.left;
            let newTop = rect.top;
            let needsUpdate = false;

            // Check Right Edge
            if (rect.right > viewportW - margin) {
                newLeft = viewportW - rect.width - margin;
                needsUpdate = true;
            }

            // Check Bottom Edge
            if (rect.bottom > viewportH - margin) {
                newTop = viewportH - rect.height - margin;
                needsUpdate = true;
            }

            // Check Left/Top Edges
            if (newLeft < margin) { newLeft = margin; needsUpdate = true; }
            if (newTop < margin) { newTop = margin; needsUpdate = true; }

            if (needsUpdate) {
                root.style.left = newLeft + 'px';
                root.style.top = newTop + 'px';
            }
        }
    }
}

function setupVoiceInput() {
    const micBtn = document.getElementById('ai-nav-mic');
    const input = document.getElementById('ai-nav-input');

    // Check support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        micBtn.style.display = 'none'; // Hide if not supported
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US'; // Default to English

    let isListening = false;

    micBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        input.placeholder = "Listening...";
    };

    recognition.onend = () => {
        isListening = false;
        micBtn.classList.remove('listening');
        input.placeholder = "Where do you want to go?";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        isListening = false;
        micBtn.classList.remove('listening');
        input.placeholder = "Error. Try again.";
    };
}

// Helper to update visual label
function updateModeLabel(mode) {
    const label = document.getElementById('ai-nav-mode-text');
    if (mode === 'cloud') {
        label.textContent = 'Mode: Cloud ☁️';
    } else {
        label.textContent = 'Mode: Local 🏠';
    }
}

function handleUserMessage() {
    const input = document.getElementById('ai-nav-input');
    const messageText = input.value.trim();
    if (!messageText) return;

    addMessage(messageText, 'user');
    input.value = '';

    // Get current mode
    const isCloud = document.getElementById('ai-nav-mode-checkbox').checked;
    const mode = isCloud ? 'cloud' : 'local';

    // Simulate AI processing
    addMessage(`Analyzing page structure(${mode} mode)...`, 'bot');

    // Extract page links
    const links = extractPageLinks();

    // Send data to background for AI processing
    // Limit the amount of data sent to avoid message size limits
    const simplifiedLinks = links.map(l => ({ text: l.text, href: l.href })).slice(0, 200);

    chrome.runtime.sendMessage({
        action: "analyze_page",
        query: messageText,
        pageTitle: document.title,
        links: simplifiedLinks,
        mode: mode // Send mode to background
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("Runtime error:", chrome.runtime.lastError);
            // Fallback to local if background is not ready or accessible
            fallbackToLocalLogic(messageText, links);
            return;
        }

        if (response.error) {
            if (response.status === 'missing_key') {
                addMessage("Please set your Gemini API Key in the extension settings.", 'bot');
            } else {
                addMessage("Error: " + response.error, 'bot');
            }
            fallbackToLocalLogic(messageText, links);
        } else if (response.result) {
            const aiRes = response.result;
            addMessage(aiRes.explanation, 'bot');

            if (aiRes.relevant_link_text) {
                // Search for exact match first, then fuzzy/includes
                let target = links.find(l => l.text === aiRes.relevant_link_text);
                if (!target) {
                    target = links.find(l => l.text.includes(aiRes.relevant_link_text));
                }

                if (target) {
                    addMessage(`Navigating to: "${target.text}" in 2 seconds...`, 'bot');
                    highlightElement(target.element);
                    setTimeout(() => {
                        target.element.click();
                    }, 2000);
                }
            }
        }
    });
}

function fallbackToLocalLogic(messageText, links) {
    console.log("Using local fallback logic");
    setTimeout(() => {
        const relevantLink = findRelevantLink(messageText, links);
        if (relevantLink) {
            addMessage(`(Offline Mode) I found a link: "${relevantLink.text}".`, 'bot');
            highlightElement(relevantLink.element);
        } else {
            addMessage("(Offline Mode) I couldn't find a direct link matches your query.", 'bot');
        }
    }, 500);
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('ai-nav-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender} `;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function extractPageLinks() {
    const links = Array.from(document.querySelectorAll('a, button, [role="button"]'));
    return links.map(el => ({
        text: el.innerText.trim(),
        href: el.href || null,
        category: getLinkContext(el),
        element: el
    })).filter(l => l.text.length > 0);
}

function getLinkContext(element) {
    // Look up for closest parent section/menu item and get its title
    let parent = element.parentElement;
    let steps = 0;
    while (parent && steps < 5) {
        // Check for common container classes or tags
        if (parent.classList.contains('menu-item') || parent.classList.contains('card') || parent.tagName === 'SECTION') {
            // Find a header within this parent, but before the current element if possible
            const header = parent.querySelector('span, h2, h3, h4, strong');
            if (header && header.innerText) {
                return header.innerText.trim();
            }
        }
        parent = parent.parentElement;
        steps++;
    }
    return null;
}

function findRelevantLink(query, links) {
    const lowerQuery = query.toLowerCase();
    return links.find(l => l.text.toLowerCase().includes(lowerQuery));
}

function highlightElement(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const originalBorder = element.style.border;
    const originalBoxShadow = element.style.boxShadow;

    element.style.border = '2px solid #ff0055';
    element.style.boxShadow = '0 0 10px #ff0055';

    setTimeout(() => {
        element.style.border = originalBorder;
        element.style.boxShadow = originalBoxShadow;
    }, 3000);
}

// Draggable Logic
function makeDraggable(element, handle, clickCallback) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;
    let hasMoved = false;

    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
        // Only left click
        if (e.button !== 0) return;

        // Don't start drag if clicking on a button inside the handle (like close button)
        if (e.target.tagName === 'BUTTON') return;

        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;

        // Get current position
        const rect = element.getBoundingClientRect();

        // If the element was positioned with bottom/right, we need to convert to top/left for movement
        // We set top/left explicitly and clear bottom/right to switch positioning mode
        element.style.left = rect.left + 'px';
        element.style.top = rect.top + 'px';
        element.style.bottom = 'auto';
        element.style.right = 'auto';

        initialLeft = rect.left;
        initialTop = rect.top;

        // Prevent default behavior (text selection etc)
        e.preventDefault();

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Threshold for "drag" vs "click"
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
        }

        element.style.left = `${initialLeft + dx}px`;
        element.style.top = `${initialTop + dy}px`;
    }

    function onMouseUp(e) {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (!hasMoved && clickCallback) {
            clickCallback();
        }
    }
}

// Initialize
createChatInterface();
