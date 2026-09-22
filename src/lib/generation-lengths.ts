// Shared browser/server contract. These are output lengths, not render-time estimates.
export const MAX_GENERATION_SECONDS = 300;
export const GENERATION_LENGTHS = [
  { seconds: 10, time: "10 sec", director: "Teaser", music: "Sting" },
  { seconds: 15, time: "15 sec", director: "Quick clip", music: "Tag" },
  { seconds: 30, time: "30 sec", director: "Short", music: "Hook" },
  { seconds: 45, time: "45 sec", director: "Scene", music: "Verse sketch" },
  { seconds: 60, time: "1 min", director: "Reel", music: "Preview" },
  { seconds: 90, time: "1:30", director: "Extended short", music: "Demo" },
  { seconds: 120, time: "2 min", director: "Short film", music: "Short song" },
  { seconds: 180, time: "3 min", director: "Music video", music: "Full song" },
  { seconds: 240, time: "4 min", director: "Extended video", music: "Extended song" },
  { seconds: 300, time: "5 min", director: "Long cut", music: "Long arrangement" },
] as const;
