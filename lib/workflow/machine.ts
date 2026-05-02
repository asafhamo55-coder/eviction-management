import { setup } from "xstate";

/**
 * Canonical eviction case FSM (spec §6.1).
 * Transitions are intentionally minimal at MVP — the engine reads the current
 * case row and dispatches events; guards live in server actions, not in the
 * machine, so persistence stays the source of truth.
 */
export const caseMachine = setup({
  types: {
    context: {} as { caseId: string },
    events: {} as
      | { type: "INTAKE_SUBMIT" }
      | { type: "GENERATE_NOTICE" }
      | { type: "MARK_NOTICE_SERVED" }
      | { type: "TENANT_CURED" }
      | { type: "TENANT_VACATED" }
      | { type: "CURE_EXPIRED" }
      | { type: "FILE_COMPLAINT" }
      | { type: "SUMMONS_ISSUED" }
      | { type: "MARK_SERVED" }
      | { type: "TENANT_ANSWERED" }
      | { type: "DEFAULT_AVAILABLE" }
      | { type: "HEARING_SCHEDULED" }
      | { type: "HEARING_HELD"; outcome: "LANDLORD" | "TENANT" | "SETTLEMENT" }
      | { type: "REQUEST_WRIT" }
      | { type: "WRIT_ISSUED" }
      | { type: "LOCKOUT_DONE" }
      | { type: "CLOSE" }
      | { type: "REQUIRE_ATTORNEY" },
  },
}).createMachine({
  id: "evictionCase",
  context: { caseId: "" },
  initial: "DRAFT",
  states: {
    DRAFT:                { on: { INTAKE_SUBMIT: "INTAKE_COMPLETE", REQUIRE_ATTORNEY: "ATTORNEY_REQUIRED" } },
    INTAKE_COMPLETE:      { on: { GENERATE_NOTICE: "NOTICE_REQUIRED", REQUIRE_ATTORNEY: "ATTORNEY_REQUIRED" } },
    NOTICE_REQUIRED:      { on: { MARK_NOTICE_SERVED: "NOTICE_SERVED", REQUIRE_ATTORNEY: "ATTORNEY_REQUIRED" } },
    NOTICE_SERVED:        { on: { TENANT_CURED: "TENANT_CURED", TENANT_VACATED: "TENANT_VACATED", CURE_EXPIRED: "CURE_EXPIRED" } },
    CURE_PERIOD:          { on: { TENANT_CURED: "TENANT_CURED", TENANT_VACATED: "TENANT_VACATED", CURE_EXPIRED: "CURE_EXPIRED" } },
    TENANT_CURED:         { on: { CLOSE: "CLOSED_RESOLVED" } },
    TENANT_VACATED:       { on: { CLOSE: "CLOSED_RESOLVED" } },
    CURE_EXPIRED:         { on: { FILE_COMPLAINT: "FILED" } },
    FILING_REQUIRED:      { on: { FILE_COMPLAINT: "FILED" } },
    FILED:                { on: { SUMMONS_ISSUED: "SUMMONS_ISSUED" } },
    SUMMONS_ISSUED:       { on: { MARK_SERVED: "SERVED" } },
    SERVED:               { on: { TENANT_ANSWERED: "TENANT_ANSWERED", DEFAULT_AVAILABLE: "DEFAULT_AVAILABLE" } },
    TENANT_ANSWERED:      { on: { HEARING_SCHEDULED: "HEARING_SCHEDULED" } },
    DEFAULT_AVAILABLE:    { on: { HEARING_SCHEDULED: "HEARING_SCHEDULED", HEARING_HELD: "HEARING_HELD" } },
    HEARING_SCHEDULED:    { on: { HEARING_HELD: "HEARING_HELD" } },
    HEARING_HELD: {
      on: {
        REQUEST_WRIT: { target: "JUDGMENT_FOR_LANDLORD" },
        CLOSE: { target: "CLOSED_RESOLVED" },
      },
    },
    JUDGMENT_FOR_LANDLORD: { on: { WRIT_ISSUED: "WRIT_ISSUED" } },
    WRIT_ISSUED:           { on: { LOCKOUT_DONE: "LOCKOUT_COMPLETE" } },
    LOCKOUT_COMPLETE:      { on: { CLOSE: "CLOSED_RESOLVED" } },
    CLOSED_RESOLVED:       { type: "final" },
    ATTORNEY_REQUIRED:     {},
  },
});
