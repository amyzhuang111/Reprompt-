import { NextResponse } from "next/server";
import { BASKETS } from "@/lib/baskets";

export async function GET() {
  return NextResponse.json(Object.keys(BASKETS));
}
