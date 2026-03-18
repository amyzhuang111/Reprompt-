"""Tests for turn1_fitness scorer edge cases."""

from reprompt.services import turn1_fitness


class TestTurn1Fitness:
    def test_factual_grounding(self):
        s = turn1_fitness.score("what are the best running shoes for beginners")
        assert s >= 60  # grounding + self-contained + research initiator

    def test_self_contained(self):
        s = turn1_fitness.score("best desk organizer for home office")
        assert s >= 60  # self-contained + research initiator

    def test_followup_penalty(self):
        s = turn1_fitness.score("can you explain more about that")
        assert s <= 30

    def test_context_reference(self):
        s = turn1_fitness.score("that one you mentioned earlier")
        assert s < 40

    def test_research_initiator(self):
        s = turn1_fitness.score("what are the top rated laptops for college students")
        assert s >= 60

    def test_short_query(self):
        # 4 words or fewer won't get research initiator bonus
        s = turn1_fitness.score("best shoes")
        assert s < 60  # self-contained (30) only — no grounding, no research initiator

    def test_pure_informational_not_penalized(self):
        # Informational but still a valid turn-1
        s = turn1_fitness.score("what are the best ways to save money on groceries")
        assert s >= 60

    def test_elaborate_followup(self):
        s = turn1_fitness.score("elaborate on the previous options")
        assert s <= 20

    def test_those_reference(self):
        s = turn1_fitness.score("which of those is cheaper")
        assert s < 40

    def test_it_subject(self):
        s = turn1_fitness.score("it seems expensive for what you get")
        assert s < 40

    def test_high_scoring_opener(self):
        s = turn1_fitness.score("what are the top rated wireless earbuds for running in 2026")
        assert s == 100  # all three signals: grounding + self-contained + research initiator

    def test_threshold_boolean(self):
        # This should qualify as turn1_optimized (>= 60)
        s = turn1_fitness.score("best laptop for remote software developers who travel")
        assert s >= 60
