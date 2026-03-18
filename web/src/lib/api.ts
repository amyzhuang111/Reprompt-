import type {
  RewriteResponse,
  RewriteVariant,
  ScoreBreakdown,
  StrategyInfo,
  BasketResult,
} from "@/types/reprompt";

const API_BASE = "http://localhost:8000";

// --- Streaming rewrite ---

export interface StreamCallbacks {
  onOriginal: (query: string, score: number, breakdown: ScoreBreakdown) => void;
  onRewrite: (variant: RewriteVariant) => void;
  onDone: (metadata: Record<string, string | number>) => void;
  onError: (error: string) => void;
}

export async function rewriteQueryStream(
  query: string,
  numVariants: number,
  callbacks: StreamCallbacks
) {
  const res = await fetch(`${API_BASE}/rewrite/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      num_variants: numVariants,
      strategies: ["all"],
      include_proxy_scores: true,
    }),
  });

  if (!res.ok) {
    callbacks.onError(`API error: ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;

      try {
        const event = JSON.parse(payload);
        if (event.type === "original") {
          callbacks.onOriginal(
            event.original_query,
            event.original_score,
            event.original_breakdown
          );
        } else if (event.type === "rewrite") {
          callbacks.onRewrite(event.variant);
        } else if (event.type === "done") {
          callbacks.onDone(event.metadata);
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}

// --- Non-streaming fallback ---

export async function rewriteQuery(
  query: string,
  numVariants = 8
): Promise<RewriteResponse> {
  const res = await fetch(`${API_BASE}/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      num_variants: numVariants,
      strategies: ["all"],
      include_proxy_scores: true,
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function batchRewrite(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/rewrite/batch`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.blob();
}

export async function getStrategies(): Promise<StrategyInfo[]> {
  const res = await fetch(`${API_BASE}/strategies`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getBaskets(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/baskets`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface ValidationResult {
  query: string;
  chatgpt_response: string;
  has_product_recs: boolean;
  product_count: number;
  has_prices: boolean;
  has_comparisons: boolean;
  has_specific_brands: boolean;
  product_names: string[];
  confidence: number;
  trigger_score: number;
  heuristic_score: number;
  model: string;
}

export interface ValidationStats {
  total: number;
  triggered?: number;
  trigger_rate?: number;
  avg_trigger_score?: number;
  avg_heuristic_score?: number;
  avg_heuristic_when_triggered?: number;
  avg_heuristic_when_not_triggered?: number;
}

export async function validateQuery(query: string): Promise<ValidationResult> {
  const res = await fetch(`${API_BASE}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function validateBatch(
  queries: string[]
): Promise<{ results: ValidationResult[]; count: number }> {
  const res = await fetch(`${API_BASE}/validate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getValidationStats(): Promise<ValidationStats> {
  const res = await fetch(`${API_BASE}/validate/stats`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getRecentValidations(
  limit = 50
): Promise<ValidationResult[]> {
  const res = await fetch(`${API_BASE}/validate/recent?limit=${limit}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function runBasket(name: string): Promise<BasketResult> {
  const res = await fetch(`${API_BASE}/baskets/${name}/run`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
