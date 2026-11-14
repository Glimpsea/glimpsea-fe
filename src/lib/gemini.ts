import { asObject, BriefValidationError, requireText } from "./product-research";

export const defaultGeminiModel = "gemini-3.1-flash-lite";

export async function generateGeminiJson({
  key, model, prompt, input, schema, maxOutputTokens = 4096, signal = AbortSignal.timeout(35_000),
}: {
  key: string;
  model: string;
  prompt: string;
  input: object;
  schema?: object;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal,
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          maxOutputTokens,
          responseMimeType: "application/json",
          ...(schema && { responseJsonSchema: schema }),
        },
      }),
    });
  } catch {
    throw new Error(signal.aborted ? "Gemini request timed out." : "Gemini request failed.");
  }
  if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}.`);
  const result = asObject(await response.json());
  const candidate = asObject(Array.isArray(result.candidates) ? result.candidates[0] : undefined);
  if (candidate.finishReason !== "STOP") throw new BriefValidationError("Gemini did not return a complete response.");
  const { parts } = asObject(candidate.content);
  if (!Array.isArray(parts)) throw new BriefValidationError("Gemini returned no content.");
  const content = parts.map(asObject).filter((part) => !part.thought).map((part) => part.text).join("");
  const usage = result.usageMetadata ? asObject(result.usageMetadata) : {};
  const { promptTokenCount: inputTokens, candidatesTokenCount: outputTokens } = usage;
  return {
    data: JSON.parse(requireText(content, 20_000)) as unknown,
    usage: typeof inputTokens === "number" && typeof outputTokens === "number" ? {
      model: typeof result.modelVersion === "string" ? result.modelVersion : model,
      inputTokens,
      outputTokens: outputTokens + (typeof usage.thoughtsTokenCount === "number" ? usage.thoughtsTokenCount : 0),
    } : undefined,
  };
}
