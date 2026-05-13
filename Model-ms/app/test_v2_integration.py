#!/usr/bin/env python3
"""
Test de integración para LSCEngineV2 + V2StreamingPredictor.

Valida sin tocar main.py:
  1. El engine carga el modelo V2 sin errores.
  2. Crea un predictor con buffer rotativo.
  3. Simula 50 frames y verifica los status:
     - frames 1-29  → "waiting"
     - frame 30     → "no_sign" (frames aleatorios sin manos detectadas)
     - frames con manos sintéticas → "ok"

Corre desde model-ms/app/:
    python test_v2_integration.py
"""
import os
import sys
import numpy as np

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from lsc_engine_v2 import LSCEngineV2


def main():
    print("=" * 70)
    print("  TEST V2 INTEGRATION")
    print("=" * 70)

    # 1. Cargar engine
    model = LSCEngineV2.get_model()
    config = LSCEngineV2.get_config()
    assert model is not None, "❌ Modelo no cargó"
    assert config is not None, "❌ Config no cargó"
    print(f"\n✅ Engine V2 cargado")
    print(f"   Modelo: {config['model_info']['name']}")
    print(f"   Accuracy: {config['model_info']['val_accuracy']:.2%}")
    print(f"   Clases: {config['model_info']['num_classes']}")

    # 2. Crear predictor
    predictor = LSCEngineV2.create_predictor()
    assert predictor is not None, "❌ Predictor no creó"
    print(f"\n✅ Predictor creado (buffer: {predictor.frames_per_sequence})")

    # 3. Test "waiting" — buffer llenándose
    print(f"\n▶ Test 1: buffer llenándose (29 frames)")
    for i in range(29):
        coords = np.zeros(226, dtype=np.float32).tolist()
        result = predictor.predict_from_coords(coords)
    print(f"   Frame 29 → status: '{result['status']}', "
          f"progress: {result.get('buffer_progress')}/{result.get('buffer_size')}")
    assert result["status"] == "waiting", f"❌ Esperaba 'waiting', recibí '{result['status']}'"
    print(f"   ✅ Status correcto")

    # 4. Test "no_sign" — frame 30 sin manos
    print(f"\n▶ Test 2: buffer lleno SIN manos (debería ser 'no_sign')")
    coords = np.zeros(226, dtype=np.float32).tolist()
    result = predictor.predict_from_coords(coords)
    print(f"   Frame 30 → status: '{result['status']}'")
    assert result["status"] == "no_sign", f"❌ Esperaba 'no_sign', recibí '{result['status']}'"
    print(f"   ✅ Status correcto")

    # 5. Test "ok" — alimentar 30 frames con coords no-cero (simulando manos)
    print(f"\n▶ Test 3: buffer con coords sintéticas (manos presentes)")
    predictor.clear_buffer()
    for i in range(30):
        coords = np.random.random(226).astype(np.float32)
        result = predictor.predict_from_coords(coords.tolist())
    print(f"   Frame 30 → status: '{result['status']}', "
          f"word: '{result.get('word')}', "
          f"confidence: {result.get('confidence', 0):.2%}")
    assert result["status"] == "ok", f"❌ Esperaba 'ok', recibí '{result['status']}'"
    assert result["word"] in config["classes"].values(), \
        f"❌ Palabra '{result['word']}' no está en las clases"
    print(f"   ✅ Predicción válida (palabra random porque coords son random)")

    # 6. Test error_shape
    print(f"\n▶ Test 4: coords con shape incorrecto")
    result = predictor.predict_from_coords([0.0] * 100)
    print(f"   → status: '{result['status']}'")
    assert result["status"] == "error_shape"
    print(f"   ✅ Status correcto")

    # 7. Test aislamiento entre sesiones
    print(f"\n▶ Test 5: aislamiento entre dos predictores (sesiones distintas)")
    p1 = LSCEngineV2.create_predictor()
    p2 = LSCEngineV2.create_predictor()
    p1.add_frame(np.random.random(226).astype(np.float32))
    assert len(p1.buffer) == 1
    assert len(p2.buffer) == 0, f"❌ Buffer de p2 contaminado: {len(p2.buffer)}"
    print(f"   ✅ Buffers independientes (p1: 1 frame, p2: 0 frames)")

    print(f"\n{'=' * 70}")
    print(f"  🎉 TODOS LOS TESTS PASARON")
    print(f"{'=' * 70}")
    print(f"\n  Engine V2 y predictor listos para integrar a main.py")
    print(f"  Ningún archivo de V1 fue modificado.")


if __name__ == "__main__":
    main()
