const https = require('https');

const API_KEY = "AIzaSyB5MdbGmZpc7dx4d_eZynP0PeZGHx6zv4o"; // User provided key
const MODEL = "gemini-flash-latest";

const data = JSON.stringify({
    contents: [{
        parts: [{ text: "Hello, are you working?" }]
    }]
});

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log(`Testing API Key with model: ${MODEL}...`);

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        try {
            const response = JSON.parse(body);
            if (response.error) {
                console.error("❌ API Error:", JSON.stringify(response.error, null, 2));
            } else {
                console.log("✅ Success! Response:", response.candidates[0].content.parts[0].text);
            }
        } catch (e) {
            console.error("❌ Failed to parse response:", body);
        }
    });
});

req.on('error', (e) => {
    console.error("❌ Request Error:", e);
});

req.write(data);
req.end();
