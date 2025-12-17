import sys
import os
import json
import traceback

# Add the project root to sys.path to allow importing from backend
# Assuming file is at /var/task/api/index.py -> root is /var/task
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# Global variable to store import error
startup_error = None
startup_traceback = None

try:
    # First try to check if fastapi is even installed
    try:
        import fastapi
    except ImportError:
        startup_error = "FastAPI module not found. Check requirements.txt installation."
        startup_traceback = traceback.format_exc().split("\n")
        raise

    from backend.app.main import app
except Exception:
    # Capture the error context IMMEDIATELY
    startup_error = "Import Error"
    startup_traceback = traceback.format_exc().split("\n")
    
    async def raw_error_app(scope, receive, send):
        """Raw ASGI app to serve error when dependencies fail"""
        if scope['type'] != 'http':
            return
            
        # Check specifically for src directory
        src_exists = os.path.exists("src")
        src_contents = []
        if src_exists:
            for root, dirs, files in os.walk("src"):
                for file in files:
                    src_contents.append(os.path.join(root, file))

        error_data = {
            "error": startup_error,
            "detail": "Failed to import application or dependencies",
            "traceback": startup_traceback,
            "sys_path": sys.path,
            "cwd": os.getcwd(),
            "files_in_root": os.listdir(os.getcwd()) if os.path.exists(os.getcwd()) else [],
            "backend_files": [],
            "src_exists": src_exists,
            "src_files": src_contents[:50]  # limit output
        }
        
        # Try to list backend files to debug structure
        try:
            if os.path.exists("backend"):
                for root, dirs, files in os.walk("backend"):
                    for file in files:
                        error_data["backend_files"].append(os.path.join(root, file))
        except:
            pass
        
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
        
    app = raw_error_app

