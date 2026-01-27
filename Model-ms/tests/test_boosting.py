import numpy as np
import sys
import os

# Añadir directorio actual al path
sys.path.append(os.path.dirname(__file__))

from lsc_streaming_exacto import LSCStreamingExactoPredictor

class MockExactoPredictor:
    def __init__(self):
        self.config = {
            "classes": {
                "0": "HOLA",
                "1": "COMO",
                "2": "ESTA",
                "3": "AMARILLO",
                "4": "ROJO",
                "5": "UNO"
            }
        }

def test_boosting():
    print("🧪 Probando lógica de booteo (GPT-2)...")
    
    # Simular predictor
    mock_base = MockExactoPredictor()
    predictor = LSCStreamingExactoPredictor(base_predictor=mock_base)
    
    if not predictor.llm_model:
        print("❌ GPT-2 no cargado, no se puede probar el booteo.")
        return

    # Caso 1: Sin historia
    probs = [0.1, 0.1, 0.1, 0.1, 0.1, 0.5] # Mayor prob para "UNO"
    idx, conf = predictor._apply_llm_boost(probs)
    print(f"🔹 Sin historia: {mock_base.config['classes'][str(idx)]} ({conf:.4f})")
    
    # Caso 2: Con historia "HOLA COMO"
    predictor.set_accepted_word("HOLA")
    predictor.set_accepted_word("COMO")
    
    # Probabilidades base: "UNO" sigue siendo el más probable físicamente (0.5)
    # pero "ESTA" (idx 2) es linguísticamente más probable
    probs = [0.05, 0.05, 0.2, 0.1, 0.1, 0.5] 
    
    idx_boosted, conf_boosted = predictor._apply_llm_boost(probs)
    word_boosted = mock_base.config["classes"][str(idx_boosted)]
    
    print(f"🔹 Con historia 'HOLA COMO':")
    print(f"   Original: UNO (0.50)")
    print(f"   Boosted: {word_boosted} ({conf_boosted:.4f})")
    
    if word_boosted == "ESTA":
        print("✅ GPT-2 corrigió exitosamente la palabra basada en contexto!")
    else:
        print("⚠️ GPT-2 no cambió la palabra. Podría necesitar ajuste de factor.")

if __name__ == "__main__":
    test_boosting()
