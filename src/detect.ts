import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { extractTerms } from "./diff.js";
import { loadSummary } from "./prompts.js";
import type { CategoryKey, DetectionResult, DiffAnalysis } from "./types.js";
import { DOMAIN_CATEGORY_KEYS } from "./types.js";

const DOMAIN_KEYWORDS: Record<CategoryKey, string[]> = {
  changeRationale: [],
  symbols: [],
  architecture: [],
  runtime: [],
  dataStructures: [],
  dependencies: [],
  testing: [],
  errorHandling: [],
  apiContracts: [],
  security: [],
  performance: [],
  database: [],
  machineLearning: [
    "machine learning",
    "pytorch",
    "tensorflow",
    "sklearn",
    "scikit-learn",
    "keras",
    "huggingface",
    "notebook",
    "model training",
    "inference",
  ],
  cybersecurity: [
    "cybersecurity",
    "security audit",
    "owasp",
    "pentest",
    "vulnerability",
    "threat model",
    "encryption",
  ],
  frontend: ["react", "vue", "svelte", "angular", "frontend", "component", "jsx", "tsx"],
  backend: ["express", "fastapi", "django", "flask", "nestjs", "backend", "middleware", "api route"],
  devops: ["docker", "kubernetes", "terraform", "github actions", "ci/cd", "devops", "helm"],
  mobile: ["react-native", "android", "ios", "swift", "kotlin", "mobile app", "flutter"],
  dataEngineering: ["airflow", "spark", "dbt", "etl", "data pipeline", "data engineering", "warehouse"],
};

const MANIFEST_SIGNALS: Array<{ file: string; category: CategoryKey; patterns: RegExp }> = [
  { file: "package.json", category: "frontend", patterns: /\b(react|vue|svelte|@angular)\b/i },
  { file: "package.json", category: "backend", patterns: /\b(express|fastify|nestjs|koa)\b/i },
  { file: "package.json", category: "machineLearning", patterns: /\b(tensorflow|@tensorflow)\b/i },
  { file: "pyproject.toml", category: "machineLearning", patterns: /\b(torch|tensorflow|scikit-learn|sklearn)\b/i },
  { file: "requirements.txt", category: "machineLearning", patterns: /\b(torch|tensorflow|scikit-learn|sklearn)\b/i },
  { file: "go.mod", category: "backend", patterns: /\b(gin|echo|fiber)\b/i },
];

const PATH_SIGNALS: Array<{ pattern: RegExp; category: CategoryKey; reason: string }> = [
  { pattern: /(^|\/)models\//i, category: "machineLearning", reason: "models/ directory in diff" },
  { pattern: /\.ipynb$/i, category: "machineLearning", reason: "Jupyter notebook in diff" },
  { pattern: /(^|\/)\.github\/workflows\//i, category: "devops", reason: "CI workflow in diff" },
  { pattern: /Dockerfile/i, category: "devops", reason: "Dockerfile in diff" },
  { pattern: /(^|\/)terraform\//i, category: "devops", reason: "terraform/ directory in diff" },
  { pattern: /(^|\/)android\//i, category: "mobile", reason: "android/ directory in diff" },
  { pattern: /(^|\/)ios\//i, category: "mobile", reason: "ios/ directory in diff" },
  { pattern: /(^|\/)components\//i, category: "frontend", reason: "components/ directory in diff" },
  { pattern: /(^|\/)routes\//i, category: "backend", reason: "routes/ directory in diff" },
  { pattern: /(^|\/)migrations\//i, category: "database", reason: "migrations/ directory in diff" },
  { pattern: /\.(sql)$/i, category: "database", reason: "SQL file in diff" },
  { pattern: /(owasp|pentest|security)/i, category: "cybersecurity", reason: "security-related path in diff" },
  { pattern: /(airflow|spark|dbt|etl)/i, category: "dataEngineering", reason: "data pipeline path in diff" },
];

function readText(filePath: string): string {
  if (!existsSync(filePath)) {
    return "";
  }
  return readFileSync(filePath, "utf8");
}

function parseDomainSection(summary: string): { domain: string | null; focusTerms: string[] } {
  let inDomain = false;
  const focusTerms: string[] = [];
  let primary: string | null = null;

  for (const line of summary.split("\n")) {
    if (/^##\s+Domain\s*$/i.test(line)) {
      inDomain = true;
      continue;
    }

    if (inDomain && /^##\s+/.test(line)) {
      break;
    }

    if (!inDomain) {
      continue;
    }

    const primaryMatch = line.match(/^-\s*Primary:\s*(.+)$/i);
    if (primaryMatch) {
      primary = primaryMatch[1].trim();
      focusTerms.push(...extractTerms(primary));
      continue;
    }

    const focusMatch = line.match(/^-\s*Focus areas:\s*(.+)$/i);
    if (focusMatch) {
      focusTerms.push(...extractTerms(focusMatch[1]));
    }
  }

  return { domain: primary, focusTerms };
}

function scoreCategoryFromText(text: string, category: CategoryKey): { confidence: number; reason: string } | null {
  const keywords = DOMAIN_KEYWORDS[category];
  if (keywords.length === 0) {
    return null;
  }

  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      return { confidence: 0.85, reason: `Matched "${keyword}" in project metadata` };
    }
  }

  return null;
}

function mapDomainToCategories(domain: string): CategoryKey[] {
  const lower = domain.toLowerCase();
  const mapped: CategoryKey[] = [];

  if (/machine learning|ml|model|pytorch|tensorflow/.test(lower)) {
    mapped.push("machineLearning", "dataStructures");
  }
  if (/cyber|security|pentest|owasp/.test(lower)) {
    mapped.push("cybersecurity", "security");
  }
  if (/frontend|react|vue|ui/.test(lower)) {
    mapped.push("frontend");
  }
  if (/backend|api|server/.test(lower)) {
    mapped.push("backend", "apiContracts");
  }
  if (/devops|infra|deploy|ci/.test(lower)) {
    mapped.push("devops", "runtime");
  }
  if (/mobile|android|ios/.test(lower)) {
    mapped.push("mobile");
  }
  if (/data engineering|etl|pipeline|warehouse/.test(lower)) {
    mapped.push("dataEngineering", "database");
  }

  return mapped;
}

export function detectProject(
  cwd: string,
  analysis?: DiffAnalysis,
): DetectionResult {
  const summary = loadSummary();
  const suggested: DetectionResult["suggestedCategories"] = {};
  const { domain: summaryDomain, focusTerms } = parseDomainSection(summary);

  const configDomain = summaryDomain;
  const corpus = [summary, focusTerms.join(" ")].filter(Boolean).join("\n");

  for (const category of DOMAIN_CATEGORY_KEYS) {
    const hit = scoreCategoryFromText(corpus, category);
    if (hit) {
      suggested[category] = { enabled: true, ...hit };
    }
  }

  if (configDomain) {
    for (const category of mapDomainToCategories(configDomain)) {
      suggested[category] = {
        enabled: true,
        confidence: 0.95,
        reason: `SUMMARY.md Domain: ${configDomain}`,
      };
    }
  }

  for (const signal of MANIFEST_SIGNALS) {
    const manifestPath = path.join(cwd, signal.file);
    const content = readText(manifestPath);
    if (!content || !signal.patterns.test(content)) {
      continue;
    }

    suggested[signal.category] = {
      enabled: true,
      confidence: 0.9,
      reason: `Matched pattern in ${signal.file}`,
    };
  }

  if (analysis) {
    for (const file of analysis.files) {
      for (const signal of PATH_SIGNALS) {
        if (!signal.pattern.test(file.path)) {
          continue;
        }

        const existing = suggested[signal.category];
        if (!existing || existing.confidence < 0.8) {
          suggested[signal.category] = {
            enabled: true,
            confidence: 0.8,
            reason: signal.reason,
          };
        }
      }
    }
  }

  const coreBoosts: Partial<Record<CategoryKey, string>> = {
    testing: "test",
    dependencies: "package",
    database: "migration",
    security: "auth",
    runtime: "docker",
  };

  if (analysis) {
    for (const [category, token] of Object.entries(coreBoosts) as Array<[CategoryKey, string]>) {
      const hit = analysis.files.some((file) => file.path.toLowerCase().includes(token));
      if (hit) {
        suggested[category] = {
          enabled: true,
          confidence: 0.7,
          reason: `Diff touches ${token}-related files`,
        };
      }
    }
  }

  return {
    suggestedCategories: suggested,
    domain: configDomain,
  };
}

export function applyDetectionToConfig(
  config: import("./types.js").TestmeConfig,
  detection: DetectionResult,
): import("./types.js").TestmeConfig {
  if (!config.autoDetect && !config.domain) {
    return config;
  }

  const categories = { ...config.categories };
  const detectedMeta: Record<string, { confidence: number; reason: string }> = {};

  for (const [key, suggestion] of Object.entries(detection.suggestedCategories)) {
    const category = key as CategoryKey;
    detectedMeta[category] = {
      confidence: suggestion.confidence,
      reason: suggestion.reason,
    };

    if (config.autoDetect && suggestion.confidence >= 0.8) {
      categories[category] = suggestion.enabled;
    }
  }

  if (config.domain) {
    for (const category of mapDomainToCategories(config.domain)) {
      categories[category] = true;
    }
  }

  return {
    ...config,
    categories,
    domain: config.domain ?? detection.domain,
    _detected: detectedMeta,
  };
}
