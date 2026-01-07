// Background service worker
console.log("AI Navigation Assistant Background Service Started");

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze_page") {
        handlePageAnalysis(request, sendResponse);
        return true; // Will respond asynchronously
    }
});

async function handlePageAnalysis(request, sendResponse) {
    const { query, links, pageTitle } = request;

    // Get API Key
    const data = await chrome.storage.local.get(['gemini_api_key']);
    const apiKey = data.gemini_api_key;

    if (!apiKey) {
        sendResponse({
            error: "No Gemini API Key found. Please set it in the extension popup.",
            status: "missing_key"
        });
        return;
    }

    try {
        // Call Local Node.js Server
        const response = await fetch("http://localhost:3000/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query,
                pageTitle,
                links,
                apiKey // Pass the key to the server
            })
        });

        const result = await response.json();

        if (result.error) {
            console.error("Server API Error:", result.error);
            sendResponse({ error: result.error });
            return;
        }

        sendResponse({ result: result.result });

    } catch (error) {
        console.error("Fetch Error:", error);
        sendResponse({ error: "Failed to connect to Local AI Server. Is 'node server.js' running?" });
    }
}
