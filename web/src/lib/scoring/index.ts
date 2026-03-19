// Composite scorer

import * as lexical from "./lexical";
import * as structural from "./structural";
import * as specificity from "./specificity";
import * as shoppingProxy from "./shopping-proxy";
import * as citationCluster from "./citation-cluster";
import * as turn1Fitness from "./turn1-fitness";

export interface ScoreBreakdown {
  lexical: number;
  structural: number;
  specificity: number;
  shopping_proxy: number;
  citation_cluster: number;
  turn1_fitness: number;
  composite: number;
}

// Weights from ground-truth grid search
const W_LEXICAL = 0.20;
const W_STRUCTURAL = 0.05;
const W_SPECIFICITY = 0.15;
const W_SHOPPING = 0.35;
const W_CITATION = 0.05;
const W_TURN1 = 0.20;

export function scoreQuery(query: string): ScoreBreakdown {
  const lex = lexical.score(query);
  const struct = structural.score(query);
  const spec = specificity.score(query);
  const shop = shoppingProxy.scoreQuery(query);
  const cite = citationCluster.score(query);
  const t1 = turn1Fitness.score(query);

  const composite = Math.max(0, Math.min(100, Math.floor(
    W_LEXICAL * lex +
    W_STRUCTURAL * struct +
    W_SPECIFICITY * spec +
    W_SHOPPING * shop +
    W_CITATION * cite +
    W_TURN1 * t1
  )));

  return { lexical: lex, structural: struct, specificity: spec, shopping_proxy: shop, citation_cluster: cite, turn1_fitness: t1, composite };
}

export { identifyCluster } from "./citation-cluster";
export { score as turn1Score } from "./turn1-fitness";
