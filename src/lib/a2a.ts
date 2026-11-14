export const PRODUCT_CATEGORIES = ["digital", "pod", "personalized"] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  digital: "Digital download",
  pod: "Print-on-demand",
  personalized: "Simple personalization",
};

export type OrderInput = {
  country: string;
  audience: string;
  category?: ProductCategory;
  format?: "printable" | "physical";
  productionHours: number;
  budgetUsd?: number;
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
      mode: "simulated" | "near-testnet";
      txHash?: string;
      state: "authorized" | "settled" | "released";
      amount: string;
    };
    research?: {
      provider: "near-ai-cloud" | "gemini" | "fixture";
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

export type TestnetOffer = {
  scheme: "glimpsea-near-transfer";
  network: "near:testnet";
  asset: "NEAR";
  amount: string;
  quoteId: string;
  expiresAt: number;
  payer: string;
  receiver: string;
};
