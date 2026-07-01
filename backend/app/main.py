import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

from app.routers import incidents, exercises, di, correlations, admin

app = FastAPI(title="Threshold API", version="0.9.0", description="Geopolitical Escalation Index")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(incidents.router,    prefix="/api/incidents",    tags=["incidents"])
app.include_router(exercises.router,    prefix="/api/exercises",    tags=["exercises"])
app.include_router(di.router,           prefix="/api/di",           tags=["ei"])
app.include_router(correlations.router, prefix="/api/correlations", tags=["correlations"])
app.include_router(admin.router,        prefix="/api/admin",        tags=["admin"])

@app.on_event("startup")
async def startup():
    # Scheduler disabled — scraping handled by GitHub Actions
    logger.info("Threshold v0.9.0 started — scraping via GitHub Actions")

@app.get("/")
def root(): return {"status":"ok","project":"Threshold","version":"0.9.0"}

@app.get("/health")
def health(): return {"status":"healthy","version":"0.9.0"}
