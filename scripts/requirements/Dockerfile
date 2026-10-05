FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1
COPY scripts/requirements/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
WORKDIR /workspace
