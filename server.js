const express = require("express");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const HISTORY_FILE = "history.json";
if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

// RULE BASED LOGIC
function applyRules(logs) {
    const rules = [];
    const lines = logs.split("\n");

    lines.forEach(line => {
        const upper = line.toUpperCase();

        const cpuMatch = line.match(/CPU[^\d]*(\d+)/i);
        if (cpuMatch) {
            const cpu = parseInt(cpuMatch[1]);
            if (cpu > 90) rules.push({ type: "CRITICAL", message: `CPU at ${cpu}% - Critically High!`, risk_score: 9.5 });
            else if (cpu > 80) rules.push({ type: "WARNING", message: `CPU at ${cpu}% - Getting High`, risk_score: 7.0 });
        }

        const memMatch = line.match(/memory[^\d]*(\d+)/i);
        if (memMatch) {
            const mem = parseInt(memMatch[1]);
            if (mem > 90) rules.push({ type: "CRITICAL", message: `Memory at ${mem}% - Critically High!`, risk_score: 9.0 });
            else if (mem > 80) rules.push({ type: "WARNING", message: `Memory at ${mem}% - Getting High`, risk_score: 6.5 });
        }

        const diskMatch = line.match(/disk[^\d]*(\d+)/i);
        if (diskMatch) {
            const disk = parseInt(diskMatch[1]);
            if (disk < 10) rules.push({ type: "CRITICAL", message: `Disk space only ${disk}% remaining!`, risk_score: 8.5 });
        }

        if (upper.includes("DATABASE CONNECTION FAILED")) rules.push({ type: "CRITICAL", message: "Database is completely down!", risk_score: 10 });

        if (upper.includes("SERVER CRASHED")) rules.push({ type: "CRITICAL", message: "Server has crashed!", risk_score: 10 });
        if (upper.includes("OUT OF MEMORY")) rules.push({ type: "CRITICAL", message: "System ran out of memory!", risk_score: 9.5 });

        if (upper.includes("AUTHENTICATION FAILED")) rules.push({ type: "WARNING", message: "Someone failed to login - possible security risk!", risk_score: 7.0 });
        if (upper.includes("SSL")) rules.push({ type: "WARNING", message: "SSL certificate issue detected!", risk_score: 6.5 });
        
        if (upper.includes("TIMEOUT")) rules.push({ type: "WARNING", message: "System is timing out - too slow!", risk_score: 6.0 });
    });

    return rules;
}

// FAILURE PREDICTION
function predictFailures(logs) {
    const lines = logs.split("\n").filter(l => l.trim() !== "");
    const predictions = [];

    const errorCounts = {};
    lines.forEach(line => {
        const upper = line.toUpperCase();
        if (upper.includes("ERROR") || upper.includes("CRITICAL")) {
            errorCounts[line] = (errorCounts[line] || 0) + 1;
        }
    });

    Object.entries(errorCounts).forEach(([error, count]) => {
        if (count >= 2) {
            predictions.push({
                pattern: error,
                occurrences: count,
                prediction: `This error appeared ${count} times - system likely to fail soon!`,
                risk_level: count >= 3 ? "CRITICAL" : "HIGH"
            });
        }
    });

    const criticalCount = lines.filter(l => l.toUpperCase().includes("CRITICAL")).length;
    const totalCount = lines.length;
    const criticalRatio = criticalCount / totalCount;

    if (criticalRatio > 0.5) {
        predictions.push({
            pattern: "High critical ratio",
            occurrences: criticalCount,
            prediction: `${Math.round(criticalRatio * 100)}% of logs are critical - system failure is imminent!`,
            risk_level: "CRITICAL"
        });
    }

    return predictions;
}

// DOMAIN CONTEXT — what kind of expert Groq should be
function getDomainContext(domain) {
    const contexts = {
        microservices: "distributed microservices and cloud-native architectures. You understand service meshes, inter-service communication, cascade failures, and distributed tracing",
        webserver: "web server infrastructure including Nginx, Apache, and Node.js. You understand HTTP errors, traffic spikes, SSL issues, and request timeouts",
        cloud: "cloud infrastructure including AWS, Azure, and GCP. You understand auto-scaling, cloud service outages, network latency, and resource quota limits"
    };
    return contexts[domain] || contexts.microservices;
}

// DOMAIN RULES — extra instructions for Groq based on selected domain
function getDomainRules(domain) {
    const rules = {
        microservices: `Domain-Specific Rules (Microservices / Distributed Systems):
- Identify WHICH service is failing (auth-service, db-service, payment-service, api-gateway etc.)
- Detect cascade failures: if service A failed, explain how it caused service B to fail
- In your summary, describe the failure cascade path like: "auth-service failed → triggered db-service overload → caused payment-service crash"
- Suggestions must be service-specific: "Restart the auth-service pod", "Scale up db-service replicas", "Check api-gateway circuit breaker"
- In signals, mention specific service names found in the logs`,

        webserver: `Domain-Specific Rules (Web Server):
- Focus on HTTP status codes, response times, and traffic patterns
- Identify if issues are traffic-related (sudden spike) or server-related (process crash)
- In your summary, describe whether it's a traffic issue or a configuration issue
- Suggestions must be server-specific: "Increase worker_processes in nginx.conf", "Enable rate limiting on the load balancer"
- In signals, mention specific endpoints, status codes, or response times from the logs`,

        cloud: `Domain-Specific Rules (Cloud Infrastructure):
- Focus on cloud resource limits, auto-scaling events, and service availability zones
- Identify if issues are quota-related, network-related, or regional outages
- In your summary, mention which cloud service or region is affected
- Suggestions must reference cloud actions: "Increase EC2 instance type", "Check AWS CloudWatch for service health", "Enable cross-region failover"
- In signals, mention specific cloud services, instance IDs, or regions found in the logs`
    };
    return rules[domain] || rules.microservices;
}

// SAVE HISTORY
function saveHistory(logs, analysis, ruleResults, domain) {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE));
    history.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        domain: domain,
        totalLogs: logs.split("\n").length,
        severity: analysis.severity,
        overall_risk_score: analysis.overall_risk_score,
        ruleAlerts: ruleResults.length,
        logs: logs,
        analysis: analysis
    });
    if (history.length > 50) history.shift();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ANALYZE ROUTE
app.post("/analyze", async (req, res) => {
    const logs   = req.body.logs;
    const domain = req.body.domain || "microservices";

    if (!logs) {
        return res.status(400).json({
            status: 400,
            error: "No logs provided"
        });
    }

    const ruleResults = applyRules(logs);
    const predictions = predictFailures(logs);

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "user",
                        content: `You are an expert system reliability engineer specializing in ${getDomainContext(domain)}. Analyze these logs and respond ONLY in this exact JSON format, nothing else:
{
  "severity": "HIGH or MEDIUM or LOW",
  "issues": [
    {
      "issue": "issue name here",
      "risk_score": 8.5,
      "explanation": "simple explanation here",
      "suggestion": "simple fix here"
    }
  ],
  "warnings": [
    {
      "warning": "warning name here",
      "risk_score": 5.0,
      "explanation": "simple explanation here",
      "suggestion": "simple fix here"
    }
  ],
  "overall_risk_score": 7.5,
  "summary": "overall summary in simple words",
  "failure_prediction": {
    "probability": 78,
    "time_window": "next 10-15 minutes",
    "confidence": "HIGH or MEDIUM or LOW",
    "signals": [
      "signal 1 that caused this prediction",
      "signal 2 that caused this prediction",
      "signal 3 that caused this prediction"
    ]
  }
}

${getDomainRules(domain)}

Rules for analysis:
- risk_score is between 1 to 10
- severity is HIGH if overall_risk_score > 7, MEDIUM if > 4, LOW if below 4
- Use simple everyday language
- Return ONLY the JSON, no extra text

Rules for failure_prediction:
- probability is a number from 0 to 97 (never use 100)
- Calculate probability using these rules:
  * Start at 20%
  * Single critical error: add 20%
  * Same error repeated 3+ times: add 25%
  * Multiple different critical errors: add 15%
  * CPU or Memory above 90%: add 15% each
  * Both CPU and Memory critical together: add extra 10%
  * High warning count (5+): add 10%
  * Cap at 97%
- time_window based on probability:
  * Above 80%: "next 5-10 minutes"
  * 60-80%: "next 10-30 minutes"
  * 40-60%: "next 1-2 hours"
  * Below 40%: "no immediate risk"
- confidence:
  * HIGH if you see clear repeated patterns
  * MEDIUM if mixed signals
  * LOW if only minor warnings
- signals: list exactly 3 specific things from the logs that caused this prediction, be specific with numbers (e.g. "Database failed 5 times in 2 minutes")

Logs to analyze:
${logs}`
                    }
                ]
            })
        });

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            return res.status(500).json({
                status: 500,
                error: "No response from Groq",
                details: data
            });
        }

        const rawText = data.choices[0].message.content;
        console.log("RAW AI RESPONSE:", rawText);

        let analysis;
        try {
            const clean = rawText.replace(/```json|```/g, "").trim();
            analysis = JSON.parse(clean);
        } catch (e) {
            return res.status(500).json({
                status: 500,
                error: "AI response was not valid JSON",
                raw: rawText
            });
        }

        saveHistory(logs, analysis, ruleResults, domain);

        res.status(200).json({
            status: 200,
            message: "Logs analyzed successfully",
            domain: domain,
            totalLogs: logs.split("\n").length,
            ruleBasedAlerts: ruleResults,
            failurePredictions: predictions,
            analysis: analysis
        });

    } catch (error) {
        res.status(500).json({
            status: 500,
            error: error.message
        });
    }
});

// HISTORY ROUTE
app.get("/history", (req, res) => {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE));
    res.status(200).json({
        status: 200,
        totalRecords: history.length,
        history: history
    });
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});