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
    const { query, links, pageTitle, mode } = request;

    // Get API Key
    const data = await chrome.storage.local.get(['gemini_api_key']);
    const apiKey = data.gemini_api_key;

    let targetUrl = "";
    let useApiKey = null;
    let serverName = "Server";

    if (mode === 'cloud') {
        if (!apiKey) {
            sendResponse({
                error: "No Gemini API Key found. To use Cloud Mode, please set an API Key in extension settings.",
                status: "missing_key"
            });
            return;
        }
        targetUrl = "http://localhost:3000/analyze";
        useApiKey = apiKey;
        serverName = "Cloud Node.js Server";
    } else {
        // Local Mode
        targetUrl = "http://localhost:5000/analyze";
        useApiKey = "local-mode";
        serverName = "Local Python Server";
    }

    try {
        console.log(`Sending request to ${mode} mode: ${targetUrl}`);
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query,
                pageTitle,
                links,
                apiKey: useApiKey
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
