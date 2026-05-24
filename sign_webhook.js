const crypto = require("crypto");

const secret = "tallulahtwentytwo"; // paste your GITHUB_WEBHOOK_SECRET value
const body = JSON.stringify({
    action: "closed",
    pull_request: {
        number: 2,
        merged: true,
        merged_at: "2026-05-24T10:00:00Z",
        user: { login: "femiopebiyi" }
    },
    repository: { full_name: "femiopebiyi/LENDING-PROTOCOL" }
});

const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
console.log("Signature:", sig);
console.log("Body:", body);