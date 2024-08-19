import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { SolanaTracker } from "solana-swap";
import { performSwap, SOL_ADDR } from "./lib.js";
import base58 from "bs58";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const PRIVKEY = ""; // המפתח הפרטי בפורמט base58
const TOKEN_ADDR = ""; // כתובת המטבע

const SOL_BUY_AMOUNT = 0.011;
const FEES = 0.0005;
const SLIPPAGE = 20;

// פונקציית החלפה
async function swap(
    tokenIn,
    tokenOut,
    solanaTracker,
    keypair,
    connection,
    amount,
) {
    try {
        const swapResponse = await solanaTracker.getSwapInstructions(
            tokenIn,
            tokenOut,
            amount,
            SLIPPAGE,
            keypair.publicKey.toBase58(),
            FEES,
            false,
        );

        console.log("שליחת טרנזקציית swap...");

        const tx = await performSwap(
            swapResponse,
            keypair,
            connection,
            amount,
            tokenIn,
            {
                sendOptions: { skipPreflight: true },
                confirmationRetries: 30,
                confirmationRetryTimeout: 1000,
            },
        );

        console.log("החלפה נשלחה : " + tx);
    } catch (e) {
        console.error("שגיאה בזמן ניסיון לבצע החלפה:", e);
    }
}

// פונקציה לקבלת יתרת המטבעות
async function getTokenBalance(connection, owner, tokenAddr) {
    try {
        const result = await connection.getTokenAccountsByOwner(owner, {
            mint: new PublicKey(tokenAddr),
        });
        const info = await connection.getTokenAccountBalance(
            result.value[0].pubkey,
        );
        return info.value.uiAmount || 0;
    } catch (e) {
        console.error("שגיאה בקבלת יתרת המטבעות:", e);
        return 0;
    }
}

// פונקציה ראשית להרצת התוכנית
async function main() {
    const keypair = Keypair.fromSecretKey(base58.decode(PRIVKEY));
    const solanaTracker = new SolanaTracker(keypair, RPC_URL);
    const connection = new Connection(RPC_URL);

    while (true) {
        try {
            // ביצוע קנייה
            await swap(
                SOL_ADDR,
                TOKEN_ADDR,
                solanaTracker,
                keypair,
                connection,
                SOL_BUY_AMOUNT,
            );

            // המתנה של 30 שניות
            await new Promise((r) => setTimeout(r, 30000));

            // בדיקת יתרת המטבע
            const balance = Math.round(
                await getTokenBalance(
                    connection,
                    keypair.publicKey,
                    TOKEN_ADDR,
                ),
            );

            // מכירה
            if (balance > 0) {
                await swap(
                    TOKEN_ADDR,
                    SOL_ADDR,
                    solanaTracker,
                    keypair,
                    connection,
                    balance,
                );
            }

            // המתנה נוספת של 30 שניות לפני סבב נוסף
            await new Promise((r) => setTimeout(r, 30000));
        } catch (e) {
            console.error("שגיאה במהלך הסחר:", e);
        }
    }
}

main();
