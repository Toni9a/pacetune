import { findLayoutById } from "@/lib/layout-catalog";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiImageModel() {
  return process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";
}

export function geminiTextModel() {
  return process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
}

function compactSongLine(song) {
  return `${song.track_name} - ${song.artists}`;
}

function formatLayoutInstructions(layout) {
  if (!layout) {
    return "";
  }

  const composition = layout.composition ? JSON.stringify(layout.composition, null, 2) : "";
  const dataMapping = layout.data_mapping ? JSON.stringify(layout.data_mapping, null, 2) : "";
  const avoid = Array.isArray(layout.avoid) ? layout.avoid.join(" | ") : "";

  return [
    `Selected layout: ${layout.name} (${layout.id})`,
    `Layout type: ${layout.type}`,
    layout.mood ? `Mood: ${layout.mood}` : "",
    layout.visual_concept ? `Visual concept: ${layout.visual_concept}` : "",
    layout.photo_requirement ? `Photo requirement: ${layout.photo_requirement}` : "",
    layout.song_completeness_rule ? `Song completeness rule: ${layout.song_completeness_rule}` : "",
    composition ? `Composition rules:\n${composition}` : "",
    dataMapping ? `Data mapping rules:\n${dataMapping}` : "",
    avoid ? `Avoid: ${avoid}` : ""
  ].filter(Boolean).join("\n");
}

export function buildRunRemixPrompt(run, extraInstructions = "", layout = null) {
  const splitSummary = (run.splits || []).map((split, index) => {
    const distance = Number(split.distance_km || 0);
    const cumulative = Math.round(
      (run.splits || []).slice(0, index + 1).reduce((sum, item) => sum + Number(item.distance_km || 0), 0) * 10
    ) / 10;
    const kmLabel = Number.isInteger(cumulative) ? `${cumulative} km` : `${cumulative.toFixed(1)} km`;
    const songs = (split.songs || []).map(compactSongLine);
    return {
      kmLabel,
      pace: split.distance_km > 0
        ? `${Math.floor(split.elapsed_time_s / split.distance_km / 60)}:${String(Math.round((split.elapsed_time_s / split.distance_km) % 60)).padStart(2, "0")} /km`
        : "n/a",
      songs
    };
  });

  const splitText = splitSummary.map((split) => {
    if (!split.songs.length) {
      return `${split.kmLabel}: no song shown, pace ${split.pace}`;
    }
    return `${split.kmLabel}: ${split.songs.join(" | ")}, pace ${split.pace}`;
  }).join("\n");

  const userExtra = extraInstructions?.trim();
  const selectedLayoutInstructions = formatLayoutInstructions(layout);

  return [
    layout?.type === "music_only"
      ? "Create a creative standalone PaceTune visual inspired by the uploaded photo's mood, palette, and composition notes."
      : "Edit the uploaded photo into a creative PaceTune share image.",
    layout?.type === "music_only"
      ? "Do not rely on the original photo remaining visible as the base layer. Use the image analysis as inspiration for mood, palette, energy, and composition."
      : "Keep the uploaded photo recognizable and use it as the foundation.",
    "Use the separate image-analysis notes provided to guide the composition.",
    "Be creative and art-directed rather than generic or template-like.",
    "Arrange the run split information in a visually striking way.",
    "Do not add any PaceTune logo, brand mark, app chrome, or dashboard UI.",
    "Do not make it look like a plain app screenshot.",
    "The output should feel like a polished social image or creative poster built from the uploaded photo.",
    "Every split song provided below should be represented. Do not silently omit songs.",
    "If a split has multiple songs, either stack them elegantly or cluster them together in a tasteful way.",
    "Preserve realism, readability, and strong composition.",
    "",
    `Run name: ${run.name || "Run"}`,
    `Distance: ${Number(run.distance_km || 0).toFixed(2)} km`,
    `Start: ${run.start_time}`,
    `End: ${run.end_time}`,
    "",
    selectedLayoutInstructions ? `${selectedLayoutInstructions}\n` : "",
    "Use this run data as design content, but adapt the placement and styling to the uploaded image after analyzing it:",
    "",
    "Split data to visually integrate:",
    splitText,
    userExtra ? `\nExtra creative direction: ${userExtra}` : ""
  ].join("\n");
}

async function parseJsonResponse(response, label) {
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON: ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${text}`);
  }
  return payload;
}

export async function analyzeRunRemixImage({ mimeType, base64Data }) {
  if (!mimeType || !base64Data) {
    return "";
  }
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = geminiTextModel();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "Analyze this uploaded photo for use in a creative run-share image.",
                  "Return concise composition notes for an image editor.",
                  "Focus on:",
                  "- main subject and focal areas",
                  "- facial features or body areas that should stay unobstructed",
                  "- negative space where text or graphic elements can go",
                  "- image mood, color palette, and style direction",
                  "- whether the composition suits minimal type, bold type, curved text, labels, collage, or editorial layouts",
                  "Keep the answer practical and compact."
                ].join("\n")
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
      })
    }
  );

  const payload = await parseJsonResponse(response, "Gemini image analysis");
  return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n").trim() || "";
}

export async function generateRemixedRunImage({ mimeType, base64Data, run, extraInstructions }) {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = geminiImageModel();
  const selectedLayout = findLayoutById(extraInstructions?.layoutId || "");
  const needsSourceImage = selectedLayout?.type !== "music_only";

  if (needsSourceImage && (!mimeType || !base64Data)) {
    throw new Error("This layout needs an uploaded image.");
  }

  const analysis = await analyzeRunRemixImage({ mimeType, base64Data });
  const prompt = [
    buildRunRemixPrompt(run, extraInstructions?.text || "", selectedLayout),
    analysis ? `\nImage analysis notes to follow:\n${analysis}` : ""
  ].join("\n");

  const requestParts = [{ text: prompt }];
  if (mimeType && base64Data) {
    requestParts.push({
      inlineData: {
        mimeType,
        data: base64Data
      }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: requestParts
          }
        ]
      })
    }
  );

  const payload = await parseJsonResponse(response, "Gemini image edit");

  const responseParts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = responseParts.find((part) => part.inlineData?.data);
  const textPart = responseParts.find((part) => part.text);

  if (!imagePart?.inlineData?.data) {
    throw new Error(`Gemini did not return an image. Response: ${JSON.stringify(payload).slice(0, 500)}`);
  }

  return {
    prompt,
    analysis,
    selectedLayout,
    model,
    imageDataUrl: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
    responseText: textPart?.text || ""
  };
}
