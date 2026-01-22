import traceback
import sys

def test_gpt2():
    print("--- Iniciando prueba de carga de GPT-2 ---")
    try:
        from transformers import GPT2Tokenizer, GPT2LMHeadModel
        import torch
        
        print("Intentando cargar tokenizer...")
        tokenizer = GPT2Tokenizer.from_pretrained("gpt2")
        print("✅ Tokenizer cargado.")
        
        print("Intentando cargar modelo (esto puede tardar y requiere internet)...")
        model = GPT2LMHeadModel.from_pretrained("gpt2")
        print("✅ Modelo cargado correctamente.")
        
    except Exception as e:
        print("❌ ERROR EN LA CARGA:")
        print(f"Tipo: {type(e).__name__}")
        print(f"Mensaje: {str(e)}")
        traceback.print_exc()

if __name__ == "__main__":
    test_gpt2()
