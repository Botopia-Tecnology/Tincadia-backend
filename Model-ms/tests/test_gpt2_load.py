from transformers import GPT2Tokenizer, GPT2LMHeadModel
import torch
import time

def test_load():
    print("⏳ Iniciando carga de GPT-2...")
    start_time = time.time()
    try:
        tokenizer = GPT2Tokenizer.from_pretrained("gpt2")
        model = GPT2LMHeadModel.from_pretrained("gpt2")
        end_time = time.time()
        print(f"✅ GPT-2 cargado en {end_time - start_time:.2f} segundos.")
        
        # Prueba de inferencia rápida
        input_text = "HOLA MI NOMBRE"
        inputs = tokenizer(input_text, return_tensors="pt")
        with torch.no_grad():
            outputs = model(**inputs)
            next_token_logits = outputs.logits[:, -1, :]
            probs = torch.softmax(next_token_logits, dim=-1)
            print(f"✅ Inferencia exitosa para: '{input_text}'")
            
        return True
    except Exception as e:
        print(f"❌ Error cargando GPT-2: {e}")
        return False

if __name__ == "__main__":
    test_load()
