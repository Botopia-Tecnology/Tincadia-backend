
import numpy as np
import sys
import os
import json

# Configurar rutas para importar 'app'
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(base_dir, "app"))
sys.path.insert(0, os.path.join(base_dir, "app", "ModeloV3001-EXPORT"))

from lsc_streaming_exacto import LSCStreamingPredictor
from lsc_engine import LSCEngine

def simulate_dynamic_sign():
    print("🚀 Simulando Seña Dinámica (Ej: BUENOS DIAS)...")
    
    predictor = LSCEngine.get_predictor()
    if not predictor:
        print("❌ Error al cargar recursos.")
        return

    # Probar con el predictor de streaming real
    streaming = LSCStreamingPredictor(base_predictor=predictor)

    # Simulamos 30 frames
    # Frames 0-10: Silencio/Movimiento preparatorio (Confianza baja)
    # Frames 11-15: EL MOMENTO CLAVE (La seña se forma y la confianza sube a 0.7)
    # Frames 16-30: Transición o finalización (La confianza vuelve a bajar)
    
    # Landmarks "base" (HOLA como ejemplo de seña que la IA conoce)
    # En una seña real, los landmarks cambiarían, pero para probar el BUFFER nos basta con
    # que el clasificador devuelva la palabra y una confianza variable.
    
    class FakeCoords:
        def __init__(self, conf, word):
            self.conf = conf
            self.word = word

    # Mock de predict_from_coords para simular la "curva" de una seña dinámica
    original_predict = predictor.predict_from_coords
    
    results_sequence = []
    for i in range(30):
        if 10 <= i <= 16: # Ventana de reconocimiento de apenas 6 frames
            conf = 0.65
            word = "BUENOS_DIAS"
        else:
            conf = 0.1
            word = "None"
            
        def mock_predict(c, include_probabilities=False):
            return {'status': 'ok', 'word': word, 'confidence': conf, 'probabilities': [0]*200}
        
        predictor.predict_from_coords = mock_predict
        
        # Landmarks dummy (226)
        dummy = np.zeros(226)
        dummy[44] = 0.5 # Para evitar NO_USER
        dummy[48] = 0.5
        
        res = streaming.add_landmarks(dummy)
        results_sequence.append({
            'frame': i,
            'conf': conf,
            'word_in_buffer': word if conf >= 0.4 else "None",
            'final_word': res.get('word'),
            'status': res.get('status')
        })
        
        print(f"F{i:02d} | In: {word:12} ({conf:.2f}) | Out: {str(res.get('word')):12} | Status: {res.get('status')}")

    predictor.predict_from_coords = original_predict
    
    final_recognized = [r['final_word'] for r in results_sequence if r['final_word'] is not None]
    if final_recognized:
        print(f"\n✅ RECONOCIDA: {final_recognized[0]}")
    else:
        print("\n❌ NO RECONOCIDA (El buffer de 10 frames con 60% de votos es demasiado lento para esta seña)")

if __name__ == "__main__":
    simulate_dynamic_sign()
