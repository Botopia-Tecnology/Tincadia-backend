"""Arquitectura V2 — Bidirectional GRU sobre secuencias temporales."""
import tensorflow as tf


def build_model_v2(num_classes: int, frames_per_sequence: int = 30, feature_dim: int = 452):
    """Construye el modelo V2 idéntico al usado en entrenar_v2.py."""
    l2 = tf.keras.regularizers.l2(1e-4)
    return tf.keras.Sequential([
        tf.keras.layers.Input(shape=(frames_per_sequence, feature_dim)),
        tf.keras.layers.GaussianNoise(0.015),
        tf.keras.layers.Bidirectional(
            tf.keras.layers.GRU(128, return_sequences=True, dropout=0.3, kernel_regularizer=l2)
        ),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.Bidirectional(
            tf.keras.layers.GRU(64, dropout=0.3, kernel_regularizer=l2)
        ),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.Dense(128, activation='relu', kernel_regularizer=l2),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.Dense(num_classes, activation='softmax'),
    ])
