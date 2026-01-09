
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import tensorflow as tf

MODEL_PATH = 'lsc_model_full_repaired.h5'

if os.path.exists(MODEL_PATH):
    try:
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        print(f"Model Input Shape: {model.input_shape}")
    except Exception as e:
        print(f"Error loading Keras model: {e}")
else:
    print(f"Model file {MODEL_PATH} not found.")
