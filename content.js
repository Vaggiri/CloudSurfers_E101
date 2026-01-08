// Content script to inject chat interface and handle interactions

console.log("AI Universal Web Agent Content Script Loaded");

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
        <span>AI Web Agent</span>
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
        <div class="message bot">Hello! I'm your universal web agent. I can answer questions, search, or perform actions on this page.</div>
      </div>
      <div class="ai-nav-input-area">
        <input type="text" id="ai-nav-input" placeholder="Ask me anything...">
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

    // Make draggable
    makeDraggable(rootEl, toggleEl, toggleChat);
    makeDraggable(rootEl, headerEl);

    document.getElementById('ai-nav-close').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChat();
    });
    document.getElementById('ai-nav-send').addEventListener('click', handleUserMessage);
    document.getElementById('ai-nav-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserMessage();
    });

    // Setup Voice Input
    setupVoiceInput();

    // Global Shortcut: Shift + F
    document.addEventListener('keydown', (e) => {
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
        if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
            if (!isInput) {
                e.preventDefault();
                toggleChat();
            }
        }
        if (e.key === 'Escape') {
            const windowEl = document.getElementById('ai-nav-window');
            if (windowEl && !windowEl.classList.contains('hidden')) {
                toggleChat();
            }
        }
    });
}

function toggleChat() {
    const root = document.getElementById('ai-nav-assistant-root');
    const windowEl = document.getElementById('ai-nav-window');
    const toggle = document.getElementById('ai-nav-toggle');
    const isOpening = windowEl.classList.contains('hidden');

    windowEl.classList.toggle('hidden');
    toggle.classList.toggle('hidden');

    if (isOpening) {
        const rect = root.getBoundingClientRect();
        if (root.style.top) {
            const viewportW = window.innerWidth;
            const viewportH = window.innerHeight;
            const margin = 20;
            let newLeft = rect.left;
            let newTop = rect.top;
            let needsUpdate = false;

            if (rect.right > viewportW - margin) { newLeft = viewportW - rect.width - margin; needsUpdate = true; }
            if (rect.bottom > viewportH - margin) { newTop = viewportH - rect.height - margin; needsUpdate = true; }
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

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        micBtn.style.display = 'none';
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    let isListening = false;
    micBtn.addEventListener('click', () => {
        if (isListening) recognition.stop();
        else recognition.start();
    });
    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        input.placeholder = "Listening...";
    };
    recognition.onend = () => {
        isListening = false;
        micBtn.classList.remove('listening');
        input.placeholder = "Ask me anything...";
    };
    recognition.onresult = (event) => {
        input.value = event.results[0][0].transcript;
    };
    recognition.onerror = (ev) => {
        isListening = false;
        micBtn.classList.remove('listening');
        input.placeholder = "Error. Try again.";
    };
}

function updateModeLabel(mode) {
    const label = document.getElementById('ai-nav-mode-text');
    label.textContent = (mode === 'cloud') ? 'Mode: Cloud ☁️' : 'Mode: Local 🏠';
}

function handleUserMessage() {
    const input = document.getElementById('ai-nav-input');
    const messageText = input.value.trim();
    if (!messageText) return;

    if (messageText.toLowerCase() === 'bot exit') {
        toggleChat();
        input.value = '';
        return;
    }

    addMessage(messageText, 'user');
    input.value = '';

    const isCloud = document.getElementById('ai-nav-mode-checkbox').checked;
    const mode = isCloud ? 'cloud' : 'local';

    addMessage(`Thinking (${mode} mode)...`, 'bot');

    // EXCTRACT CONTEXT
    const pageContent = extractPageContent();

    chrome.runtime.sendMessage({
        action: "analyze_page",
        query: messageText,
        pageTitle: document.title,
        pageContent: pageContent, // Sending full updated context
        mode: mode
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("Runtime error:", chrome.runtime.lastError);
            fallbackToLocalLogic(messageText, pageContent.links);
            return;
        }

        if (response.error) {
            if (response.status === 'missing_key') {
                addMessage("Please set your Gemini API Key.", 'bot');
            } else if (response.error.includes("Quota") || response.error.includes("429")) {
                addMessage("⚠️ Quota Exceeded. Switching to Local...", 'bot');
                const checkbox = document.getElementById('ai-nav-mode-checkbox');
                if (checkbox) checkbox.checked = false;
                updateModeLabel('local');
                chrome.storage.local.set({ ai_mode: 'local' });
                fallbackToLocalLogic(messageText, pageContent.links);
            } else {
                addMessage("Error: " + response.error, 'bot');
                fallbackToLocalLogic(messageText, pageContent.links);
            }
        } else if (response.result) {
            const res = response.result;

            // 1. Answer / Explanation
            if (res.answer) addMessage(res.answer, 'bot');
            else if (res.explanation) addMessage(res.explanation, 'bot');

            // 2. Action Handling
            if (res.action === 'search' || res.search_query) {
                const q = res.search_query || messageText;
                addMessage(`Searching for: "${q}"...`, 'bot');
                performSearch(q);
            } else if (res.action === 'navigate' || res.relevant_link_text) {
                const linkText = res.relevant_link_text;
                let target = pageContent.links.find(l => l.text === linkText);
                if (!target) target = pageContent.links.find(l => l.text.includes(linkText));

                if (target) {
                    addMessage(`Navigating to: "${target.text}"...`, 'bot');
                    highlightElement(target.element);
                    setTimeout(() => target.element.click(), 1500);
                } else if (res.external_link) {
                    addMessage(`Redirecting to: ${res.external_link}`, 'bot');
                    setTimeout(() => window.location.href = res.external_link, 1500);
                }
            } else if (res.action === 'click_element' && res.selector) {
                // Try to find element to click
                let target = null;
                try {
                    target = document.querySelector(res.selector);
                } catch (e) { }

                // Fallback: match by text in generic inputs/buttons if selector failed
                if (!target) {
                    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]'));
                    target = candidates.find(el => el.innerText.toLowerCase().includes(res.selector.toLowerCase()) || el.value.toLowerCase().includes(res.selector.toLowerCase()));
                }

                if (target) {
                    addMessage(`Clicking "${res.selector}"...`, 'bot');
                    highlightElement(target);
                    setTimeout(() => target.click(), 1000);
                } else {
                    addMessage(`Couldn't find element "${res.selector}" to click.`, 'bot');
                }
            }
        }
    });
}

function extractPageContent() {
    // 1. Metadata
    const title = document.title;
    const description = document.querySelector('meta[name="description"]')?.content || "";

    // 2. Headings & Main Text
    // Get H1-H3
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.innerText.replace(/\s+/g, ' ').trim())
        .filter(t => t.length > 0)
        .slice(0, 15);

    // Get significant paragraphs
    const paragraphs = Array.from(document.querySelectorAll('p'))
        .map(p => p.innerText.replace(/\s+/g, ' ').trim())
        .filter(t => t.length > 60) // Only meaningful text
        .slice(0, 8); // Limit context size

    // 3. Forms
    const forms = Array.from(document.querySelectorAll('form')).map((f, idx) => {
        const inputs = Array.from(f.querySelectorAll('input:not([type="hidden"]), select, textarea, button')).map(el => {
            let label = "";
            if (el.labels && el.labels[0]) label = el.labels[0].innerText;
            else if (el.placeholder) label = el.placeholder;
            else if (el.name) label = el.name;
            else if (el.innerText) label = el.innerText;

            return `${el.tagName}:${el.type || ''}(${label})`;
        });
        return `Form ${idx}: [${inputs.join(', ')}]`;
    });

    // 4. Links (Keep logic but attach elements for later use)
    const links = Array.from(document.querySelectorAll('a, button, [role="button"]')).map(el => ({
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        href: el.href || null,
        element: el
    })).filter(l => l.text.length > 2).slice(0, 200);

    return {
        title,
        description,
        headings,
        mainText: paragraphs,
        forms: forms.slice(0, 3), // Only first 3 forms
        links: links
    };
}

function performSearch(query) {
    // Robust Search Logic from previous fix
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input[name="q"], input[name="k"], input[name="keyword"]'));
    let bestInput = null, maxScore = -1;

    inputs.forEach(input => {
        let score = 0;
        const placeholder = (input.placeholder || "").toLowerCase();
        const name = (input.name || "").toLowerCase();
        const ariaLabel = (input.getAttribute('aria-label') || "").toLowerCase();
        if (input.type === 'search') score += 10;
        if (name.includes('search') || name === 'q') score += 5;
        if (ariaLabel.includes('search') || placeholder.includes('search')) score += 5;
        if (input.offsetParent === null) score = -100;
        if (score > maxScore) { maxScore = score; bestInput = input; }
    });

    if (bestInput) {
        highlightElement(bestInput);
        bestInput.focus();
        bestInput.value = query;
        ['input', 'change', 'keydown', 'keypress', 'keyup'].forEach(ev => bestInput.dispatchEvent(new Event(ev, { bubbles: true })));

        // React Hack
        try {
            const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
            desc.set.call(bestInput, query);
            bestInput.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) { }

        setTimeout(() => {
            // Trigger Enter
            const kEvent = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, view: window };
            bestInput.dispatchEvent(new KeyboardEvent('keydown', kEvent));
            bestInput.dispatchEvent(new KeyboardEvent('keypress', kEvent));
            bestInput.dispatchEvent(new KeyboardEvent('keyup', kEvent));

            // Find Button
            let parent = bestInput.parentElement;
            let searchBtn = null;

            // Sibling Check
            const siblings = Array.from(bestInput.parentNode.children);
            const siblingBtn = siblings.find(el => el !== bestInput && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.querySelector('svg') || (typeof el.className === 'string' && el.className.includes('search'))));
            if (siblingBtn) searchBtn = siblingBtn;

            let checks = 0;
            while (!searchBtn && parent && checks < 3) {
                const btn = parent.querySelector('button, [type="submit"], svg, [role="button"], [aria-label*="search"]');
                if (btn && btn !== bestInput && !bestInput.contains(btn)) {
                    const aria = (btn.getAttribute('aria-label') || "").toLowerCase();
                    if (!aria.includes('close') && !aria.includes('clear')) {
                        searchBtn = btn;
                        break;
                    }
                }
                parent = parent.parentElement; checks++;
            }

            if (searchBtn) searchBtn.click();
            else if (bestInput.form) bestInput.form.requestSubmit ? bestInput.form.requestSubmit() : bestInput.form.submit();
        }, 800);
    } else {
        addMessage("No search bar found.", 'bot');
    }
}

function fallbackToLocalLogic(messageText, links) {
    console.log("Local fallback...");
    setTimeout(() => {
        const lowerQ = messageText.toLowerCase();
        const found = links.find(l => l.text.toLowerCase().includes(lowerQ));
        if (found) {
            addMessage(`(Offline) Found: "${found.text}"`, 'bot');
            highlightElement(found.element);
        } else {
            addMessage("(Offline) No direct match.", 'bot');
        }
    }, 500);
}

function highlightElement(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const originalBorder = element.style.border;
    const originalShadow = element.style.boxShadow;
    element.style.border = '2px solid #ff0055';
    element.style.boxShadow = '0 0 10px #ff0055';
    setTimeout(() => { element.style.border = originalBorder; element.style.boxShadow = originalShadow; }, 3000);
}

function makeDraggable(element, handle, clickCallback) {
    let isDragging = false, startX, startY, initialLeft, initialTop, hasMoved = false;
    if (!handle) return;
    handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.tagName === 'BUTTON') return;
        isDragging = true; hasMoved = false;
        startX = e.clientX; startY = e.clientY;
        const rect = element.getBoundingClientRect();
        element.style.left = rect.left + 'px'; element.style.top = rect.top + 'px';
        element.style.bottom = 'auto'; element.style.right = 'auto';
        initialLeft = rect.left; initialTop = rect.top;
        e.preventDefault();
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
    function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX; const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        element.style.left = `${initialLeft + dx}px`; element.style.top = `${initialTop + dy}px`;
    }
    function onMouseUp(e) {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (!hasMoved && clickCallback) clickCallback();
    }
}

function addMessage(text, sender) {
    const messagesDiv = document.getElementById('ai-nav-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

createChatInterface();
