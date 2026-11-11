export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type StateUpdate =
  | { op: "add" | "replace"; path: string; value: JsonValue }
  | { op: "remove"; path: string; value?: never };

export type SemanticEvent = { type: string; data?: JsonObject };
export type InitialRecord = { type: "initial"; version: 1; state: JsonObject };
export type StepRecord = { type: "step"; updates: StateUpdate[]; events?: SemanticEvent[] };
export type TraceRecords = [InitialRecord, ...StepRecord[]];

export type ItemBinding = { label: string; value: string; nullLabel?: string };
type View = { id: string; source: string };
export type ViewSpec = (View & { type: "graph" }) | (View & { type: "array"; item?: ItemBinding });
export type VisualizationSpec = { version: 1; layout: "row" | "column"; views: ViewSpec[] };
export type GraphViewData = {
  nodes: { id: string; label?: string; status?: string }[];
  edges: { id: string; source: string; target: string; label?: JsonValue }[];
};

export type ReplayFrame = { step: number; state: JsonObject; events: SemanticEvent[] };
export type ReplayOptions = { traceSource?: string; specText?: string; specSource?: string };
export type ReplayLocation = { source: string; line?: number; operationIndex?: number; path?: string; viewId?: string };
export type StateChange =
  | { kind: "added"; path: string; after: JsonValue }
  | { kind: "removed"; path: string; before: JsonValue }
  | { kind: "changed"; path: string; before: JsonValue; after: JsonValue };
