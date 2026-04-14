import layoutCatalog from "@/geminiprompt_layouts_v2.json";

export function getLayoutCatalog() {
  return layoutCatalog;
}

export function listAllLayouts() {
  return [
    ...(layoutCatalog.photo_overlay_layouts || []),
    ...(layoutCatalog.music_only_layouts || [])
  ];
}

export function findLayoutById(layoutId) {
  if (!layoutId || layoutId === "auto") {
    return null;
  }
  return listAllLayouts().find((layout) => layout.id === layoutId) || null;
}

export function listLayoutsForClient() {
  return listAllLayouts().map((layout) => ({
    id: layout.id,
    type: layout.type,
    name: layout.name,
    mood: layout.mood,
    visual_concept: layout.visual_concept,
    photo_requirement: layout.photo_requirement || "",
    ideal_split_count: layout.ideal_split_count || "",
    song_completeness_rule: layout.song_completeness_rule || ""
  }));
}
