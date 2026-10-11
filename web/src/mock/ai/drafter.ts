import type {
  BrandProfile,
  Case,
  CaseStance,
  CycleConversion,
  FeedbackEntry,
  Region,
  Requirement,
  RequirementSnapshot,
  ResolvedBrief,
  ShapeAnswer,
  ShapeQuestion,
  Signal,
  User,
  VehiclePlan,
} from "@/contracts";
import { composeDrafts, composeShapeQuestions } from "./composer";

/**
 * THE BRAIN SEAM. Everything that writes a requirement goes through this file.
 *
 * Today the scripted, deterministic composer (./composer.ts) implements it so the
 * demo works offline and shows exactly which context produced which sentence.
 * To plug in the real brain (LLM / backend service), implement `Drafter` with the
 * same input and output and return it from `getDrafter()`:
 *
 *   - Input: the case and its signals, the brand profile, the author's resolved
 *     series brief (layer 1), the author's case stance (layer 2), the shape answers
 *     (layer 3), feedback on the previous version (layer 4) and the previous version.
 *   - Output: one or more drafts. EVERY part (each description sentence, each metric
 *     target, each acceptance criterion and assumption, the scope, release and cost)
 *     must carry a Provenance tag: evidence (with signal IDs), pm_context (with the
 *     layer and ref, e.g. "brief.costEnvelope") or assumption. The UI renders these
 *     tags inline; untagged parts are a contract violation.
 *   - The drafter never writes to the store. Handlers turn its output into
 *     requirements, versions or proposals, and write the audit events.
 */

export interface DraftInput {
  case: Case;
  /** All signals of the case (BMW records, web findings, competitor facts). */
  signals: Signal[];
  brand: BrandProfile;
  /** The author's resolved brief; null when the series has no brief yet (everything becomes an assumption). */
  brief: ResolvedBrief | null;
  briefId: string | null;
  author: User;
  /** The author's region decides what "variant" means (CN or RoW). */
  region: Region;
  stance: CaseStance | null;
  answers: ShapeAnswer[];
  /** Feedback entries on the previous version, oldest first. */
  feedback: FeedbackEntry[];
  previous: RequirementSnapshot | null;
  plan: VehiclePlan | null;
  /** Live requirements of the same case (for variants and duplicates). */
  siblings: Requirement[];
  /** Cycle conversion table (labelled assumptions), shared with the competitor ripple. */
  conversions: CycleConversion[];
}

export type Draft = RequirementSnapshot;

export interface DraftOutput {
  drafts: Draft[];
  /** Name and version of the drafter, stored on the requirement ("composer@1", a model id, …). */
  drafter: string;
}

export interface Drafter {
  /** At most 3 adaptive questions, only the ones this case raises for this author. */
  shapeQuestions(input: Omit<DraftInput, "answers" | "feedback" | "previous">): ShapeQuestion[];
  draft(input: DraftInput): DraftOutput | Promise<DraftOutput>;
}

const scripted: Drafter = {
  shapeQuestions: composeShapeQuestions,
  draft: (input) => ({ drafts: composeDrafts(input), drafter: "composer@1" }),
};

export function getDrafter(): Drafter {
  return scripted;
}
