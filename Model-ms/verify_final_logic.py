import os
import sys
import numpy as np
from unittest.mock import MagicMock

# Configurar entorno para evitar logs de TF
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

def verify():
    print("--- 🔍 Iniciando Verificación de Lógica Final ---")
    
    # 1. Mock del predictor base para no cargar el modelo real (pesado)
    mock_base = MagicMock()
    mock_base.config = {
        "classes": {
            "0": "Hola",
            "1": "Como-estas",
            "2": "Letra_P"
        }
    }
    
    # Mock de la predicción cruda
    # Simulamos una "Letra_P" con confianza baja (0.21) como en la captura del usuario
    mock_base.predict_from_coords.return_value = {
        'status': 'ok',
        'word': 'Letra_P',
        'confidence': 0.21,
        'probabilities': [0.1, 0.1, 0.21] + [0.0]*60 
    }
    
    from lsc_streaming_exacto import LSCStreamingExactoPredictor
    predictor = LSCStreamingExactoPredictor(base_predictor=mock_base)
    
    print("\n--- TEST 1: Filtro de Ruido (Confianza Baja) ---")
    # Generar 10 cuadros de "ruido"
    for _ in range(10):
        res = predictor.add_landmarks(np.zeros(226))
    
    print(f"Resultado tras ruido (0.21): {res['word']} (Debería ser None)")
    if res['word'] is None:
        print("✅ [OK] Ruido filtrado correctamente.")
    else:
        print("❌ [FALLO] El ruido pasó el filtro.")

    print("\n--- TEST 2: Control de Historial (Manual vs Automático) ---")
    # Simulamos ahora una seña estable pero que NO hemos aceptado todavía
    mock_base.predict_from_coords.return_value = {
        'status': 'ok',
        'word': 'Hola',
        'confidence': 0.85,
        'probabilities': [0.85, 0.05, 0.1] + [0.0]*60
    }
    
    # Añadir 5 cuadros estables de "Hola"
    for _ in range(5):
        res = predictor.add_landmarks(np.zeros(226))
        
    print(f"Palabra detectada: {res['word']}")
    print(f"Historial GPT-2: {list(predictor.word_history)} (Debería estar vacío)")
    
    if len(predictor.word_history) == 0:
        print("✅ [OK] El historial NO se llenó automáticamente. Esperando al usuario.")
    else:
        print("❌ [FALLO] El historial se llenó solo (Spam potencial).")

    print("\n--- TEST 3: Activación de IA tras Aceptación ---")
    # El usuario acepta la palabra 'Hola'
    predictor.set_accepted_word("Hola")
    print(f"Historial tras aceptar: {list(predictor.word_history)}")
    
    # IMPORTANTE: Limpiar buffer para que las predicciones viejas no interfieran
    predictor.reset_buffer()
    
    # Simulamos que ahora el modelo duda entre 'Hola' y 'Como-estas'
    # Crudamente 'Como-estas' tiene 0.35 y 'Hola' tiene 0.40
    mock_base.predict_from_coords.return_value = {
        'status': 'ok',
        'word': 'Hola',
        'confidence': 0.40,
        'probabilities': [0.40, 0.35, 0.05] + [0.0]*96
    }
    
    # Forzar una "inteligencia" en el cache para 'Como-estas'
    predictor.llm_scores_cache = {1: 0.9} # 1 es 'Como-estas'
    
    # Darle 10 cuadros para que la predicción se estabilice en el buffer (necesita >= 3)
    for i in range(10):
        res = predictor.add_landmarks(np.zeros(226))
        print(f"  [Frame {i}] Status: {res['status']}, Word: {res['word']}, Conf: {res['confidence']:.2f}, Buffer: {list(predictor.prediction_buffer)}")
    
    # Debido al boost, 'Como-estas' debería ganar sobradamente
    print(f"Predicción final con IA: {res['word']}")
    if res['word'] == 'Como-estas':
         print("✅ [OK] La IA impulsó la palabra correcta basada en el historial.")
    else:
         print(f"❌ [FALLO] La IA no influyó. Ganó: {res['word']}")

    print("\n--- ✅ VERIFICACIÓN COMPLETADA ---")

if __name__ == "__main__":
    verify()
