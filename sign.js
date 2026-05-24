const { Keypair } = require("@solana/web3.js");
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const fs = require("fs");

const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("/home/opebiyi/bounty-board/packages/program/bounty-board/target/deploy/bounty_board-keypair.json")))
);

const message = "authentication\nWallet: 9465TkZiDW5jNnLrb1667TQPjnG6bpMY1PXrcCoDuAwa\nNonce: 92dc82dc3fdc527b69bf5af46c072da586af05fe4222d1f95d8be95fa12559dd\n\nSign this message to log in.";
const messageBytes = Buffer.from(message);
const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
console.log(bs58.default.encode(signature));