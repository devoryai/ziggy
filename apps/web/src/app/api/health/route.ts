export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { checkOllamaHealth } from "@ziggy/models";

export async function GET() {
  let ollama: { available: boolean; models?: string[]; error?: string };

  try {
    const models = await checkOllamaHealth();
    ollama = { available: true, models };
  } catch (err) {
    ollama = { available: false, error: String(err) };
  }

  return NextResponse.json({
    status: "ok",
    ziggy: "1.0.0-mvp",
    ollama,
    timestamp: new Date().toISOString(),
  });
}
