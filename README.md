

# 🔍LogOracle — GenAI-Powered Predictive Failure Intelligence for Real-Time System Monitoring

An AI-powered full-stack log analysis tool that **detects issues, predicts failures, and explains system problems in simple language**.

Built for developers, DevOps engineers, and students to understand complex logs without digging through thousands of lines manually.

---

## 🚀 Features

### 🧠 AI-Powered Analysis

* Uses **Groq (LLaMA 3.3 70B)** for intelligent log understanding
* Converts raw logs into **human-readable insights**
* Generates:

  * Severity (HIGH / MEDIUM / LOW)
  * Risk score (1–10)
  * Clear explanations + fixes

### 🔮 Failure Prediction System

* Predicts **system failure probability (0–97%)**
* Estimates **time window** (e.g., next 5–10 minutes)
* Provides **confidence level + root signals**

### ⚙️ Rule-Based Engine

* Detects critical conditions like:

  * CPU / Memory spikes
  * Disk issues
  * Server crashes
  * Database failures
* Works even **without AI**

### 📊 Pattern Detection

* Finds repeated errors
* Identifies **failure trends**
* Warns about **imminent crashes**

### 🌐 Multi-Domain Intelligence

Supports:

* 🔗 Microservices / Distributed Systems
* 🌐 Web Servers (Nginx / Apache / Node)
* ☁️ Cloud Infrastructure (AWS / Azure / GCP)

### 🧩 Smart Domain Detection

* Automatically detects log type
* Warns if wrong domain is selected
* One-click **Auto Fix**

### 📈 Visual Dashboard

* Risk score & severity banner
* Issue & warning breakdown
* AI prediction card with probability bar
* Real-time analysis timer

### 📁 Report Generation

* Download full analysis report as `.txt`

### 🗂️ History Tracking

* Stores last 50 analyses in `history.json`

---

## 🛠️ Tech Stack

**Frontend**

* HTML, CSS, JavaScript (Vanilla)
* Interactive UI with dynamic rendering

**Backend**

* Node.js + Express
* REST API architecture

**AI Integration**

* Groq API (LLaMA 3.3 70B)

**Storage**

* File-based storage (`history.json`)

---

## 📂 Project Structure

```
AI-Log-Analyzer/
│
├── index.html        # Frontend UI
├── server.js         # Backend server
├── history.json      # Stored analysis history
├── .env              # API keys
└── README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the repository

```bash
git clone https://github.com/your-username/AI-Log-Analyzer.git
cd AI-Log-Analyzer
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Add environment variables

Create a `.env` file:

```
GROQ_API_KEY=your_api_key_here
```

### 4️⃣ Run the server

```bash
node server.js
```

### 5️⃣ Open frontend

Just open `index.html` in your browser

---

## 📡 API Endpoint

### POST `/analyze`

Analyze logs using AI + rule engine

**Request Body**

```json
{
  "logs": "your logs here",
  "domain": "microservices | webserver | cloud"
}
```

**Response**

```json
{
  "analysis": { ... },
  "ruleBasedAlerts": [],
  "failurePredictions": []
}
```

---

## 📸 Example Input

```
CRITICAL: Database connection failed
ERROR: Server crashed
WARNING: CPU usage at 95%
```

---

## 📊 Example Output

* 🔴 Severity: HIGH
* 📈 Risk Score: 8.5/10
* 🔮 Failure Probability: 85% (next 5–10 minutes)
* ⚠️ Issues: Database failure, server crash
* 💡 Fix: Restart services, scale resources


