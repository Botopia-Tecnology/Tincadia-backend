#!/usr/bin/env python3
"""
Evaluador para el Modelo-COL-NUM-WORD-1101-2
Permite probar el modelo en tiempo real con soporte para CONTEXTO.
"""
import os
import sys
import cv2
import numpy as np

# Agregar rutas para encontrar módulos del modelo
script_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(script_dir)
sys.path.insert(0, parent_dir)

try:
    from exacto_predictor_colnumword import ExactoPredictorCOLNUMWORD
    from lsc_streaming_exacto import LSCStreamingPredictor
except ImportError:
    print("❌ Error: No se encontraron los módulos del predictor en el directorio superior.")
    sys.exit(1)

class EvaluadorLSC:
    def __init__(self):
        print("🔧 Inicializando Predictor Exacto con soporte de Contexto...")
        
        # Rutas del modelo
        model_path = os.path.join(script_dir, "weights.hdf5")
        config_path = os.path.join(script_dir, "model_config.json")
        
        # Crear predictor base
        self.base_predictor = ExactoPredictorCOLNUMWORD(model_path, config_path)
        
        # Crear predictor de streaming (que ya tiene la lógica de contexto)
        self.streaming_predictor = LSCStreamingPredictor(
            base_predictor=self.base_predictor,
            buffer_size=1 # Para evaluación en tiempo real queremos respuesta rápida
        )
        
        print("✅ Evaluador listo.")
        
        # Disponibilizar contextos para el usuario
        self.contexts = {
            "0": None,
            "1": "Colores",
            "2": "Numeros",
            "3": "Letras",
            "4": "Saludos"
        }

    def seleccionar_contexto(self):
        print("\n--- SELECCIÓN DE CONTEXTO ---")
        print("0. Ninguno (Normal)")
        print("1. Colores (Boost: Verde, Azul, etc.)")
        print("2. Números (Boost: Uno, Dos, Tres, etc.)")
        print("3. Letras  (Boost: A, B, C, etc.)")
        print("4. Saludos (Boost: Hola, Gracias, etc.)")
        
        choice = input("\nSelecciona un contexto (0-4): ").strip()
        context_name = self.contexts.get(choice, None)
        self.streaming_predictor.set_context(context_name)
        return context_name

    def evaluar_camara(self):
        # Iniciar en modo automático por defecto
        print("\n" + "="*50)
        print(f"MODO CÁMARA EN VIVO - Inferencia Automática Activa")
        print("Presiona 'q' para salir.")
        print("Presiona 'r' para resetear buffer.")
        print("Presiona 'm' para menú de contexto manual.")
        print("="*50 + "\n")
        
        import mediapipe as mp
        mp_holistic = mp.solutions.holistic
        holistic = mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5)
        
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("[ERROR] No se pudo acceder a la cámara.")
            return

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            # Procesamiento básico para MediaPipe
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = holistic.process(image)
            
            # Lógica de espejo
            if results.right_hand_landmarks and not results.left_hand_landmarks:
                frame = cv2.flip(frame, 1)
                image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = holistic.process(image)

            # Extraer coordenadas
            coords = self._extract_coords(results)
            
            # Predicción con el streaming predictor (incluye el boost de contexto automático)
            res = self.streaming_predictor.add_landmarks(coords)
            
            # Dibujar UI
            self._draw_ui(frame, res, self.streaming_predictor.current_context)
            
            cv2.imshow('Evaluador LSC con Contexto Auto', frame)
            
            key = cv2.waitKey(10) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('r'):
                self.streaming_predictor.reset_buffer()
                print("🔄 Buffer reseteado")
            elif key == ord('m'):
                self.seleccionar_contexto()
        
        cap.release()
        cv2.destroyAllWindows()

    def _extract_coords(self, results):
        if results.pose_landmarks:
            pose = np.array([[lm.x, lm.y, lm.z, lm.visibility] for lm in results.pose_landmarks.landmark[:25]]).flatten()
        else:
            pose = np.zeros(100)
        rh = np.array([[lm.x, lm.y, lm.z] for lm in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(63)
        lh = np.array([[lm.x, lm.y, lm.z] for lm in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(63)
        return np.concatenate([pose, rh, lh])

    def _draw_ui(self, frame, res, context_name):
        # Barra superior
        cv2.rectangle(frame, (0,0), (frame.shape[1], 80), (45, 45, 45), -1)
        
        ctx_text = f"Contexto: {context_name or 'Normal'}"
        cv2.putText(frame, ctx_text, (frame.shape[1]-200, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

        if res and res.get('word'):
            word = res['word']
            conf = res['confidence']
            status = res['status']
            
            color = (0, 255, 0) if status == 'predicting' else (0, 255, 255)
            
            cv2.putText(frame, f"SENA: {word.upper()}", (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
            cv2.putText(frame, f"Confianza: {conf:.1%}", (20, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        else:
            cv2.putText(frame, "Esperando seña...", (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 1, (150, 150, 150), 2)

def main():
    evaluador = EvaluadorLSC()
    evaluador.evaluar_camara()

if __name__ == "__main__":
    main()
