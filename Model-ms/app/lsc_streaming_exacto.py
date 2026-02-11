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
        self.prediction_buffer = deque(maxlen=6)  # Reducido de 10 a 6 para capturar señas rápidas
        
        # Estado
        self.frame_count = 0
        self.no_user_count = 0 # Contador para auto-reset
        self.last_prediction = None
        self.last_accepted_word = None # Nuevo: Contexto de palabra aceptada
        
        # Tracking de Movimiento (Para distinguir señas estáticas de dinámicas)
        self.last_wrist_pos = None  # (x, y) de la muñeca
        self.motion_velocity = 0.0
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
        # Log de entrada SIEMPRE
        print(f"[ADD_LANDMARKS-START] Llamada recibida. Shape: {landmarks.shape if hasattr(landmarks, 'shape') else 'NO SHAPE'}")
        
        # Validación básica de forma
        if landmarks.shape[0] != 226:
            print(f"❌ [ADD_LANDMARKS-ERROR] Invalid landmarks shape: {landmarks.shape}. Expected (226,)")
            return {
                'status': 'error', 'word': None, 'confidence': 0,
                'message': f'Invalid landmarks shape: {landmarks.shape}'
            }
        
        try:
            # --- ESTRATEGIA DE DOBLE PREDICCIÓN (Robustez ante espejado / mobile) ---
            # 1. Copiar y Flip X
            landmarks_mirror = landmarks.copy()
            landmarks_mirror[0:100:4] = 1.0 - landmarks_mirror[0:100:4] # Pose X
            landmarks_mirror[100:226:3] = 1.0 - landmarks_mirror[100:226:3] # Hands X
            
            # 2. SWAP Pose Left/Right (Pares: 1-4, 2-5, 3-6, 7-8, 9-10, 11-12, 13-14, 15-16, 17-18, 19-20, 21-22, 23-24)
            for p1, p2 in [(1,4), (2,5), (3,6), (7,8), (9,10), (11,12), (13,14), (15,16), (17,18), (19,20), (21,22), (23,24)]:
                idx1, idx2 = p1*4, p2*4
                temp = landmarks_mirror[idx1:idx1+4].copy()
                landmarks_mirror[idx1:idx1+4] = landmarks_mirror[idx2:idx2+4]
                landmarks_mirror[idx2:idx2+4] = temp
                
            # 3. SWAP Hands (Modelo-ms: 100-162 es Derecha, 163-225 es Izquierda)
            rh_part = landmarks_mirror[100:163].copy()
            landmarks_mirror[100:163] = landmarks_mirror[163:226]
            landmarks_mirror[163:226] = rh_part
            
            # Predecir en ambas orientaciones y elegir la mejor
            res_orig = self.exacto_predictor.predict_from_coords(landmarks.tolist(), include_probabilities=True)
            res_mirr = self.exacto_predictor.predict_from_coords(landmarks_mirror.tolist(), include_probabilities=True)
            
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

            # --- PROCESAMIENTO GENERAL ---
            distance_alert = self._check_distance(landmarks)
            buffer_fill = len(self.landmarks_buffer) / self.buffer_size
            self.landmarks_buffer.append(landmarks)
            
            if distance_alert in ["NO_USER", "TOO_FAR"]:
                self.no_user_count += 1
            else:
                self.no_user_count = 0
                
            if self.no_user_count > 5:
                if len(self.prediction_buffer) > 0:
                    log("🧹 [Auto-Reset] Limpiando buffer por silencio")
                    self.prediction_buffer.clear()
                self.last_wrist_pos = None
                return {
                    'status': 'waiting', 'word': None, 'confidence': 0,
                    'buffer_fill': buffer_fill, 'distance_alert': distance_alert
                }

            # --- HEURÍSTICA DE MOVIMIENTO ---
            # Wrist Pose original index: 15 (Left) o 16 (Right)
            # 15*4 = 60, 16*4 = 64. Usaremos el promedio o el brazo más activo.
            curr_wrist = (landmarks[60], landmarks[61]) # Wrist X, Y
            if self.last_wrist_pos:
                dist = np.sqrt((curr_wrist[0]-self.last_wrist_pos[0])**2 + (curr_wrist[1]-self.last_wrist_pos[1])**2)
                # Filtro de suavizado para la velocidad (EMA)
                self.motion_velocity = self.motion_velocity * 0.7 + dist * 0.3
            self.last_wrist_pos = curr_wrist

            self.frame_count += 1
            
            if self.context_aware_enabled and self.frame_count % 30 == 0:
                self._refresh_llm_cache()

            if result['status'] != 'ok':
                return {'status': 'error', 'word': None, 'confidence': 0, 'buffer_fill': buffer_fill}

            # Lógica de Smoothing y Confianza
            if self.context_aware_enabled:
                raw_probs = np.array(result['probabilities'])
                original_idx = np.argmax(raw_probs)
                base_confidence = raw_probs[original_idx]
                
                boosted_probs = self._apply_llm_boost(raw_probs)
                boosted_probs = self._apply_context_boost(boosted_probs)
                boosted_probs = boosted_probs / (np.sum(boosted_probs) + 1e-9)
                
                predicted_idx = np.argmax(boosted_probs)
                confidence = boosted_probs[predicted_idx]
                
                if base_confidence < 0.15:
                    predicted_idx = original_idx
                    confidence = base_confidence

                predicted_word = self.exacto_predictor.config["classes"].get(str(predicted_idx), f"Clase_{predicted_idx}")
            else:
                confidence = result['confidence']
                predicted_word = result['word']
            
            # Lógica de buffer para suavizado
            if confidence >= 0.4:
                self.prediction_buffer.append(predicted_word)
            else:
                self.prediction_buffer.append(None)

            status = 'predicting' if any(p is not None for p in self.prediction_buffer) else ('processing' if buffer_fill > 0.05 else 'uncertain')
            
            # Log de confianza cada 10 frames para feedback visual en logs
            if self.frame_count % 10 == 0:
                win_text = predicted_word if confidence >= 0.4 else "None"
                mot_text = "DYNAMIC" if self.motion_velocity > 0.02 else "STATIC"
                log(f"[Stream-Log] Top: {predicted_word} ({confidence:.2f}) | {mot_text} (v:{self.motion_velocity:.3f}) | buf: {len(self.prediction_buffer)}")

            final_word = None
            
            # REGLA DE DINAMISMO 1: Si la confianza es muy alta (>0.8), ganar inmediatamente
            if confidence >= 0.8:
                final_word = predicted_word
                # log(f"🚀 [INSTANT-WORD] {final_word} (conf: {confidence:.2f})")
            
            # REGLA DE DINAMISMO 2: Votación rápida en buffer corto
            elif len(self.prediction_buffer) >= 3:
                valid_preds = [p for p in self.prediction_buffer if p is not None]
                if valid_preds:
                    counts = Counter(valid_preds)
                    most_common = counts.most_common(1)[0]
                    # Requiere 50% de coincidencia en el buffer reducido
                    if most_common[1] >= len(self.prediction_buffer) * 0.5:
                        final_word = most_common[0]
            
            # Recalcular status final si hay palabra
            if final_word:
                 status = 'predicting'
                 if confidence >= 0.8:
                     log(f"[FINAL-WORD] {final_word} (INSTANT - conf: {confidence:.2f})")
                 else:
                     log(f"[FINAL-WORD] {final_word} (votos: {most_common[1]}/{len(self.prediction_buffer)})")

            return {
                'status': status, 'word': final_word, 'confidence': confidence,
                'buffer_fill': buffer_fill, 'current_context': self.current_context,
                'last_accepted_word': self.last_accepted_word, 'context_changed': False,
                'distance_alert': distance_alert
            }
            
        except Exception as e:
            import traceback
            print(f"💥 [ADD_LANDMARKS-ERROR] {e}")
            traceback.print_exc()
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
