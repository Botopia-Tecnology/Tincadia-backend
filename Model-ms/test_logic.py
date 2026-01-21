import os
import unittest
from unittest.mock import MagicMock, patch
import numpy as np
import sys

# Mocking modules that might not be available or are too heavy
sys.modules['tensorflow'] = MagicMock()
sys.modules['mediapipe'] = MagicMock()
sys.modules['cv2'] = MagicMock()

# Add app directory to sys.path to allow internal imports in lsc_streaming_exacto
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

# Set env var before import if needed, or we will patch it
os.environ["LOGS_ENABLED"] = "false"

from app.lsc_streaming_exacto import LSCStreamingExactoPredictor

class TestPredictorLogic(unittest.TestCase):
    def setUp(self):
        self.mock_base = MagicMock()
        # Mock class mapping
        self.mock_base.config = {
            "classes": {
                "0": "Letra_A",
                "1": "Rojo",
                "2": "Uno"
            }
        }
        
    def test_context_toggle_disabled(self):
        # Force environment variable to false
        with patch.dict(os.environ, {"CONTEXT_AWARE_ENABLED": "false"}):
            predictor = LSCStreamingExactoPredictor(base_predictor=self.mock_base, buffer_size=2)
            self.assertFalse(predictor.context_aware_enabled)
            
            # Mock a prediction result
            probabilities = [0.1, 0.45, 0.45] 
            self.mock_base.predict_from_coords.return_value = {
                'status': 'ok',
                'word': 'Rojo',
                'confidence': 0.45,
                'probabilities': probabilities
            }
            
            predictor.set_context("Colores")
            
            # Add dummy landmarks
            predictor.add_landmarks(np.zeros(226))
            res = predictor.add_landmarks(np.zeros(226))
            
            self.assertEqual(res['word'], 'Rojo')
            self.assertEqual(res['confidence'], 0.45)

    def test_context_toggle_enabled(self):
        # Force environment variable to true
        with patch.dict(os.environ, {"CONTEXT_AWARE_ENABLED": "true"}):
            predictor = LSCStreamingExactoPredictor(base_predictor=self.mock_base, buffer_size=2)
            self.assertTrue(predictor.context_aware_enabled)
            
            # Rojo (idx 1) is in Colores. Uno (idx 2) is in Numeros.
            # Probability for Uno is slightly higher, but Rojo is in context.
            probabilities = [0.1, 0.45, 0.46] 
            self.mock_base.predict_from_coords.return_value = {
                'status': 'ok',
                'word': 'Uno',
                'confidence': 0.46,
                'probabilities': probabilities
            }
            
            predictor.set_context("Colores")
            
            # Add dummy landmarks
            predictor.add_landmarks(np.zeros(226))
            res = predictor.add_landmarks(np.zeros(226))
            
            # Rojo should be boosted and chosen over Uno
            self.assertEqual(res['word'], 'Rojo')
            self.assertGreater(res['confidence'], 0.46)

if __name__ == "__main__":
    unittest.main()
