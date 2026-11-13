import type {
  AlternativeTag,
  Category,
  CompanyStage,
  ConstraintTag,
  DecisionType,
  OutcomeCategory,
  OutcomeStatus,
  TimeHorizon,
} from "./vocab";

/** Where a field's value came from. AI output is never treated as fact. */
export type FieldOrigin = "ai_extracted" | "user_confirmed" | "user_added";

export interface Facets {
  customer_segment?: "b2b" | "b2c" | "both" | "unknown";
  company_stage?: CompanyStage;
}

export interface StructuredOption {
  label: string;
  description: string;
  tag: AlternativeTag;
  origin: FieldOrigin;
}

export interface StructuredAssumption {
  text: string;
  origin: FieldOrigin;
}

/** The decision as the user approved it (output of the "Review structure" step). */
export interface StructuredDecision {
  title: string;
  category: Category;
  decision_type: DecisionType;
  context: string;
  objective: string;
  time_horizon: TimeHorizon;
  alternatives: StructuredOption[];
  constraints: ConstraintTag[];
  assumptions: StructuredAssumption[];
  expected_benefits: string[];
  risks: string[];
  missing_information: string[];
  facets: Facets;
  field_origins: Record<string, FieldOrigin>;
}

export interface SuccessCriterion {
  metric: string;
  target: string;
  by: string; // ISO date
}

export type MatchLabel = "strong" | "partial" | "weak";
export type MatchTargetType = "external_case" | "personal_decision";

export interface MatchExplanation {
  similarities: string[];
  differences: string[];
  unknowns: string[];
}

export interface MatchResult {
  targetType: MatchTargetType;
  targetId: string;
  title: string;
  score: number;
  label: MatchLabel;
  reasons: string[];
  explanation: MatchExplanation;
  outcomeKnown: boolean;
  outcomeCategory?: OutcomeCategory;
  outcomeStatus?: OutcomeStatus;
  isDemo?: boolean;
  summary: {
    decisionMade?: string;
    observedOutcome?: string;
    expectedOutcome?: string;
    lessons?: string;
    actorName?: string;
    failedAssumptions?: string[];
    heldAssumptions?: string[];
  };
}

export type Sufficiency = "sufficient" | "partial" | "insufficient";
