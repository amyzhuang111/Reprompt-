import { NextRequest, NextResponse } from "next/server";
import { rewrite } from "@/lib/rewriter";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, num_variants = 8 } = body;
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });
  try {
    const result = await rewrite(query, num_variants);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
