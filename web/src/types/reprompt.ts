export interface ScoreBreakdown {
  lexical: number;
  structural: number;
  specificity: number;
  shopping_proxy: number;
  citation_cluster: number;
  turn1_fitness: number;
  composite: number;
}

export interface RewriteVariant {
  query: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  strategy: string;
  predicted_categories: string[];
  proxy_signals: Record<string, number>;
  citation_cluster: string;
  co_citation_neighbors: string[];
  turn1_optimized: boolean;
}

export interface RewriteResponse {
  original_query: string;
  original_score: number;
  original_breakdown: ScoreBreakdown;
  rewrites: RewriteVariant[];
  metadata: Record<string, string | number>;
}

export interface StrategyInfo {
  key: string;
  name: string;
  description: string;
  example: string;
}

export interface BasketResult {
  basket_name: string;
  prompt_count: number;
  avg_original_score: number;
  avg_best_rewrite_score: number;
  avg_lift: number;
  results: RewriteResponse[];
}
