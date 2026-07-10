FROM python:3.11-alpine

# Build deps for any wheels that need compiling (kept slim).
RUN apk add --no-cache tzdata

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY fetch_monarch.py .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Shared with the `app` service — see docker-compose.yml's ./data bind mount.
VOLUME ["/data"]

ENTRYPOINT ["/app/entrypoint.sh"]
