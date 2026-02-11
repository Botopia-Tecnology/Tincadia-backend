#!/usr/bin/env python3
"""
Streaming Predictor compatible con el modelo exacto ModeloV3001
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
    Predictor de streaming que usa el predictor exacto ModeloV3001
    para garantizar compatibilidad 100% con el entrenamiento
    """

    def __init__(self, model_path: str = None, labels_path: str = None, config_path: str = "model_config.json", buffer_size: int = 5, shared_model=None, shared_labels=None, base_predictor=None, shared_llm=None, shared_tokenizer=None):
        """
        Inicializa el predictor de streaming exacto.
        Puede recibir un base_predictor y recursos LLM ya cargados.
        """
        if base_predictor:
            self.exacto_predictor = base_predictor
            log("✅ Usando predictor base compartido para streaming")
        else:
            # Crear predictor exacto (solo si no se pasó uno compartido)
            self.exacto_predictor = ExactoPredictorCOLNUMWORD(model_path, config_path)
            log(f"✅ Nuevo predictor interno creado para streaming")
        
        # Inicializar GPT-2 (Usar instancia compartida si existe)
        if shared_llm and shared_tokenizer:
            self.llm_model = shared_llm
            self.tokenizer = shared_tokenizer
            # log("✅ Usando GPT-2 compartido (Singleton)") # Verbose off
        else:
            # CAMBIO CRÍTICO: No cargar GPT-2 localmente para evitar bloqueos.
            # Si el singleton no está listo, simplemente funcionamos sin IA.
            log("⚠️ [Optimizacion] GPT-2 compartido no disponible aún. Iniciando en modo SOLO RED NEURONAL (Rápido).")
            self.llm_model = None
            self.tokenizer = None
            self.context_aware_enabled = False # Desactivar inteligencia temporalmente
        
        # Buffer circular para landmarks
        self.buffer_size = buffer_size
        self.landmarks_buffer = deque(maxlen=buffer_size)
        
        # Buffer para predicciones (suavizado)
        self.prediction_buffer = deque(maxlen=10)  # Reducido de 15 a 10 para mayor agilidad
        
        # Estado
        self.frame_count = 0
        self.no_user_count = 0 # Contador para auto-reset
        self.last_prediction = None
        self.last_accepted_word = None # Nuevo: Contexto de palabra aceptada
        # Contexto y pesos
        self.current_context = None
        self.context_weights = {
            "Colores": ["amarillo", "azul", "blanco", "cafe", "gris", "morado", "naranja", "negro", "rojo", "rosado", "verde"],
            "Numeros": ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"],
            "Letras": [f"Letra_{c}" for c in "ABCDEFGHIJKLMNÑOPQRSTUVWXY"],
            "Saludos": ["HOLA", "CHAO", "BIENVENIDO", "BUENAS-NOCHES", "BUENAS-TARDES", "BUENOS-DIAS", "COMO-ESTA", "CON-GUSTO", "GRACIAS", "DENADA", "PERMISO", "PERDON", "POR-FAVOR"]
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
            return False

        # 1. Búsqueda directa por categoría
        new_context = None
        for ctx, words in self.context_weights.items():
            if last_word in words:
                new_context = ctx
                break
        
        # 2. Si se encontró una categoría clara, cambiar
        if new_context and new_context != self.current_context:
            log(f"🎯 [Auto-Category] Detectada categoría: {new_context}")
            self.set_context(new_context, manual=False)
            return True
        
        return False

    def _apply_context_boost(self, probabilities: np.ndarray) -> np.ndarray:
        """Aplica un refuerzo a las probabilidades según el contexto actual (Categoría)."""
        if not self.current_context:
            return probabilities

        boosted_probs = probabilities.copy()
        target_labels = self.context_weights.get(self.current_context, [])
        
        # Obtener mapeo de etiquetas del predictor
        classes_map = self.exacto_predictor.config["classes"]
        
        for idx_str, label in classes_map.items():
            idx = int(idx_str)
            if label in target_labels:
                # Boost significativo para mantener la categoría (factor 2.0)
                boosted_probs[idx] *= 2.0
        
        return boosted_probs

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
        # 4. Limpiar buffer de predicción para despejar el camino a la siguiente seña
        self.prediction_buffer.clear()
        
        log(f"🔔 [set_accepted_word] Estado DESPUÉS: word_history={list(self.word_history)}")

    def _refresh_llm_cache(self):
        """Calcula los puntajes de GPT-2 una sola vez y los guarda en caché."""
        if not self.llm_model or not self.word_history:
            self.llm_scores_cache = {}
            return

        try:
            # Limpiar etiquetas para que la IA entienda mejor (Letra_A -> A)
            cleaned_history = [w.replace("Letra_", "") if w.startswith("Letra_") else w for w in self.word_history]
            input_text = " ".join(cleaned_history)
            
            # Throttle refresh log
            if self.frame_count % 60 == 0 or len(self.word_history) == 1:
                log(f"🧠 [GPT-2 Refresh] Nueva base: '{input_text}'")
            
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

    def _apply_llm_boost(self, probabilities: np.ndarray) -> np.ndarray:
        """Usa los puntajes en caché de GPT-2 para premiar a los candidatos."""
        if not self.llm_scores_cache:
            return probabilities

        boosted_probs = probabilities.copy()
        for idx_int, llm_score in self.llm_scores_cache.items():
            # Factor de refuerzo lingüístico (50)
            boosted_probs[idx_int] *= (1.0 + llm_score * 50)

        return boosted_probs

    def add_landmarks(self, landmarks: np.ndarray) -> Optional[Dict]:
        """
        Añade landmarks al buffer usando predictor exacto.
        """
        # Log de entrada SIEMPRE (no condicional)
        print(f"[ADD_LANDMARKS-START] Llamada recibida. Shape: {landmarks.shape if hasattr(landmarks, 'shape') else 'NO SHAPE'}")
        
        # Validación básica de forma
        if landmarks.shape[0] != 226:
            print(f"❌ [ADD_LANDMARKS-ERROR] Invalid landmarks shape: {landmarks.shape}. Expected (226,)")
            return {
                'status': 'error',
                'word': None,
                'confidence': 0,
                'message': f'Invalid landmarks shape: {landmarks.shape}'
            }
        
        # --- ESTRATEGIA DE DOBLE PREDICCIÓN (Robustez ante espejado / mobile) ---
        # Creamos una versión espejada de los landmarks (volteando X: 1.0 - x)
        landmarks_mirror = landmarks.copy()
        
        # 1. Voltear X en Pose (indices 0, 4, 8... cada 4)
        landmarks_mirror[0:100:4] = 1.0 - landmarks_mirror[0:100:4]
        
        # 2. Voltear X en Manos (indices 100, 103... cada 3)
        landmarks_mirror[100:226:3] = 1.0 - landmarks_mirror[100:226:3]
        
        # Predecir usando landmarks originales
        try:
            # log(f"[ADD_LANDMARKS-PREDICT] Probando orientación ORIGINAL...")
            res_orig = self.exacto_predictor.predict_from_coords(landmarks.tolist(), include_probabilities=True)
            
            # log(f"[ADD_LANDMARKS-PREDICT] Probando orientación ESPEJO...")
            res_mirr = self.exacto_predictor.predict_from_coords(landmarks_mirror.tolist(), include_probabilities=True)
            
            # Elegir el que tenga mayor confianza
            conf_orig = res_orig.get('confidence', 0)
            conf_mirr = res_mirr.get('confidence', 0)
            
            if conf_mirr > conf_orig:
                result = res_mirr
                if self.frame_count % 30 == 0:
                    log(f"🔄 [Mirror-Match] Usando versión ESPEJADA (conf: {conf_mirr:.2f} vs {conf_orig:.2f})")
            else:
                result = res_orig
                if self.frame_count % 30 == 0:
                    log(f"📸 [Standard-Match] Usando versión ORIGINAL (conf: {conf_orig:.2f} vs {conf_mirr:.2f})")
            
            # Si ambos son muy bajos y estamos en fase de depuración, avisar
            if conf_orig < 0.1 and conf_mirr < 0.1 and self.frame_count % 60 == 0:
                log(f"⚠️ [Low-Conf] Ambas orientaciones fallan (Max: {max(conf_orig, conf_mirr):.2f})")
                
        except Exception as e:
            print(f"💥 [ADD_LANDMARKS-EXCEPTION] Error en dual-prediction: {e}")
            return {'status': 'error', 'word': None, 'confidence': 0}
        # -----------------------------------------------------------------------
        
        # Calcular variables necesarias
        distance_alert = self._check_distance(landmarks)
        buffer_fill = len(self.landmarks_buffer) / self.buffer_size

        # Añadir al buffer
        self.landmarks_buffer.append(landmarks)
        
        print(f"[ADD_LANDMARKS-BUFFER] buffer_len={len(self.landmarks_buffer)} fill={buffer_fill:.2f} dist={distance_alert}")

        # Determinar si hay usuario
        if distance_alert in ["NO_USER", "TOO_FAR"]:
            self.no_user_count += 1
        else:
            self.no_user_count = 0
            
        # Auto-reset si no hay nadie por un instante (aprox 5 frames de silencio)
        if self.no_user_count > 5:
            if len(self.prediction_buffer) > 0:
                log("🧹 [Auto-Reset] Limpiando buffer por silencio")
                self.prediction_buffer.clear()
            
            if self.frame_count % 30 == 0:
                 log(f"[DEBUG] NO_USER detected (count={self.no_user_count}). Returning status='no_user'")

            return {
                'status': 'no_user',
                'word': None,
                'confidence': 0,
                'buffer_fill': buffer_fill,
                'distance_alert': distance_alert
            }

            if result['status'] != 'ok':
                print(f"[ADD_LANDMARKS-PREDICTOR-ERROR] status={result['status']} message={result.get('message', 'No message')}")
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
                # 1. Obtener base
                raw_probs = np.array(result['probabilities'])
                original_idx = np.argmax(raw_probs)
                base_confidence = raw_probs[original_idx]
                
                # 2. IA Boost (Lingüístico - GPT2)
                boosted_probs = self._apply_llm_boost(raw_probs)
                
                # 3. Context Boost (Categoría - Colores, Letras, etc)
                boosted_probs = self._apply_context_boost(boosted_probs)
                
                # 4. Normalizar y obtener final
                boosted_probs = boosted_probs / np.sum(boosted_probs)
                predicted_idx = np.argmax(boosted_probs)
                confidence = boosted_probs[predicted_idx]
                
                # SEGURIDAD: Si el modelo base es demasiado bajo (< 0.15), ignoramos IA
                if base_confidence < 0.15:
                    predicted_idx = original_idx
                    confidence = base_confidence

                predicted_word = self.exacto_predictor.config["classes"].get(str(predicted_idx), f"Clase_{predicted_idx}")
                
                if predicted_idx != original_idx and (confidence >= 0.4 or self.frame_count % 60 == 0):
                    orig_word = self.exacto_predictor.config["classes"].get(str(original_idx), "??")
                    # log(f"✨ [Smart Boost] '{orig_word}' ({base_confidence:.2f}) -> '{predicted_word}' ({confidence:.2f}) [Ctx: {self.current_context}]")
                
                # --- LÓGICA FAST-BREAK (Antipegado) ---
                # Si detectamos una seña NUEVA con mucha confianza, limpiamos la vieja del buffer
                if len(self.prediction_buffer) > 0:
                    counts = Counter(self.prediction_buffer)
                    last_majority_word = counts.most_common(1)[0][0]
                    if predicted_word != last_majority_word and confidence > 0.7:
                        log(f"🚀 [Fast-Break] Detectado cambio rápido: {last_majority_word} -> {predicted_word}")
                        self.prediction_buffer.clear() 
                # --------------------------------------
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
            # Los primeros 100 valores son la pose (25 landmarks * 4: x, y, z, v)
            # 11: left shoulder, 12: right shoulder
            
            x11 = landmarks[44]
            y11 = landmarks[45]
            v11 = landmarks[47]
            
            x12 = landmarks[48]
            y12 = landmarks[49]
            v12 = landmarks[51]
            
            # Periodic debug of raw values
            if self.frame_count % 60 == 0:
                 log(f"[DEBUG] Distance Check: L_Shoulder=({x11:.2f}, {y11:.2f}, v={v11:.2f}) R_Shoulder=({x12:.2f}, {y12:.2f}, v={v12:.2f})")

            # Si la visibilidad es muy baja, no podemos confiar
            if v11 < 0.5 or v12 < 0.5:
                # Si ambos están en 0, es que no se detecta pose
                if x11 == 0 and x12 == 0:
                    return "NO_USER"
                return None
            
            # Calcular distancia Euclidiana 2D entre hombros
            shoulder_width = np.sqrt((x11 - x12)**2 + (y11 - y12)**2)
            
            if self.frame_count % 60 == 0:
                 log(f"[DEBUG] Calculated Shoulder Width: {shoulder_width:.4f}")

            if shoulder_width < 0.001:
                return "NO_USER"
            
            # Umbrales basados en uso móvil real (celular en mano)
            # 0.10 = Muy lejos
            # 0.85 = Muy cerca (permitimos que casi ocupen toda la pantalla)
            
            if shoulder_width < 0.10:
                return "TOO_FAR"
            elif shoulder_width > 0.85:
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
