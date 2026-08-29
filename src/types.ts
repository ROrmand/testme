export type QuestionType = "change_rationale" | "symbol" | "architecture";

export interface Rubric {
  requiredTerms: string[];
  minLength: number;
  requiredSymbol?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
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
