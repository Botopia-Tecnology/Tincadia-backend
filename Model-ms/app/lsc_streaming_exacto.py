#!/usr/bin/env python3
"""
Streaming Predictor compatible con el modelo exacto COL-NUM-WORD-1101-2
Usa el predictor exacto para normalización y predicción
"""
import numpy as np
import tensorflow as tf
import json
import os
from collections import Counter, deque
from typing import Optional, Dict, Tuple
import sys

# Logging configuration
LOGS_ENABLED = os.getenv("LOGS_ENABLED", "true").lower() == "true"

def log(*args, **kwargs):
    """Conditional logging based on LOGS_ENABLED environment variable"""
    if LOGS_ENABLED:
        print(*args, **kwargs)

# Importar predictor exacto
from exacto_predictor_colnumword import ExactoPredictorCOLNUMWORD

# NLP (GPT-2 for intelligent context) - Se cargarán bajo demanda
# from transformers import GPT2Tokenizer, GPT2LMHeadModel
# import torch

class LSCStreamingExactoPredictor:
    """
    Predictor de streaming que usa el predictor exacto COL-NUM-WORD-1101-2
    para garantizar compatibilidad 100% con el entrenamiento
    """

    def __init__(self, model_path: str = None, labels_path: str = None, config_path: str = "model_config.json", buffer_size: int = 5, shared_model=None, shared_labels=None, base_predictor=None):
        """
        Inicializa el predictor de streaming exacto.
        Puede recibir un base_predictor ya cargado para ahorrar memoria y tiempo.
        """
        if base_predictor:
            self.exacto_predictor = base_predictor
            log("✅ Usando predictor base compartido para streaming")
        else:
            # Crear predictor exacto (solo si no se pasó uno compartido)
            self.exacto_predictor = ExactoPredictorCOLNUMWORD(model_path, config_path)
            log(f"✅ Nuevo predictor interno creado para streaming")
        
        # Inicializar GPT-2
        log("🧠 Cargando modelo inteligente (GPT-2) para contexto...")
        try:
            from transformers import GPT2Tokenizer, GPT2LMHeadModel
            import torch
            
            self.tokenizer = GPT2Tokenizer.from_pretrained("gpt2")
            self.llm_model = GPT2LMHeadModel.from_pretrained("gpt2")
            log("✅ GPT-2 cargado correctamente")
        except Exception as e:
            import traceback
            log(f"⚠️ Error cargando GPT-2 (se usará modo base): {e}")
            if LOGS_ENABLED:
                traceback.print_exc()
            self.llm_model = None
        
        # Buffer circular para landmarks
        self.buffer_size = buffer_size
        self.landmarks_buffer = deque(maxlen=buffer_size)
        
        # Buffer para predicciones (suavizado)
        self.prediction_buffer = deque(maxlen=15)  # Aumentado de 10 a 15 para mayor estabilidad
        
        # Estado
        self.frame_count = 0
        self.no_user_count = 0 # Contador para auto-reset
        self.last_prediction = None
        self.last_accepted_word = None # Nuevo: Contexto de palabra aceptada
        # Contexto y pesos
        self.current_context = None
        self.context_weights = {
            "Colores": ["Amarillo", "Azul", "Blanco", "Café", "Gris", "Morado", "Naranja", "Negro", "Rojo", "Rosado", "Verde"],
            "Numeros": ["Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"],
            "Letras": [f"Letra_{c}" for c in "ABCDEFGHIJKLMNÑOPQRSTUVWXY"],
            "Saludos": ["Hola", "Chao", "BIENVENIDO", "Buenas-noches", "Buenas-tardes", "Buenos-dias", "COMO-ESTA", "CON-GUSTO", "Gracias", "De-nada", "PERMISO", "Perdon", "Por-favor"]
        }
        
        # Historial para inferencia automática
        self.word_history = deque(maxlen=5)
        self.llm_scores_cache = {} # Caché para evitar procesar GPT-2 en cada cuadro
        
        # Toggle para activar/desactivar inferencia de contexto
        self.context_aware_enabled = os.getenv("CONTEXT_AWARE_ENABLED", "true").lower() == "true"
        self.auto_context_enabled = self.context_aware_enabled
        
        log(f"✅ Predictor de streaming listo (buffer: {buffer_size}, context_aware: {self.context_aware_enabled})")

    def set_context(self, context_name: Optional[str], manual: bool = True):
        """Establece el contexto actual. Si es manual, desactiva la inferencia automática temporalmente."""
        if manual and context_name is not None:
            self.auto_context_enabled = False
        elif manual and context_name is None:
            self.auto_context_enabled = True

        if context_name in self.context_weights or context_name is None:
            self.current_context = context_name
            log(f"🎯 Contexto {'(MANUAL)' if manual else '(AUTO)'} cambiado a: {context_name}")
        else:
            log(f"⚠️ Contexto desconocido: {context_name}")

    def _infer_context_automatic(self, last_word: str):
        """Infiere el contexto basado en la última palabra y el historial."""
        if not self.context_aware_enabled or not self.auto_context_enabled:
            return

        # 1. Búsqueda directa por categoría
        new_context = None
        for ctx, words in self.context_weights.items():
            if last_word in words:
                new_context = ctx
                break
        
        # 2. Si se encontró una categoría clara, cambiar
        if new_context and new_context != self.current_context:
            # DESACTIVADO: La inferencia por categorías ya no es necesaria con GPT-2
            # self.set_context(new_context, manual=False)
            return False 
        
        return False

    def _apply_context_boost(self, probabilities: list) -> Tuple[int, float]:
        """Aplica un refuerzo a las probabilidades según el contexto actual."""
        if not self.current_context:
            idx = np.argmax(probabilities)
            return idx, probabilities[idx]

        boosted_probs = np.array(probabilities).copy()
        target_labels = self.context_weights.get(self.current_context, [])
        
        # Obtener mapeo de etiquetas del predictor
        classes_map = self.exacto_predictor.config["classes"]
        
        for idx_str, label in classes_map.items():
            idx = int(idx_str)
            if label in target_labels:
                # Boost por un factor (ej. 1.5) para favorecer el contexto
                boosted_probs[idx] *= 1.8
        
        # Volver a normalizar para que sumen 1 (opcional, pero util para confianza real)
        new_idx = np.argmax(boosted_probs)
        original_idx = np.argmax(probabilities)
        
        if new_idx != original_idx:
            original_word = self.exacto_predictor.config["classes"].get(str(original_idx), "Desconocido")
            boosted_word = self.exacto_predictor.config["classes"].get(str(new_idx), "Desconocido")
            # Log de refuerzo de categoría silencioso o muy breve
            # log(f"✨ [Refuerzo de Contexto] CAMBIO: '{original_word}' ({probabilities[original_idx]:.2f}) -> '{boosted_word}' ({boosted_probs[new_idx]:.2f})")
        else:
            # final_word = self.exacto_predictor.config["classes"].get(str(new_idx), "Desconocido")
            # log(f"🎯 [Refuerzo de Contexto] Mantiene: '{final_word}' (Confianza: {boosted_probs[new_idx]:.2f})")
            pass

        return new_idx, boosted_probs[new_idx]

    def set_accepted_word(self, word: str):
        """Actualiza el contexto y el historial con la palabra confirmada por el usuario."""
        log(f"🔔🔔🔔 [set_accepted_word] LLAMADO con word='{word}'")
        log(f"🔔 [set_accepted_word] Estado ANTES: word_history={list(self.word_history)}, last_accepted_word={self.last_accepted_word}")
        
        self.last_accepted_word = word
        
        # 1. Asegurar que la palabra aceptada sea la última en el historial
        if not self.word_history or self.word_history[-1] != word:
            self.word_history.append(word)
            log(f"✅ [set_accepted_word] Añadida '{word}' al historial")
        else:
            log(f"⏭️ [set_accepted_word] '{word}' ya estaba en el historial, no se añade")
        
        # 2. Forzar inferencia de contexto basado en la palabra real aceptada
        self._infer_context_automatic(word)
        
        # 3. Refrescar la inteligencia de GPT-2
        self._refresh_llm_cache()
        
        log(f"🔔 [set_accepted_word] Estado DESPUÉS: word_history={list(self.word_history)}")

    def _refresh_llm_cache(self):
        """Calcula los puntajes de GPT-2 una sola vez y los guarda en caché."""
        if not self.llm_model or not self.word_history:
            self.llm_scores_cache = {}
            return

        try:
            input_text = " ".join(self.word_history)
            log(f"🧠 [GPT-2 Refresh] Generando nueva base de conocimiento para: '{input_text}'")
            
            import torch
            inputs = self.tokenizer(input_text, return_tensors="pt")
            
            with torch.no_grad():
                outputs = self.llm_model(**inputs)
                next_token_logits = outputs.logits[:, -1, :]
                llm_probs = torch.softmax(next_token_logits, dim=-1).squeeze()
            
            classes_map = self.exacto_predictor.config["classes"]
            new_cache = {}
            log_details = []
            
            for idx_str, label in classes_map.items():
                label_tokens = self.tokenizer.encode(" " + label, add_special_tokens=False)
                if label_tokens:
                    score = llm_probs[label_tokens[0]].item()
                    new_cache[int(idx_str)] = score
                    if score > 0.001:
                        log_details.append(f"{label}: {score:.4f}")
            
            self.llm_scores_cache = new_cache
            if log_details:
                log(f"🧠 [IA Scores] Nuevas sugerencias: {', '.join(log_details)}")
                
        except Exception as e:
            log(f"⚠️ Error refrescando caché de IA: {e}")
            self.llm_scores_cache = {}

    def _apply_llm_boost(self, probabilities: list) -> Tuple[int, float]:
        """Usa los puntajes en caché de GPT-2 para premiar a los candidatos."""
        if not self.llm_scores_cache:
            idx = np.argmax(probabilities)
            return idx, probabilities[idx]

        classes_map = self.exacto_predictor.config["classes"]
        boosted_probs = np.array(probabilities).copy()
        
        for idx_int, llm_score in self.llm_scores_cache.items():
            # Aplicar factor de refuerzo usando el score pre-calculado
            boosted_probs[idx_int] *= (1.0 + llm_score * 500)

        # Normalizar
        boosted_probs = boosted_probs / np.sum(boosted_probs)
        new_idx = np.argmax(boosted_probs)
        original_idx = np.argmax(probabilities)
        
        orig_word = classes_map.get(str(original_idx), "Desconocido")
        boost_word = classes_map.get(str(new_idx), "Desconocido")

        if new_idx != original_idx:
            # Silenciado para evitar spam de 30 veces por segundo
            log(f"🤖 [IA Boost] CAMBIO: '{orig_word}' ({probabilities[original_idx]:.2f}) -> '{boost_word}' ({boosted_probs[new_idx]:.2f})")
            pass
            
        return new_idx, boosted_probs[new_idx]

    def add_landmarks(self, landmarks: np.ndarray) -> Optional[Dict]:
        """
        Añade landmarks al buffer usando predictor exacto.
        """
        # Validación básica de forma
        if landmarks.shape[0] != 226:
            return {
                'status': 'error',
                'word': None,
                'confidence': 0,
                'message': f'Invalid landmarks shape: {landmarks.shape}'
            }
        
        # 1. Lógica de Espejo (Mirroring)
        # Basado en la lógica del evaluador local que ayuda a la compatibilidad.
        # Si detecta mano derecha pero no izquierda, invertimos las coordenadas X.
        # Pose landmarks: x es la primera coordenada de cada grupo de 4.
        # Hands landmarks: x es la primera coordenada de cada grupo de 3.
        
        has_left = np.any(landmarks[163:226] != 0)
        has_right = np.any(landmarks[100:163] != 0)
        
        if has_right and not has_left:
            # Espejar coordenadas X (1 - x)
            mirrored = landmarks.copy()
            # Pose X indices: 0, 4, 8, ... 96
            for i in range(0, 100, 4):
                if mirrored[i] != 0:
                    mirrored[i] = 1.0 - mirrored[i]
            # Hands X indices: 100, 103, ... 223
            for i in range(100, 226, 3):
                if mirrored[i] != 0:
                    mirrored[i] = 1.0 - mirrored[i]
            
            # Intercambiar manos en el vector final
            # Mano derecha (100-163) pasa a ser mano izquierda y viceversa
            rh_data = mirrored[100:163].copy()
            lh_data = mirrored[163:226].copy()
            mirrored[100:163] = lh_data
            mirrored[163:226] = rh_data
            
            landmarks = mirrored
            # log("🔄 [Mirror] Landmarks espejados (Dominancia derecha detectada)")

        # Añadir al buffer
        self.landmarks_buffer.append(landmarks)
        
        # Si el buffer está llenándose (opcional, para evitar ruido muy inicial)
        buffer_fill = len(self.landmarks_buffer) / self.buffer_size
        
        # Verificar distancia del usuario
        distance_alert = self._check_distance(landmarks)
        
        # Determinar si hay usuario
        if distance_alert in ["NO_USER", "TOO_FAR"]:
            self.no_user_count += 1
        else:
            self.no_user_count = 0
            
        # Auto-reset si no hay nadie por medio segundo (aprox 15 frames)
        if self.no_user_count > 15:
            if len(self.prediction_buffer) > 0:
                log("🧹 [Auto-Reset] Limpiando buffer por ausencia de usuario")
                self.reset_buffer()
            return {
                'status': 'no_user',
                'word': None,
                'confidence': 0,
                'buffer_fill': buffer_fill,
                'distance_alert': distance_alert
            }

        # Predecir usando landmarks actuales (con probabilidades para contexto)
        try:
            # Usar predictor exacto pidiendo todas las probabilidades
            result = self.exacto_predictor.predict_from_coords(landmarks.tolist(), include_probabilities=True)
            
            if result['status'] != 'ok':
                return {
                    'status': 'error',
                    'word': None,
                    'confidence': 0,
                    'buffer_fill': buffer_fill
                }
            
            # 2. LOG DIAGNÓSTICO: Top 3 cada 30 frames
            self.frame_count += 1
            if self.frame_count % 30 == 0:
                probs = np.array(result['probabilities'])
                top_indices = np.argsort(probs)[-3:][::-1]
                classes_map = self.exacto_predictor.config["classes"]
                top_str = ", ".join([f"{classes_map.get(str(i), '??')}: {probs[i]:.2f}" for i in top_indices])
                log(f"🔍 [Top-3 Candidates] {top_str}")

            # Aplicar lógica de contexto inteligente (GPT-2)
            # Throttle debug logs
            if self.frame_count % 60 == 0:
                log(f"🔍 [Status] word_history: {list(self.word_history)} | context: {self.current_context}")
            
            if self.context_aware_enabled:
                # Priorizamos GPT-2 (LLM Boost) sobre las categorías fijas
                if self.word_history:
                    # log(f"🧠 [DEBUG] Aplicando LLM Boost con historial: {list(self.word_history)}")
                    predicted_idx, confidence = self._apply_llm_boost(result['probabilities'])
                elif self.current_context:
                    # log(f"🎯 [DEBUG] Aplicando Context Boost: {self.current_context}")
                    predicted_idx, confidence = self._apply_context_boost(result['probabilities'])
                else:
                    # predicted_idx, confidence = np.argmax(result['probabilities']), max(result['probabilities'])
                    # Base case is now just the raw result
                    predicted_idx = result['class_idx']
                    confidence = result['confidence']
                
                predicted_word = self.exacto_predictor.config["classes"].get(str(predicted_idx), f"Clase_{predicted_idx}")
            else:
                confidence = result['confidence']
                predicted_word = result['word']
            
            # Filtrar por confianza - Mantener en 0.5 para el buffer, pero loguear el top 3 arriba
            if confidence >= 0.5:
                self.prediction_buffer.append(predicted_word)
            else:
                # Si la confianza es muy baja, añadimos None para ir vaciando el buffer de suavizado
                if confidence < 0.2:
                    self.prediction_buffer.append(None)
            
            # Suavizado (Smoothing) con Voto Mayoritario
            final_word = None
            if len(self.prediction_buffer) >= 4:  # Aumentado de 2 a 4 para mayor estabilidad (accuracy)
                # Obtener la palabra más común en las últimas N predicciones
                # Filtrar valores None
                valid_preds = [p for p in self.prediction_buffer if p is not None]
                if valid_preds:
                    counts = Counter(valid_preds)
                    most_common = counts.most_common(1)[0]
                    
                    # Si la más común es suficientemente dominante (60% del buffer actual)
                    if most_common[1] >= len(self.prediction_buffer) * 0.6:
                        final_word = most_common[0]
            
            # Determinar estatus
            context_changed = False
            if final_word:
                status = 'predicting'
            elif buffer_fill > 0.05:
                status = 'processing'
            else:
                status = 'uncertain'

            return {
                'status': status,
                'word': final_word,
                'confidence': confidence,
                'buffer_fill': buffer_fill,
                'current_context': self.current_context,
                'last_accepted_word': self.last_accepted_word,
                'context_changed': context_changed,
                'distance_alert': distance_alert
            }
            
        except Exception as e:
            log(f"[ERROR] Prediction failed: {e}")
            return {'status': 'error', 'word': None, 'confidence': 0, 'distance_alert': None}

    def _check_distance(self, landmarks: np.ndarray) -> Optional[str]:
        """
        Verifica si el usuario está muy cerca o muy lejos basándose en los hombros.
        Pose landmarks 11 (hombro izquierdo) y 12 (hombro derecho).
        """
        try:
            # Los primeros 100 valores son la pose (25 landmarks * 4: x, y, z, vis)
            # 11: left shoulder, 12: right shoulder
            # Cada landmark ocupa 4 espacios
            
            # Landmark 11 -> indices 44, 45, 46, 47 (x, y, z, v)
            # Landmark 12 -> indices 48, 49, 50, 51 (x, y, z, v)
            
            x11 = landmarks[44]
            y11 = landmarks[45]
            v11 = landmarks[47]
            
            x12 = landmarks[48]
            y12 = landmarks[49]
            v12 = landmarks[51]
            
            # Si la visibilidad es muy baja, no podemos confiar
            if v11 < 0.5 or v12 < 0.5:
                # Si ambos están en 0, es que no se detecta pose
                if x11 == 0 and x12 == 0:
                    return "NO_USER"
                return None
            
            # Calcular distancia Euclidiana 2D entre hombros
            shoulder_width = np.sqrt((x11 - x12)**2 + (y11 - y12)**2)
            
            if shoulder_width < 0.001:
                return "NO_USER"
            
            # Umbrales basados en pruebas empíricas (coordenadas normalizadas 0-1)
            # 0.15 = Muy lejos
            # 0.45 = Muy cerca
            
            if shoulder_width < 0.18:
                return "TOO_FAR"
            elif shoulder_width > 0.50:
                return "TOO_CLOSE"
            
            return "OK"
            
        except Exception as e:
            log(f"[DEBUG] Error checking distance: {e}")
            return None

    def reset_buffer(self):
        """Limpia el buffer de landmarks y predicciones."""
        self.landmarks_buffer.clear()
        self.prediction_buffer.clear()
        self.frame_count = 0
        self.no_user_count = 0
        self.last_prediction = None
        # log("[*] Buffer reseteado")

    def get_stats(self) -> Dict:
        """Retorna estadísticas del predictor."""
        return {
            'total_frames': self.frame_count,
            'buffer_size': self.buffer_size,
            'current_buffer_length': len(self.landmarks_buffer),
            'prediction_buffer_length': len(self.prediction_buffer),
            'last_prediction': self.last_prediction,
            'last_accepted_word': self.last_accepted_word
        }

# Para compatibilidad con el código existente
LSCStreamingPredictor = LSCStreamingExactoPredictor
