FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY requirements.txt ./
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

COPY . .

ENV NODE_ENV=production
ENV PYTHON_BIN=python3
ENV TRANSCRIBE_PYTHON=python3
ENV TRANSCRIBE_CACHE_DIR=/app/.hf_transcribe
ENV PORT=10000

EXPOSE 10000

CMD ["npm", "start"]
