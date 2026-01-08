require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Initialize Gemini
// We allow passing key in header for now to support the extension's existing flow
// Or we can use a hardcoded .env key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

app.post('/analyze', async (req, res) => {
    try {
        const { query, pageTitle, links, apiKey } = req.body;

        // Use key from request if provided, else from env
        const keyToUse = apiKey || process.env.GEMINI_API_KEY;

        if (!keyToUse) {
            return res.status(400).json({ error: "No API Key provided." });
        }

        const genAIInstance = new GoogleGenerativeAI(keyToUse);
        // Using the standard model name that works with the SDK
        const model = genAIInstance.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        You are a specific website navigation assistant.
        
        User Query: "${query}"
        Page Title: "${pageTitle}"
        Available Links: ${JSON.stringify(links.map(l => ({ text: l.text, category: l.category || "General" })).slice(0, 100))}
  
        Goal: Identify the most relevant link for the user's query OR determine if the user wants to perform a search.
        
        IMPORTANT: 
        1. You MUST return the EXACT text of the link from the 'Available Links' list. Do NOT paraphrase or invent link names.
        2. CROSS-LANGUAGE MATCHING: The user query might be in a different language matches link.
        3. SEARCH INTENT: If the user wants to "buy", "search for", "find" a product (e.g., "buy toy car", "search for iphone"), and there is no direct link to that specific product category, you should return a "search_query".
        4. If a search query is generated, "relevant_link_text" should be null unless there is a very specific category link that is better.
        5. If multiple links seem relevant, choose the most specific one.
        
        Output JSON ONLY:
        {
          "relevant_link_text": "Exact text of the link (or null)",
          "search_query": "The product or term to search for (or null)",
          "explanation": "Brief explanation",
          "direct_match": true/false
        }
      
      `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("Gemini Response:", text);

        try {
            // Clean up code blocks if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const json = JSON.parse(jsonStr);
            res.json({ result: json });
        } catch (e) {
            // Fallback
            res.json({ result: { explanation: text, relevant_link_text: null } });
        }

    } catch (error) {
        console.error("Server Error:", error);

        let status = 500;
        let errorMessage = error.message || "Internal Server Error";

        if (errorMessage.includes("429") || errorMessage.includes("Quota")) {
            status = 429;
            errorMessage = "Gemini API Quota Exceeded";
        }

        res.status(status).json({
            error: errorMessage,
            details: error.toString()
        });
    }
});

app.listen(PORT, () => {
    console.log(`AI Navigation Server running on http://localhost:${PORT}`);
});
