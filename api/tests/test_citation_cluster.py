"""Tests for citation cluster identification and scoring."""

from reprompt.services import citation_cluster


class TestClusterIdentification:
    def test_finance_keywords(self):
        name, domains = citation_cluster.identify_cluster("best savings account interest rate")
        assert name == "personal_finance"
        assert len(domains) >= 3

    def test_tech_keywords(self):
        name, domains = citation_cluster.identify_cluster("best gaming headphone and keyboard")
        assert name == "tech_electronics"

    def test_health_keywords(self):
        name, domains = citation_cluster.identify_cluster("best vitamin supplement for health")
        assert name == "health_wellness"

    def test_home_keywords(self):
        name, domains = citation_cluster.identify_cluster("best sofa for living room")
        assert name == "home_lifestyle"

    def test_travel_keywords(self):
        name, domains = citation_cluster.identify_cluster("best hotel for vacation travel")
        assert name == "travel"

    def test_no_match(self):
        name, domains = citation_cluster.identify_cluster("how to learn calculus")
        assert name == ""
        assert domains == []


class TestClusterScoring:
    def test_high_score(self):
        s = citation_cluster.score("best travel credit cards compared by annual fee and rewards")
        assert s >= 70

    def test_medium_score(self):
        s = citation_cluster.score("best laptop for students")
        assert s >= 40

    def test_low_score(self):
        s = citation_cluster.score("what is the history of the internet")
        assert s <= 20
