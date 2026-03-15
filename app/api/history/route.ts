import { NextResponse } from "next/server";

import { readAppData } from "@/lib/storage";

export async function GET() {
  const data = await readAppData();
  return NextResponse.json(data.deliveryHistory);
}
