const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("/home/opebiyi/.config/solana/id.json")))
);

const wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);

const idl = JSON.parse(
    fs.readFileSync("packages/program/bounty-board/target/idl/bounty_board.json")
);

const programId = new PublicKey("GmfiX2zNev72AQSK9Lygrmg6yN135Y95Gj3evz3kQhWM");
const program = new anchor.Program(idl, provider);

async function main() {
    const bountyId = new anchor.BN(4);
    const lamports = new anchor.BN(100_000_000); // 0.1 SOL
    const expiryDate = new anchor.BN(1779824576);
    const posterKey = keypair.publicKey;

    console.log("Poster:", posterKey.toString());

    const idBuffer = Buffer.alloc(8);
    idBuffer.writeBigUInt64LE(BigInt(4));

    const [bountyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bounty"), posterKey.toBuffer(), idBuffer],
        programId
    );

    const accountInfo = await connection.getAccountInfo(bountyPda);
    console.log("Current account size:", accountInfo?.data.length);

    console.log("Bounty PDA:", bountyPda.toString());

    const tx = await program.methods
        .postBountyTest(bountyId, lamports, expiryDate)
        .accounts({
            poster: posterKey,
            bounty: bountyPda,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

    console.log("Transaction:", tx);
    console.log("Bounty initialized successfully");
}

main().catch(console.error);