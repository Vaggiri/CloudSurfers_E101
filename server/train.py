from sentence_transformers import SentenceTransformer, InputExample, losses, evaluation
from torch.utils.data import DataLoader
import json
import os

# Configuration
MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
TRAINING_DATA_FILE = 'training_data.json'
OUTPUT_DIR = 'fine_tuned_model'
NUM_EPOCHS = 1
BATCH_SIZE = 16

def train_model():
    print(f"Loading base model: {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)

    print(f"Loading training data from {TRAINING_DATA_FILE}...")
    try:
        with open(TRAINING_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {TRAINING_DATA_FILE} not found. Please create it first.")
        return

    train_examples = []
    for item in data:
        train_examples.append(InputExample(texts=[item['query'], item['link_text']], label=float(item['label'])))

    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=BATCH_SIZE)
    train_loss = losses.CosineSimilarityLoss(model)

    print("Starting training...")
    # Tune the model
    model.fit(train_objectives=[(train_dataloader, train_loss)], epochs=NUM_EPOCHS, warmup_steps=100)

    print(f"Saving fine-tuned model to {OUTPUT_DIR}...")
    model.save(OUTPUT_DIR)
    print("Training complete!")

if __name__ == "__main__":
    train_model()
