// test-server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3002;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "3d-test.html"));
});

app.get("/3d-test.html", (req, res) => {
    res.sendFile(path.join(__dirname, "3d-test.html"));
});

// Ensure logs directory exists
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

function logRequest(req, targetUrl) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        targetUrl: targetUrl,
        headers: req.headers,
        body: req.body,
        query: req.query
    };

    fs.appendFileSync(
        path.join(logDir, "requests.log"),
        JSON.stringify(logEntry, null, 2) + "\n\n"
    );

    console.log("\n=== REQUEST ===");
    console.log("Time:", logEntry.timestamp);
    console.log("Method:", req.method);
    console.log("URL:", targetUrl);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("==============\n");
}

function logResponse(response, data) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: data
    };

    fs.appendFileSync(
        path.join(logDir, "responses.log"),
        JSON.stringify(logEntry, null, 2) + "\n\n"
    );

    console.log("\n=== RESPONSE ===");
    console.log("Time:", logEntry.timestamp);
    console.log("Status:", response.status);
    console.log("Headers:", JSON.stringify(logEntry.headers, null, 2));
    console.log("Body:", data);
    console.log("===============\n");
}

// Proxy all requests
app.use("/paymentmanagement/rest/*", async (req, res) => {
    const targetPath = req.path;
    const targetUrl = `https://omccstb.turkcell.com.tr${targetPath}`;
    
    // Log the request
    logRequest(req, targetUrl);

    try {
        // Forward the request
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                ...req.headers,
                "host": "omccstb.turkcell.com.tr"
            },
            body: Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : undefined
        });

        const data = await response.text();
        
        // Log the response
        logResponse(response, data);

        // Forward the response
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });
        res.status(response.status).send(data);

    } catch (error) {
        console.error("Proxy error:", error);
        const errorLog = {
            timestamp: new Date().toISOString(),
            targetUrl: targetUrl,
            error: error.message,
            stack: error.stack
        };
        
        fs.appendFileSync(
            path.join(logDir, "errors.log"),
            JSON.stringify(errorLog, null, 2) + "\n\n"
        );
        
        res.status(500).json({ error: "Proxy request failed", details: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Test server running at http://localhost:${port}`);
});
