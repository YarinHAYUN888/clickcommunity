/** Centralized prompts for personality + community-safety signals (not moderation replacement). */

export const PERSONALITY_SYSTEM_PROMPT = `You are an expert community psychologist and dating-app compatibility analyst for a Hebrew-first serious community app called "Click".
Analyze the user's written materials for PERSONALITY and RELATIONSHIP intent — not final moderation (humans review).
You also output community_safety signals: fake/troll/spam/sexual-only-intent/low-quality — use conservative thresholds.

Return JSON ONLY with this exact shape (English keys, Hebrew allowed in string values where natural):
{
  "personality_summary": string (1-3 sentences, Hebrew),
  "energy_type": "calm" | "social" | "intense" | "balanced",
  "communication_style": string (short Hebrew),
  "emotional_style": string (short Hebrew),
  "social_style": string (short Hebrew),
  "relationship_intent": string (short Hebrew, e.g. serious / casual / friends / exploring),
  "lifestyle_type": string (short Hebrew),
  "community_risk": "low" | "medium" | "high",
  "safety_confidence": number 0-1,
  "safety_flags": string[] (machine tokens, e.g. "low_effort_bio", "sexual_only_intent", "spam_pattern"),
  "personality_tags": string[] (3-8 short Hebrew or mixed labels),
  "ai_score": number 0-100 (how complete/coherent/rich the personality signal is, NOT moral judgment)
}`;

export function buildPersonalityUserPayload(input: {
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  occupation?: string | null;
  interests?: string[] | null;
  region?: string | null;
  gender?: string | null;
  questionnaire_responses?: Record<string, unknown> | null;
  voice_intro_meta?: Record<string, unknown> | null;
}): string {
  const q = input.questionnaire_responses && Object.keys(input.questionnaire_responses).length
    ? JSON.stringify(input.questionnaire_responses, null, 0)
    : "(none)";
  const voice = input.voice_intro_meta && Object.keys(input.voice_intro_meta).length
    ? JSON.stringify(input.voice_intro_meta).slice(0, 4000)
    : "(none or not transcribed yet)";
  const interests = (input.interests || []).join(", ") || "(none)";
  return [
    `first_name: ${input.first_name || ""}`,
    `last_name: ${input.last_name || ""}`,
    `gender: ${input.gender || ""}`,
    `region: ${input.region || ""}`,
    `occupation: ${input.occupation || ""}`,
    `bio: ${input.bio || ""}`,
    `interests: ${interests}`,
    `questionnaire_responses_json: ${q}`,
    `voice_intro_meta_json: ${voice}`,
  ].join("\n");
}
