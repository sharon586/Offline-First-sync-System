from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, records, sync

app = FastAPI(
    title="Offline Sync System",
    description="Full-stack offline-first data synchronization system with conflict resolution",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(records.router, prefix="/api")
app.include_router(sync.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
