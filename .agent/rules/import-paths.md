# Rule: Strict `@/` Import Paths

## Mandate

**All imports in `src/` MUST use the `@/` path alias.  
Relative imports (`./foo`, `../bar`) are strictly forbidden.**

This is enforced project-wide. Violations will cause build failures on CI and break bundler resolution.

---

## Why

- Relative paths break silently when files are moved or refactored.
- `@/` aliases are always resolved from `src/`, making every import unambiguous regardless of file depth.
- The bundler (`wrangler` + esbuild) resolves `@/` via `tsconfig.json` `paths`, which is the single source of truth.

---

## How the Alias Maps to `src/`

```
@/*           → src/*
@/ai/*        → src/backend/ai/*
@/api/*       → src/backend/api/*
@/db/*        → src/backend/db/*
@/db/schema/* → src/backend/db/schemas/*
@/health/*    → src/backend/health/*
@/logging/*   → src/backend/logging/*
@/routes/*    → src/backend/routes/*
@/services/*  → src/backend/services/*
@/modules/*   → src/backend/modules/*
@/shared/*    → src/backend/shared/*
@backend/*    → src/backend/*
@frontend/*   → src/frontend/*
```

---

## Rules for Agents

### ✅ DO — Always use `@/` aliases

```ts
// ✅ Correct
import { BaseAgent } from "@/backend/ai/agents/base/BaseAgent";
import { logger } from "@/backend/logging";
import { db } from "@/backend/db";
import { sanitize } from "@/backend/ai/utils/sanitizer";
```

### ❌ DON'T — Never use relative paths

```ts
// ❌ Forbidden
import { BaseAgent } from "./BaseAgent";
import { logger } from "../../logging";
import { db } from "../../../db";
```

---

## Adding a New `@/` Path Alias

If you introduce a new directory under `src/` and need an alias, you MUST add it to `tsconfig.json` `paths` **before** importing it:

```jsonc
// tsconfig.json (add inside "paths")
"@/myNewModule/*": ["src/backend/myNewModule/*"]
```

Then run `npx tsc --noEmit` to verify there are no resolution errors.

---

## Enforcement Script

A reusable script exists at `scripts/fix-imports.js` to auto-fix any stray relative imports:

```bash
# Dry-run (shows what would change)
node scripts/fix-imports.js --dir src/backend

# Apply changes
node scripts/fix-imports.js --dir src/backend --write
```

Run this before every PR or after adding new files.
