// Shared source documents and reviewed proposal for authoring and MCP tests.
export const spec = "migration-test";
export const storyDoc = `${spec}-user-stories.feature`;
export const caseDoc = `${spec}-use-cases.feature`;
export const oldStory = "# Stories\n## US-1: Review\nActor: Author\nGoal: Inspect\nBenefit: Safety\n";
export const oldCase = "# Cases\n## UC-1: Review\nStory: US-1\nActor: Author\n";
export const oldFeature = "Feature: Preview\n  @id:SCEN-preview\n  Scenario: Show\n    Given one edit\n    When the author requests preview\n    Then the diff appears\n";
export const story = `Feature: Stories
  Context: Feature Preview
  @story:US-1
  Rule: Review
    Actor: Author
    Goal: Inspect
    Benefit: Safety
    @id:SCEN-preview
    Scenario: Show
      Given one edit
      When the author requests preview
      Then the diff appears
`;
export const useCase = `Feature: Cases
  @case:UC-1 @story:US-1
  Rule: Review
    Actor: Author
    Boundary: MCP
    Trigger: Request
    Precondition: An edit exists
    Success: The diff appears
    Step: inspect | Inspect the edit
    Branch: ok | inspect | An edit exists | The diff appears | end
    ScenarioRef: ok | SCEN-preview
`;

export function migrationInput({ snapshot, files }) {
  const hashes = Object.fromEntries(files.map((file) => [file.path, file.sha256]));
  const map = (sourceDocument, sourceStartLine, sourceEndLine, targetDocument, targetStartLine, targetEndLine) => ({
    sourceDocument, sourceSha256: hashes[sourceDocument], sourceStartLine, sourceEndLine,
    targetDocument, targetStartLine, targetEndLine,
  });
  return {
    intent: "migrateSpec", spec, requestId: "migration-1", reason: "Migrate the selected spec",
    snapshot,
    mapping: [
      map("USER_STORIES.md", 1, 1, storyDoc, 1, 1),
      map("USER_STORIES.md", 2, 5, storyDoc, 3, 7),
      map("USE_CASES.md", 1, 1, caseDoc, 1, 1),
      map("USE_CASES.md", 2, 4, caseDoc, 2, 4),
      map(`${spec}.feature`, 1, 1, storyDoc, 1, 2),
      map(`${spec}.feature`, 2, 6, storyDoc, 8, 12),
    ],
    fieldDecisions: Object.entries({ Boundary: "MCP", Trigger: "Request", Precondition: "An edit exists", Success: "The diff appears",
      "Step:inspect": "Inspect the edit", "Branch:ok": "inspect | An edit exists | The diff appears | end", "ScenarioRef:ok": "SCEN-preview" })
      .map(([field, value]) => ({ entityId: "UC-1", field, value, reason: "Test owner approved the case field",
        sourceDocument: "USE_CASES.md", sourceSha256: hashes["USE_CASES.md"], sourceStartLine: 2, sourceEndLine: 4 })),
    operations: [
      { kind: "replace_document", document: storyDoc, content: story },
      { kind: "replace_document", document: caseDoc, content: useCase },
    ],
  };
}
