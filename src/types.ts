export type QuestionType = "change_rationale" | "symbol" | "architecture" | "category";

export type CategoryKey =
  | "changeRationale"
  | "symbols"
  | "architecture"
  | "runtime"
  | "dataStructures"
  | "dependencies"
  | "testing"
  | "errorHandling"
  | "apiContracts"
  | "security"
  | "performance"
  | "database"
  | "machineLearning"
  | "cybersecurity"
  | "frontend"
  | "backend"
  | "devops"
  | "mobile"
  | "dataEngineering";

export const ALL_CATEGORY_KEYS: CategoryKey[] = [
  "changeRationale",
  "symbols",
  "architecture",
  "runtime",
  "dataStructures",
  "dependencies",
  "testing",
  "errorHandling",
  "apiContracts",
  "security",
  "performance",
  "database",
  "machineLearning",
  "cybersecurity",
  "frontend",
  "backend",
  "devops",
  "mobile",
  "dataEngineering",
];

export const DOMAIN_CATEGORY_KEYS: CategoryKey[] = [
  "machineLearning",
  "cybersecurity",
  "frontend",
  "backend",
  "devops",
  "mobile",
  "dataEngineering",
];

export interface Rubric {
  requiredTerms: string[];
  minLength: number;
  requiredSymbol?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  category: CategoryKey;
  prompt: string;
  files: string[];
  rubric: Rubric;
}

export interface Session {
  diffHash: string;
  baseRef: string;
  generatedAt: string;
  questions: Question[];
}

export interface PassFile {
  diffHash: string;
  score: number;
  verifiedAt: string;
  questionsAnswered: number;
}

export interface FileChange {
  path: string;
  symbols: string[];
}

export interface DiffAnalysis {
  diffHash: string;
  baseRef: string;
  rawDiff: string;
  files: FileChange[];
}

export interface VerifyResult {
  passed: boolean;
  score: number;
  total: number;
  failures: Array<{
    id: string;
    prompt: string;
    missingTerms: string[];
    tooShort: boolean;
    missingSymbol?: string;
  }>;
}

export interface PromptsSection {
  file: string;
  bullets: string[];
}

export type CategoryFlags = Partial<Record<CategoryKey, boolean>>;

export interface QuestionsConfig {
  min: number;
  max: number;
}

export interface TestmeConfig {
  questions: QuestionsConfig;
  categories: Record<CategoryKey, boolean>;
  autoDetect: boolean;
  domain: string | null;
  _detected?: Record<string, { confidence: number; reason: string }>;
}

export interface TestmeConfigInput {
  questions?: Partial<QuestionsConfig>;
  categories?: CategoryFlags;
  autoDetect?: boolean;
  domain?: string | null;
  _detected?: Record<string, { confidence: number; reason: string }>;
}

export interface GenerateOptions {
  maxQuestions?: number;
  minQuestions?: number;
  categories?: CategoryKey[];
}

export interface CategorySuggestion {
  enabled: boolean;
  confidence: number;
  reason: string;
}

export interface DetectionResult {
  suggestedCategories: Partial<Record<CategoryKey, CategorySuggestion>>;
  domain: string | null;
}

export interface QuestionCandidate {
  category: CategoryKey;
  type: QuestionType;
  prompt: string;
  files: string[];
  rubric: Rubric;
  priority: number;
}
