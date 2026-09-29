from fastapi import FastAPI

app = FastAPI(
    title="iSmartRAG API",
    description="Backend API for iSmartRAG",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "iSmartRAG API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }