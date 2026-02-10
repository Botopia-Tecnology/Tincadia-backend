import sys
import os
import traceback
import numpy as np

# Add app directory to path
sys.path.append(os.path.join(os.getcwd(), 'app'))

try:
    print("Trying to import LSCEngine...")
    from lsc_engine import LSCEngine
    
    print("Loading model via LSCEngine...")
    model, labels = LSCEngine.get_model_and_labels()
    
    if model is None:
        print("❌ Model failed to load (is None)")
        sys.exit(1)
    else:
        print(f"✅ Model loaded. Labels count: {len(labels)}")

    print("Getting exact predictor...")
    predictor = LSCEngine.get_predictor()
    if predictor is None:
        print("❌ Predictor failed to load")
        sys.exit(1)
        
    print("Testing basic prediction with random data...")
    dummy_input = np.random.rand(226).astype(np.float32)
    result = predictor.predict_from_coords(dummy_input.tolist())
    print(f"Prediction result: {result}")
    
    print("\nTesting Streaming Predictor initialization (without GPT-2)...")
    from lsc_streaming_exacto import LSCStreamingPredictor
    
    stream_predictor = LSCStreamingPredictor(base_predictor=predictor)
    stream_result = stream_predictor.add_landmarks(dummy_input)
    print(f"Streaming valid result: {stream_result}")

    print("\nTesting Invalid Landmarks (Should log error)...")
    invalid_input = np.zeros(10) # Wrong shape
    invalid_result = stream_predictor.add_landmarks(invalid_input)
    print(f"Streaming invalid result: {invalid_result}")
    
except Exception as e:
    print(f"❌ Exception occurred: {e}")
    traceback.print_exc()
