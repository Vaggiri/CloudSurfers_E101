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
    print("Loading AI Model...")
    
    import os
    from transformers import AutoTokenizer, AutoModelForCausalLM
    import torch

    model_path = 'paraphrase-multilingual-MiniLM-L12-v2'
    llm_model_name = "Qwen/Qwen2.5-0.5B-Instruct" 
    
    if os.path.exists('./fine_tuned_model'):
        print("Found fine-tuned model! Loading custom weights...")
        model_path = './fine_tuned_model'
    else:
        print("Loading Base AI Model... (First run may take time to download)")

    model = SentenceTransformer(model_path)
    print(f"SentenceTransformer loaded successfully from {model_path}!")

    print(f"Loading {llm_model_name} for Smart Intent...")
    tokenizer = AutoTokenizer.from_pretrained(llm_model_name)
    llm_model = AutoModelForCausalLM.from_pretrained(llm_model_name)
    print("LLM Model loaded successfully!")

except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.json
        query = data.get('query', '')
        links = data.get('links', [])
        page_title = data.get('pageTitle', '')

        if not query or not links:
            return jsonify({'error': 'Missing query or links'}), 400

        print(f"Analyzing query: '{query}'")

        # --- 1. HYBRID LAYER: Instant Regex Check (0ms Latency) ---
        # Smart Regex: Clean common conversational prefixes
        def clean_query(text):
            text = text.lower().strip()
            startTime = 0
            # Common prefixes to strip usually allow the "intent" verb to filter through
            # But here we want to catch "I need to buy X" -> we want to strip "I need to"
            prefixes = [
                "i want to ", "i need to ", "can you ", "could you ", "please ",
                "help me ", "i am looking for ", "i'm looking for ", "search for ", 
                "find ", "looking for ", "show me "
            ]
            for p in prefixes:
                if text.startswith(p):
                    text = text[len(p):].strip()
            return text

        cleaned_query = clean_query(query)
        # Search triggers that imply a direct search intent
        regex_triggers = ["buy ", "get ", "purchase ", "order ", "shop for "]
        
        target_search = None
        
        # Check against triggers
        lower_query = query.lower().strip()
        for trigger in regex_triggers:
            if lower_query.startswith(trigger):
                target_search = lower_query[len(trigger):].strip()
                break
            if cleaned_query.startswith(trigger): 
                target_search = cleaned_query[len(trigger):].strip()
                break

        if target_search:
            print(f"Smart Regex Hit: '{target_search}'")
            return jsonify({
                'result': {
                    'explanation': f"I'll search for '{target_search}'.",
                    'relevant_link_text': None,
                    'search_query': target_search
                }
            })

        # --- 1.5 HEURISTIC KEYWORD LAYER (Navigation Optimization) ---
        # For tasks like "change repo name" -> "Settings"
        # We manually boost commonly known navigation mappings to save LLM/Search time.
        
        nav_heuristics = {
            "change": ["settings", "options", "edit", "configure", "preferences"],
            "edit": ["edit", "update", "modify", "settings"],
            "rename": ["settings", "edit", "properties"],
            "delete": ["delete", "remove", "bin", "trash"],
            "logout": ["logout", "sign out", "log out", "exit"],
            "login": ["login", "sign in", "log in"],
            "repo name": ["settings", "general"], # Specific to GitHub-like scenarios
        }

        heuristic_boost = {}
        for keyword, targets in nav_heuristics.items():
            if keyword in lower_query:
                for target in targets:
                    heuristic_boost[target] = 0.3 # Add score boost

        # --- 2. SEMANTIC SEARCH LAYER (SentenceTransformer) ---
        link_texts = [link.get('text', '') for link in links]
        if not link_texts:
             return jsonify({'result': {'explanation': "No links found.", 'relevant_link_text': None}})

        query_embedding = model.encode(query, convert_to_tensor=True)
        link_embeddings = model.encode(link_texts, convert_to_tensor=True)
        cosine_scores = util.cos_sim(query_embedding, link_embeddings)[0]
        
        # Apply Heuristic Boosts
        for i, text in enumerate(link_texts):
            t_lower = text.lower()
            for target_k in heuristic_boost:
                if target_k in t_lower:
                     cosine_scores[i] += heuristic_boost[target_k]
                     print(f"Boosting '{text}' by {heuristic_boost[target_k]} due to heuristic match.")

        best_score_idx = int(cosine_scores.argmax())
        best_score = float(cosine_scores[best_score_idx])
        best_link_text = link_texts[best_score_idx]

        print(f"Best match: '{best_link_text}' with score: {best_score}")

        # If we have a very strong link match, just go there.
        if best_score > 0.55: # Lowered slightly due to boost potential
             return jsonify({
                'result': {
                    'explanation': f"I think you should go to '{best_link_text}'.",
                    'relevant_link_text': best_link_text,
                    'search_query': None
                }
            })

        # --- 3. SMART FALLBACK LAYER (Qwen LLM) ---
        # If Regex didn't catch it, and Semantic Link Match is weak/uncertain,
        # ask the LLM to extract intent. It might be phrased complexly like "I need a new phone".
        
        print("Using Qwen LLM for deep analysis...")
        # UPDATED PROMPT: More robust for navigation vs search
        messages = [
            {"role": "system", "content": "You are a web navigation assistant. Analyze the User Request. \n1. If the user wants to navigate to a specific page or section (e.g. 'change password' -> 'Settings', 'see my orders' -> 'Orders'), return 'NAV: <Target Link Name>'.\n2. If the user wants to buy/find/search for a product (e.g. 'buy shoes', 'find red dress'), return 'SEARCH: <Product Name>'.\n3. If unsure, return 'None'."},
            {"role": "user", "content": f"Request: {query}"}
        ]
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        model_inputs = tokenizer([text], return_tensors="pt")

        generated_ids = llm_model.generate(
            model_inputs.input_ids,
            max_new_tokens=50,
            temperature=0.1  # Low temp for deterministic extraction
        )
        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]
        
        extracted_text = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
        print(f"Qwen Extracted: {extracted_text}")

        if extracted_text.startswith("SEARCH:"):
             term = extracted_text.replace("SEARCH:", "").strip()
             return jsonify({
                'result': {
                    'explanation': f"I'll search for '{term}'.",
                    'relevant_link_text': None,
                    'search_query': term
                }
            })
        elif extracted_text.startswith("NAV:"):
             target_link = extracted_text.replace("NAV:", "").strip()
             # Try to find this link in available links
             # Simple fuzzy match
             best_llm_match = None
             for link in link_texts:
                 if target_link.lower() in link.lower():
                     best_llm_match = link
                     break
             
             if best_llm_match:
                 return jsonify({
                    'result': {
                        'explanation': f"I think you should go to '{best_llm_match}'.",
                        'relevant_link_text': best_llm_match,
                        'search_query': None
                    }
                })

        # Fallback to the weak link match if Qwen found nothing
        if best_score > 0.25:
            return jsonify({
                'result': {
                    'explanation': f"I think you should go to '{best_link_text}'.",
                    'relevant_link_text': best_link_text,
                    'search_query': None
                }
            })
            
        return jsonify({
            'result': {
                'explanation': f"I couldn't identify a clear search or link matches for '{query}'.",
                'relevant_link_text': None,
                'search_query': None
            }
        })

    except Exception as e:
        print(f"Processing Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
