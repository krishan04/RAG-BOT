"""
Django settings for the RAG Bot monolith.

- Django: ORM, admin, auth, migrations (SQLite by default).
- FastAPI (fastapi_app): REST API for the RAG engine, mounted into the same
  ASGI process via config/asgi.py.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Repository root (one level above the backend package).
PROJECT_ROOT = BASE_DIR.parent

# Load API keys / secrets from the repo root .env file.
load_dotenv(PROJECT_ROOT / ".env")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "django-insecure-ro!wp96((nuqnsg*!i*xw9f!!dfszrm0+-xp5$hr!-8+3%2dyh"
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Monolith apps
    "core",
    "rag",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


####################################################################
#                        Monolith paths
####################################################################
# Directory for user-uploaded documents (before ingestion).
STORAGE_DIR = BASE_DIR / "storage"

# Root that holds Chroma vectorstore directories (shared with legacy app).
VECTOR_STORE_ROOT = PROJECT_ROOT / "data" / "vector_stores"

# Fixed corpus used by the benchmarking harness.
BENCHMARK_CORPUS_DIR = PROJECT_ROOT / "data" / "benchmark"

# Eval questions used by the benchmarking harness.
BENCHMARK_QUESTIONS = [
    "What does this project do in one sentence?",
    "Which components can be benchmarked?",
]

# Temporary directory used during document ingestion.
TMP_DIR = STORAGE_DIR / "tmp"

# API keys loaded from .env
API_KEYS = {
    "gemini": os.environ.get("GEMINI_API", ""),
    "google": os.environ.get("GEMINI_API", ""),
    "cohere": os.environ.get("COHERE_API", ""),
    "openai": os.environ.get("OPENAI_API", ""),
    "huggingface": os.environ.get("HF_API", ""),
}

# Origins allowed to call the FastAPI layer (React dev server).
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Path under which the Django admin is exposed (relative to the FastAPI root).
DJANGO_MOUNT_PREFIX = ""