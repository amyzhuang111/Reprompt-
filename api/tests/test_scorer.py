"""Tests for individual sub-scorers and composite scorer."""

import pytest

from reprompt.services import lexical, structural, specificity, citation_cluster, turn1_fitness
from reprompt.services.scorer import score_query


class TestLexical:
    def test_transactional_keywords(self):
        assert lexical.score("best running shoes") >= 20

    def test_pure_informational(self):
        assert lexical.score("what is photosynthesis") == 0

    def test_comparison_language(self):
        s = lexical.score("nike vs adidas running shoes")
        assert s >= 15

    def test_product_attributes(self):
        s = lexical.score("shoes under $100 size 10")
        assert s >= 15

    def test_empty_query(self):
        assert lexical.score("") == 0


class TestStructural:
    def test_optimal_length(self):
        # 7 words should score high
        s = structural.score("best ergonomic office chair for developers")
        assert s > 30

    def test_too_short(self):
        s = structural.score("shoes")
        assert s < 30

    def test_modifier_bonus(self):
        s1 = structural.score("office chair for work")
        s2 = structural.score("ergonomic office chair for work")
        assert s2 > s1


class TestSpecificity:
    def test_product_category(self):
        assert specificity.score("laptop for school") >= 30

    def test_price_constraint(self):
        assert specificity.score("something under $200") >= 20

    def test_material(self):
        assert specificity.score("leather wallet") >= 15

    def test_vague_query(self):
        assert specificity.score("help me find something") == 0

    def test_multiple_signals(self):
        s = specificity.score("leather laptop bag under $100 for professionals")
        assert s >= 60


class TestCitationCluster:
    def test_finance_cluster(self):
        name, domains = citation_cluster.identify_cluster("best credit card for travel")
        assert name == "personal_finance"
        assert "NerdWallet" in domains

    def test_tech_cluster(self):
        name, domains = citation_cluster.identify_cluster("best laptop for gaming")
        assert name == "tech_electronics"

    def test_no_cluster(self):
        name, _ = citation_cluster.identify_cluster("meaning of life")
        assert name == ""

    def test_score_high_vertical(self):
        s = citation_cluster.score("best credit card compared by rewards")
        assert s >= 70

    def test_score_informational(self):
        s = citation_cluster.score("what is a credit card")
        assert s <= 50


class TestComposite:
    @pytest.mark.asyncio
    async def test_high_score_query(self):
        bd = await score_query("best ergonomic office chair under $300 for developers", include_proxy=True)
        assert bd.composite >= 40

    @pytest.mark.asyncio
    async def test_low_score_query(self):
        bd = await score_query("what is the meaning of life", include_proxy=True)
        assert bd.composite < 30

    @pytest.mark.asyncio
    async def test_score_range(self):
        bd = await score_query("best laptop for college students", include_proxy=True)
        assert 0 <= bd.composite <= 100
