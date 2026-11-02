import pytest
from app.ai.priority import detect_priority, is_emergency


@pytest.mark.parametrize(
    "negated_text, description",
    [
        ("There is no fire, only smoke from burning leaves in the garden.", "no fire, only smoke"),
        ("There is no flood in our colony, just minor water logging on footpath.", "there is no flood"),
        ("The kitchen fire has been extinguished by the building guards.", "fire extinguished"),
        ("Small fire is under control now, no danger remains.", "fire under control"),
        ("A serious accident was averted at the junction thanks to newly painted markings.", "accident averted"),
        ("Building was inspected by engineers and has no collapse risk whatsoever.", "no collapse risk"),
        ("Minor bike scrape occurred with no casualties or death reported.", "no casualties or death"),
        ("Flood waters have receded completely, only silt remains on the avenue.", "flood receded"),
        ("Minor smoke seen in the vacant plot, absolutely no fire.", "minor smoke, no fire"),
        ("This is not an emergency, just routine maintenance required on street lights.", "not an emergency"),
        ("Electrician checked the pole, there is no electrocution danger at all.", "no electrocution danger"),
        ("Gas leak was resolved by technician earlier this morning.", "gas leak resolved"),
        ("It was a routine mock drill only, not a real fire in the school.", "mock drill"),
        ("False alarm about an explosion, nothing happened in the market.", "false alarm explosion"),
        ("Sewage is not overflowing anymore, maintenance crew already fixed the valve.", "sewage not overflowing"),
        ("Landslide was prevented due to newly built concrete retaining wall.", "landslide prevented"),
        ("Smoke seen drifting in sky but zero fire hazard in residential sector.", "zero fire hazard"),
        ("Bridge was reinforced and there is zero risk of bridge collapse.", "zero risk of collapse"),
        ("No death or serious injury, just minor fender bender at the traffic signal.", "no death or injury"),
        ("Water logging cleared overnight, no flood condition exists.", "water cleared, no flood"),
        ("koi aag nahi lagi hai, sirf thoda kachra jala tha", "Hindi: no fire"),
        ("thee illai, verum pugai mattum thaan varugiradhu", "Tamil: no fire, only smoke"),
    ],
)
def test_negated_and_resolved_cases_are_not_critical(negated_text, description):
    result = detect_priority(negated_text)
    assert result["urgency"] != "critical", f"Failed for '{description}': got {result['urgency']}"
    assert not is_emergency(result), f"Emergency flagged for negated case: {description}"


@pytest.mark.parametrize(
    "critical_text, description",
    [
        ("Active raging fire in residential apartment complex people trapped inside!", "Active fire emergency"),
        ("Severe flash flood water gushing into homes water level at four feet!", "Active flood disaster"),
        ("Live 440V electric wire snapped and hanging across waterlogged street electrocution imminent!", "Live wire electrocution"),
        ("Bridge collapse on arterial highway vehicles fallen into river!", "Bridge collapse"),
        ("Major industrial gas leak toxic fumes spreading rapidly in residential area!", "Major gas leak"),
    ],
)
def test_genuine_critical_cases_are_flagged_critical(critical_text, description):
    result = detect_priority(critical_text)
    assert result["urgency"] == "critical", f"Failed to detect critical for '{description}'"
    assert is_emergency(result) is True
