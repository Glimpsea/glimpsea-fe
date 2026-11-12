export type OrderInput = {
  country: string;
  audience: string;
  format: "printable" | "physical";
  productionHours: number;
  sellerNotes?: string;
};

export type TaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_REJECTED"
  | "TASK_STATE_FAILED";

export type Task = {
  id: string;
  status: { state: TaskState; message?: { parts: { text: string }[] } };
  artifacts?: { name: string; parts: { text: string }[] }[];
  metadata: {
    payment: {
      mode: "simulated";
      state: "authorized" | "settled" | "released";
      amount: string;
    };
    research?: {
      provider: "near-ai-cloud" | "fixture";
      usage?: { inputTokens: number; outputTokens: number; model: string; costUsd?: number };
    };
  };
};

export type SimulatedOffer = {
  scheme: "glimpsea-simulation";
  network: "glimpsea:local";
  asset: "USDC";
  amount: string;
  quoteId: string;
  expiresAt: number;
};
