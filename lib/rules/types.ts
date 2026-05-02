export type Grounds =
  | "NON_PAYMENT"
  | "LEASE_VIOLATION_CURABLE"
  | "LEASE_VIOLATION_NON_CURABLE"
  | "HOLDOVER"
  | "NUISANCE_ILLEGAL"
  | "NO_CAUSE";

export type TenancyType =
  | "WRITTEN_LEASE"
  | "ORAL_LEASE"
  | "M2M"
  | "WEEK_TO_WEEK"
  | "AT_WILL"
  | "SUBSIDIZED"
  | "MOBILE_HOME_PARK";

export type RuleType =
  | "NOTICE_PERIOD"
  | "FILING_FORM"
  | "COURT_VENUE"
  | "FEE"
  | "SERVICE_METHOD"
  | "WRIT_WAIT"
  | "RELOCATION_ASSIST"
  | "ALLOWED_GROUNDS_OVERLAY"
  | "ANSWER_PERIOD";

export interface Rule {
  id: string;
  jurisdiction_code: string;
  rule_type: RuleType;
  grounds: Grounds[];
  tenancy_types: TenancyType[];
  payload: Record<string, unknown>;
  statute_citation: string | null;
  effective_from: string;
  effective_to: string | null;
}

export interface ResolvedRules {
  noticePeriod?: { duration_days: number; exclude_weekends: boolean; exclude_court_holidays: boolean };
  serviceMethods?: string[];
  courtVenue?: { court_name: string; court_address?: string; efile_supported?: boolean };
  fee?: { fee_cents: number; pay_to: string };
  writWait?: { duration_days: number };
  answerPeriod?: { duration_days: number };
  citations: string[];
}
