#!/usr/bin/env python3

import asyncio
import websockets
import json
import numpy as np

async def test_websocket():
    uri = "ws://localhost:8000/ws/predict"
    
    print("Conectando al servidor WebSocket...")
    
    async with websockets.connect(uri) as websocket:
        # Recibir confirmación de conexión
        response = await websocket.recv()
        print(f"Conectado: {response}")
        
        # Simular envío de landmarks (226 valores aleatorios)
        for i in range(10):
            # Generar landmarks de prueba
            # En producción, estos vendrían de MediaPipe
            fake_landmarks = np.random.rand(226).tolist()
            
            message = {
                "type": "landmarks",
                "data": fake_landmarks
            }
            
            print(f"Enviando landmarks #{i+1}...")
            await websocket.send(json.dumps(message))
            
            # Recibir predicción
            response = await websocket.recv()
            data = json.loads(response)
            
            if data.get('type') == 'prediction':
                word = data.get('word')
                confidence = data.get('confidence', 0)
                buffer_fill = data.get('buffer_fill', 0)
                status = data.get('status')
                
                print(f"Respuesta: {status}")
                print(f"   Palabra: {word}")
                print(f"   Confianza: {confidence:.2f}")
                print(f"   Buffer: {buffer_fill*100:.0f}%")
            else:
                print(f"Respuesta: {data}")
            
            # Esperar un poco entre envíos
            await asyncio.sleep(0.1)
        
        # Probar reset
        print("\n Enviando comando RESET...")
        await websocket.send(json.dumps({"type": "reset"}))
        response = await websocket.recv()
        print(f" Reset: {response}")
        
        # Cerrar conexión limpiamente
        print("\nCerrando conexión...")
        await websocket.send(json.dumps({"type": "close"}))

if __name__ == "__main__":
    try:
        asyncio.run(test_websocket())
        print("\n Test completado exitosamente!")
    except Exception as e:
        print(f"Error en el test: {e}")
