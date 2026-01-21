import sys
import os
import numpy as np
import json

# Add app directory to sys.path
app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
sys.path.insert(0, app_dir)

from lsc_streaming_exacto import LSCStreamingPredictor
from exacto_predictor_colnumword import create_exact_predictor

def test_contextual_boosting():
    print("🚦 Testing Contextual Boosting...")
    
    # 1. Setup Predictor
    base_predictor = create_exact_predictor()
    streaming_predictor = LSCStreamingPredictor(base_predictor=base_predictor)
    
    # 2. Simulate Ambiguous Prediction
    # We'll create a dummy probability distribution where 'Dos' (17) is slightly higher than 'Verde' (62)
    labels = base_predictor.config["classes"]
    num_classes = len(labels)
    
    # Mock probabilities: Dos=0.4, Verde=0.35, others=very low
    mock_probs = np.zeros(num_classes)
    idx_dos = [k for k, v in labels.items() if v == 'Dos'][0]
    idx_verde = [k for k, v in labels.items() if v == 'Verde'][0]
    
    mock_probs[int(idx_dos)] = 0.4
    mock_probs[int(idx_verde)] = 0.35
    
    print(f"\n--- Baseline (No Context) ---")
    streaming_predictor.set_context(None)
    win_idx, win_conf = streaming_predictor._apply_context_boost(mock_probs.tolist())
    print(f"Winner: {labels[str(win_idx)]} ({win_conf:.2%})")
    assert labels[str(win_idx)] == 'Dos'
    
    print(f"\n--- Context: Colores ---")
    streaming_predictor.set_context("Colores")
    win_idx, win_conf = streaming_predictor._apply_context_boost(mock_probs.tolist())
    print(f"Winner: {labels[str(win_idx)]} ({win_conf:.2%})")
    assert labels[str(win_idx)] == 'Verde'
    
    print(f"\n--- Context: Numeros ---")
    streaming_predictor.set_context("Numeros")
    win_idx, win_conf = streaming_predictor._apply_context_boost(mock_probs.tolist())
    print(f"Winner: {labels[str(win_idx)]} ({win_conf:.2%})")
    assert labels[str(win_idx)] == 'Dos'

    print("\n✅ Contextual Boosting test passed!")

if __name__ == "__main__":
    try:
        test_contextual_boosting()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
