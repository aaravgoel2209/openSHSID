FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir flask flask-cors torch llama-cpp-python

COPY model/ ./model/

WORKDIR /app/model
ENV PYTHONPATH=/app
EXPOSE 5000
CMD ["python", "-m", "flask", "run", "--port", "5000", "--host", "0.0.0.0"]
