import sys
import os
import numpy as np

# Add app directory to sys.path
app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
sys.path.insert(0, app_dir)

from lsc_streaming_exacto import LSCStreamingPredictor

def create_mock_landmarks(shoulder_width: float, visibility: float = 1.0):
    """
    Creates dummy landmarks with specific shoulder distance.
    Landmark 11: (-width/2, 0) -> Normalized to (0.5 - width/2, 0.5)
    Landmark 12: (+width/2, 0) -> Normalized to (0.5 + width/2, 0.5)
    """
    landmarks = np.zeros(226)
    
    # Indices for Landmark 11 (Left Shoulder): 44 (x), 45 (y), 46 (z), 47 (v)
    # Indices for Landmark 12 (Right Shoulder): 48 (x), 49 (y), 50 (z), 51 (v)
    
    x11 = 0.5 - (shoulder_width / 2)
    x12 = 0.5 + (shoulder_width / 2)
    
    landmarks[44] = x11
    landmarks[45] = 0.5
    landmarks[47] = visibility
    
    landmarks[48] = x12
    landmarks[49] = 0.5
    landmarks[51] = visibility
    
    return landmarks

def test_distance_alerts():
    print("Testing Distance Alerts Logic...")
    
    # Mocking the predictor to avoid loading the real model
    class MockPredictor:
        pass
    
    predictor = LSCStreamingPredictor(base_predictor=MockPredictor())
    
    test_cases = [
        {"width": 0.10, "expected": "TOO_FAR", "desc": "Very far (10% width)"},
        {"width": 0.17, "expected": "TOO_FAR", "desc": "Far threshold (17% width)"},
        {"width": 0.30, "expected": "OK", "desc": "Ideal distance (30% width)"},
        {"width": 0.49, "expected": "OK", "desc": "Close threshold (49% width)"},
        {"width": 0.55, "expected": "TOO_CLOSE", "desc": "Very close (55% width)"},
        {"width": 0.10, "visibility": 0.1, "expected": None, "desc": "Low visibility"},
        {"width": 0.0, "visibility": 1.0, "expected": "NO_USER", "desc": "No user detected (0 width)"}
    ]
    
    for case in test_cases:
        lm = create_mock_landmarks(case["width"], case.get("visibility", 1.0))
        alert = predictor._check_distance(lm)
        
        status = "✅" if alert == case["expected"] else "❌"
        print(f"{status} {case['desc']}: Width={case['width']}, Expected={case['expected']}, Got={alert}")
        
        if alert != case["expected"]:
            raise Exception(f"Failed test case: {case['desc']}")

    print("\n✅ Distance alerting logic verified!")

if __name__ == "__main__":
    test_distance_alerts()
