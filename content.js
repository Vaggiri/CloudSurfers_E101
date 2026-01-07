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
      <div class="ai-nav-messages" id="ai-nav-messages">
        <div class="message bot">Hello! I'm your navigation assistant. Ask me anything about this page.</div>
      </div>
      <div class="ai-nav-input-area">
        <input type="text" id="ai-nav-input" placeholder="Where do you want to go?">
        <button id="ai-nav-send">➤</button>
      </div>
    </div>
  `;
    document.body.appendChild(chatContainer);

    // Event Listeners
    document.getElementById('ai-nav-toggle').addEventListener('click', toggleChat);
    document.getElementById('ai-nav-close').addEventListener('click', toggleChat);
    document.getElementById('ai-nav-send').addEventListener('click', handleUserMessage);
    document.getElementById('ai-nav-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserMessage();
    });
}

function toggleChat() {
    const window = document.getElementById('ai-nav-window');
    const toggle = document.getElementById('ai-nav-toggle');
    window.classList.toggle('hidden');
    toggle.classList.toggle('hidden');
}

function handleUserMessage() {
    const input = document.getElementById('ai-nav-input');
    const messageText = input.value.trim();
    if (!messageText) return;

    addMessage(messageText, 'user');
    input.value = '';

    // Simulate AI processing
    addMessage("Analyzing page structure...", 'bot');

    // Extract page links
    const links = extractPageLinks();

    // Send data to background for AI processing
    // Limit the amount of data sent to avoid message size limits
    const simplifiedLinks = links.map(l => ({ text: l.text, href: l.href })).slice(0, 200);

    chrome.runtime.sendMessage({
        action: "analyze_page",
        query: messageText,
        pageTitle: document.title,
        links: simplifiedLinks
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
    messageDiv.className = `message ${sender}`;
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

// Initialize
createChatInterface();
