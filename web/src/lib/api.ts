const API_BASE = "/api";

// --- Validation ---

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
