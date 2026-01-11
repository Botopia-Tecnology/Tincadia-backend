"""
Módulo principal para compatibilidad con uvicorn
"""
from .main import app

# Exportar para que uvicorn pueda encontrar main:app
__all__ = ['app']
