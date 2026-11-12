import { runBuyer } from "../src/lib/buyer";

const endpoint = process.env.GLIMPSEA_A2A_URL || "http://127.0.0.1:3000/a2a/v1";
const expectedProvider = process.argv.includes("--require-cloud") ? "near-ai-cloud" : undefined;

try {
  const task = await runBuyer({ endpoint, onEvent: (event) => console.error(event.detail) });
  const text = task.artifacts?.[0]?.parts[0]?.text;
  console.error("Task", task.id);
  if (task.status.state !== "TASK_STATE_COMPLETED" || !text || task.metadata.payment.state !== "settled") {
    throw new Error("The buyer agent did not receive a completed brief.");
  }
  if (expectedProvider && task.metadata.research?.provider !== expectedProvider) {
    throw new Error("The brief did not come from NEAR AI Cloud.");
  }
  console.error("Research provider:", task.metadata.research?.provider);
  console.log(text);
} catch (error) {
  console.error(error instanceof Error ? error.message : "The demo failed.");
  process.exitCode = 1;
}
