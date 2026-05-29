const crypto = require("crypto");

const secret = "tallulahtwentytwo"; // same as GITHUB_WEBHOOK_SECRET in .env

const payload = JSON.stringify({
    action: "closed",
    pull_request: {
        number: 2, // the PR number you opened on LENDING-PROTOCOL
        merged: true,
        merged_at: new Date().toISOString(),
        user: {
            login: "femiopebiyi", // the hunter's github username
        },
    },
    repository: {
        full_name: "femiopebiyi/LENDING-PROTOCOL",
    },
});

const sig = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

console.log("Signature:", `sha256=${sig}`);
console.log("\nSending webhook...\n");

fetch("http://localhost:3000/webhooks/github", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${sig}`,
        "X-Github-Event": "pull_request",
    },
    body: payload,
})
    .then((r) => r.text())
    .then((body) => console.log("Response:", body))
    .catch(console.error);