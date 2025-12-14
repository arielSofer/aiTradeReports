import sys
import os

# Add the project root to sys.path to allow importing from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from backend.app.main import app
except Exception as e:
    # If import fails, create a dummy app to display the error
    # This prevents FUNCTION_INVOCATION_FAILED on Vercel
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    import traceback
    
    app = FastAPI()
    
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    async def catch_all(path_name: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Startup Import Error",
                "detail": str(e),
                "traceback": traceback.format_exc().split("\n")
            }
        )

