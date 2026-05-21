const { Connection, Keypair, PublicKey, SystemProgram, Transaction } = require("@solana/web3.js");
const fs = require("fs");

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("/home/opebiyi/.config/solana/id.json")))
);

async function main() {
    const bountyId = BigInt(4);
    const programId = new PublicKey("GmfiX2zNev72AQSK9Lygrmg6yN135Y95Gj3evz3kQhWM");
    const posterKey = new PublicKey("9465TkZiDW5jNnLrb1667TQPjnG6bpMY1PXrcCoDuAwa");

    const idBuffer = Buffer.alloc(8);
    idBuffer.writeBigUInt64LE(bountyId);

    const [bountyPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("bounty"), posterKey.toBuffer(), idBuffer],
        programId
    );

    console.log("Bounty PDA:", bountyPda.toString());
    console.log("Bump:", bump);

    const balance = await connection.getBalance(bountyPda);
    console.log("PDA balance:", balance);
}

main().catch(console.error);