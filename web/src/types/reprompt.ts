export interface ScoreBreakdown {
  category: string;
  category_base_rate: number;
  commercial_intent: number;
  product_specificity: number;
  composite: number;
}

export interface SignalDetail {
  score: number;
  found: string;
  missing?: string;
  improve?: string;
}

export interface AuditResult {
  url: string | null;
  product_name: string;
  product_category: string;
  shopping_base_rate: number;
  amazon_test: "PASS" | "FAIL";
  signals: Record<string, SignalDetail>;
  overall_score: number;
  top_strengths: string[];
  critical_gaps: string[];
  sample_queries: string[];
  one_line_verdict: string;
}

export interface UnsolicitedRecResult {
  product_name: string;
  product_category: string;
  unsolicited_rec_score: number;
  current_trend: string;
  signals: {
    category_fit: SignalDetail;
    information_density: SignalDetail;
    problem_solution_framing: SignalDetail;
    scenario_coverage: SignalDetail;
    trust_signals: SignalDetail;
    implicit_recommendation: SignalDetail;
  };
  informational_queries: string[];
  optimization_recommendations: string[];
  verdict: string;
}

export interface CoCitationResult {
  brand_or_product: string;
  category: string;
  primary_cluster: {
    name: string;
    co_citation_rate: number;
    anchor_domains: string[];
  };
  alignment_score: number;
  content_signals: {
    cluster_keyword_match: SignalDetail;
    editorial_voice: SignalDetail;
    comparison_depth: SignalDetail;
    source_triangulation: SignalDetail;
    vertical_authority: SignalDetail;
  };
  positioning_recommendations: string[];
  competitor_domains: string[];
  target_queries: string[];
  verdict: string;
}
