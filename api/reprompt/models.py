from pydantic import BaseModel, Field


# --- Request models ---

class RewriteRequest(BaseModel):
    query: str
    num_variants: int = Field(default=8, ge=1, le=15)
    strategies: list[str] = Field(default=["all"])
    product_category: str | None = None
    include_proxy_scores: bool = True


class BatchRewriteRequest(BaseModel):
    queries: list[str]


class BasketRunRequest(BaseModel):
    name: str


# --- Sub-score detail ---

class ScoreBreakdown(BaseModel):
    lexical: int = 0
    structural: int = 0
    specificity: int = 0
    shopping_proxy: int = 0
    citation_cluster: int = 0
    turn1_fitness: int = 0
    composite: int = 0


# --- Rewrite result ---

class RewriteVariant(BaseModel):
    query: str
    score: int
    score_breakdown: ScoreBreakdown
    strategy: str
    predicted_categories: list[str] = []
    proxy_signals: dict = {}
    citation_cluster: str = ""
    co_citation_neighbors: list[str] = []
    turn1_optimized: bool = False


# --- Response models ---

class RewriteResponse(BaseModel):
    original_query: str
    original_score: int
    original_breakdown: ScoreBreakdown
    rewrites: list[RewriteVariant]
    metadata: dict = {}


class StrategyInfo(BaseModel):
    key: str
    name: str
    description: str
    example: str


class BasketPrompt(BaseModel):
    query: str
    cluster: str
    intent: str
    expected_trigger: bool = False


class BasketResult(BaseModel):
    basket_name: str
    prompt_count: int
    avg_original_score: float
    avg_best_rewrite_score: float
    avg_lift: float
    results: list[RewriteResponse]
