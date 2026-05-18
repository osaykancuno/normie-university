/// @file skill-module-schema.ts
/// @notice Shape + minimal validator for NORMIE UNIVERSITY skill modules pinned to IPFS.
///         Used by the /api/ipfs/upload endpoint and the create-skill UI.

export type SkillModuleV1 = {
  name: string;
  version: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  prerequisites?: number[];
  content: {
    type: string;
    contracts?: Array<{ name: string; address: string; abi?: unknown }>;
    steps: Array<{ action: string; description: string }>;
    best_practices?: string[];
    risk_parameters?: Record<string, number>;
  };
  verification: {
    type: string;
    criteria: string;
    min_score: number;
  };
};

export type SkillModuleValidationError = {
  path: string;
  message: string;
};

export function validateSkillModule(
  raw: unknown
): { ok: true; value: SkillModuleV1 } | { ok: false; errors: SkillModuleValidationError[] } {
  const errors: SkillModuleValidationError[] = [];
  const push = (path: string, message: string) => errors.push({ path, message });

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: [{ path: "$", message: "Module must be a JSON object" }] };
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.name !== "string" || !o.name.trim()) push("name", "required string");
  if (typeof o.version !== "string" || !o.version.trim()) push("version", "required string (e.g. 1.0.0)");
  if (typeof o.description !== "string" || !o.description.trim()) push("description", "required string");
  if (typeof o.category !== "string" || !o.category.trim()) push("category", "required string");
  if (typeof o.difficulty !== "string" ||
      !["beginner", "intermediate", "advanced", "expert"].includes(o.difficulty)) {
    push("difficulty", "must be one of beginner|intermediate|advanced|expert");
  }

  if (o.prerequisites !== undefined) {
    if (!Array.isArray(o.prerequisites) || o.prerequisites.some((p) => typeof p !== "number")) {
      push("prerequisites", "must be an array of numbers (skillIds)");
    }
  }

  // V2 modules use "executable" + "verification" (object shape differs).
  // V1 modules use "content" + "verification" with min_score numeric.
  // Accept either; only enforce that at least one carries the skill body.
  const isV2 = typeof o.spec_version === "string" && /\/v2$/.test(o.spec_version);
  if (isV2) {
    if (typeof o.executable !== "object" || o.executable === null) {
      push("executable", "required object for v2 modules");
    }
    // verification is required but shape is freeform in v2
    if (typeof o.verification !== "object" || o.verification === null) {
      push("verification", "required object");
    }
  } else {
    const content = o.content;
    if (typeof content !== "object" || content === null) {
      push("content", "required object");
    } else {
      const c = content as Record<string, unknown>;
      if (typeof c.type !== "string") push("content.type", "required string");
      if (!Array.isArray(c.steps) || c.steps.length === 0) {
        push("content.steps", "required non-empty array");
      }
    }

    const verification = o.verification;
    if (typeof verification !== "object" || verification === null) {
      push("verification", "required object");
    } else {
      const v = verification as Record<string, unknown>;
      if (typeof v.type !== "string") push("verification.type", "required string");
      if (typeof v.criteria !== "string") push("verification.criteria", "required string");
      if (typeof v.min_score !== "number" || v.min_score < 0 || v.min_score > 100) {
        push("verification.min_score", "required number between 0 and 100");
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: raw as SkillModuleV1 };
}
