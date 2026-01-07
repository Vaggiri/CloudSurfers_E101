from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer, util
import sys

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

print("Loading AI Model... please wait.")
try:
    # Load a multilingual model to handle cross-language navigation
    # e.g. English query -> Hindi link matching
    print("Loading Multilingual AI Model... (First run may take time to download)")
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)

@app.route('/analyze', methods=['POST'])  # Keep the same endpoint name for simplicity
def analyze():
    try:
        data = request.json
        query = data.get('query', '')
        links = data.get('links', [])
        page_title = data.get('pageTitle', '')

        if not query or not links:
            return jsonify({'error': 'Missing query or links'}), 400

        print(f"Analyzing query: '{query}' for page: '{page_title}' with {len(links)} links")

        # Prepare texts
        query_embedding = model.encode(query, convert_to_tensor=True)
        
        # We handle a maximum of 200 links to keep it fast
        link_texts = [link.get('text', '') for link in links]
        link_hrefs = [link.get('href', '') for link in links]
        
        # Check against links
        if not link_texts:
             return jsonify({
                'result': {
                    'explanation': "I couldn't find any actionable links on this page.",
                    'relevant_link_text': None
                }
            })

        link_embeddings = model.encode(link_texts, convert_to_tensor=True)

        # Compute cosine similarities
        cosine_scores = util.cos_sim(query_embedding, link_embeddings)[0]

        # Find the best match
        best_score_idx = int(cosine_scores.argmax())
        best_score = float(cosine_scores[best_score_idx])
        best_link_text = link_texts[best_score_idx]

        print(f"Best match: '{best_link_text}' with score: {best_score}")

        # Usage threshold
        THRESHOLD = 0.3  # Adjust based on testing
        
        if best_score < THRESHOLD:
             return jsonify({
                'result': {
                    'explanation': f"I analyzed the page but couldn't find a link that confidently matches '{query}'. The best I found was '{best_link_text}' (uncertain).",
                    'relevant_link_text': None
                }
            })

        return jsonify({
            'result': {
                'explanation': f"Based on your request, I think you should go to '{best_link_text}'.",
                'relevant_link_text': best_link_text
            }
        })

    except Exception as e:
        print(f"Processing Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run on port 5000 to avoid conflict with potential other servers,
    # or we can use 3000 if we kill the node server. 
    # Let's use 5000 and update extension to point to 5000.
    app.run(host='0.0.0.0', port=5000, debug=True)
