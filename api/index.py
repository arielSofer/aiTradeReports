import sys
import os
import json
import traceback

# Add the project root to sys.path to allow importing from backend
# Assuming file is at /var/task/api/index.py -> root is /var/task
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def raw_error_app(scope, receive, send):
    """Raw ASGI app to serve error when dependencies fail"""
    if scope['type'] != 'http':
        return
        
    error_data = {
        "error": "Critical Startup Error",
        "detail": "Failed to import application or dependencies",
        "traceback": traceback.format_exc().split("\n"),
        "sys_path": sys.path,
        "cwd": os.getcwd(),
        "files_in_root": os.listdir(os.getcwd()) if os.path.exists(os.getcwd()) else []
    }
    
    response_body = json.dumps(error_data, indent=2).encode('utf-8')
    
    await send({
        'type': 'http.response.start',
        'status': 500,
        'headers': [
            (b'content-type', b'application/json'),
            (b'content-length', str(len(response_body)).encode('utf-8')),
            (b'access-control-allow-origin', b'*'),
        ],
    })
    await send({
        'type': 'http.response.body',
        'body': response_body,
    })

try:
    from backend.app.main import app
except Exception:
    # Fallback to raw ASGI app if ANY import fails
    app = raw_error_app

