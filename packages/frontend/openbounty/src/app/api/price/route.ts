import { NextResponse } from "next/server";

export async function GET() {
    try {
        const res = await fetch("https://price.jup.ag/v6/price?ids=SOL", {
            next: { revalidate: 30 }, // cache for 30 seconds
        });

        if (!res.ok) throw new Error(`Jupiter returned ${res.status}`);

        const data = await res.json();
        const usd_per_sol = data?.data?.SOL?.price;

        if (!usd_per_sol) throw new Error("Price field missing");

        const lamports_per_dollar = Math.floor((1.0 / usd_per_sol) * 1_000_000_000);

        return NextResponse.json({ usd_per_sol, lamports_per_dollar });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}