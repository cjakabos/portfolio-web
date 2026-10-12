FROM node:20-slim
# The standard-library recorder binds native runner results to application and
# configuration digests. Python does not execute frontend tests.
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1
