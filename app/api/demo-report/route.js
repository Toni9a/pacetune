import { NextResponse } from "next/server";
import { demoScenarioOptions, makeDemoReport } from "@/lib/demo-report";

export async function GET(request) {
  const url = new URL(request.url);
  const scenario = url.searchParams.get("scenario") || "mellow";
  return NextResponse.json({
    ...makeDemoReport(scenario),
    scenario_options: demoScenarioOptions()
  });
}
