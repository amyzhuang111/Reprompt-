import { NextResponse } from "next/server";

// On Vercel there's no persistent SQLite, so stats start empty each deploy
export async function GET() {
  return NextResponse.json({ total: 0 });
}
