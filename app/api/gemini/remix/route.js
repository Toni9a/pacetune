import { NextResponse } from "next/server";
import { generateRemixedRunImage, hasGeminiConfig } from "@/lib/gemini";

export async function POST(request) {
  try {
    if (!hasGeminiConfig()) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("image");
    const runRaw = formData.get("run");
    const extraInstructions = formData.get("extraInstructions") || "";
    const layoutId = formData.get("layoutId") || "auto";

    if (!runRaw || typeof runRaw !== "string") {
      return NextResponse.json({ error: "Missing run payload." }, { status: 400 });
    }

    let run;
    try {
      run = JSON.parse(runRaw);
    } catch {
      return NextResponse.json({ error: "Invalid run payload." }, { status: 400 });
    }

    const hasFile = file instanceof File && file.size > 0;
    const buffer = hasFile ? Buffer.from(await file.arrayBuffer()) : null;
    const result = await generateRemixedRunImage({
      mimeType: hasFile ? (file.type || "image/png") : "",
      base64Data: hasFile && buffer ? buffer.toString("base64") : "",
      run,
      extraInstructions: {
        text: String(extraInstructions || ""),
        layoutId: String(layoutId || "auto")
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unknown error." }, { status: 500 });
  }
}
