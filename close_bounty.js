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
    const posterKey = keypair.publicKey;

    const idBuffer = Buffer.alloc(8);
    idBuffer.writeBigUInt64LE(BigInt(4));

    const [bountyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bounty"), posterKey.toBuffer(), idBuffer],
        programId
    );

    console.log("Closing bounty PDA:", bountyPda.toString());

    const tx = await program.methods
        .closeBountyTest(bountyId)
        .accounts({
            poster: posterKey,
            bounty: bountyPda,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

    console.log("Closed. Tx:", tx);
}

main().catch(console.error);