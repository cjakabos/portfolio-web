FROM python:3.9-slim-buster

RUN apt-get update

COPY ./requirements.txt /requirements.txt
COPY ./config.json /config.json
COPY ./src /src
COPY ./customers /customers

RUN pip install --upgrade pip && pip install --no-cache-dir -r ./requirements.txt

WORKDIR /src
CMD [ "python3", "init_segmentationdb.py"]
CMD [ "python3", "app.py"]

ENV LISTEN_PORT 8600

EXPOSE 8600