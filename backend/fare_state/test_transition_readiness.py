from transition_readiness import (
    Observation,
    comparable_pair,
    classify_price_change,
    match_repeated_snapshots,
    summarize_comparisons,
)


def make_observation(
    observation_id,
    search_timestamp,
    total_fare=3500,
    fare_family="Saver",
    flight_number="6E1234",
    source="indigo",
    target_lead_days=1,
):
    return Observation(
        observation_id=observation_id,
        run_id="test_run",
        source=source,
        origin="DEL",
        destination="BOM",
        departure_datetime="2026-09-15T10:00:00+05:30",
        arrival_datetime="2026-09-15T12:00:00+05:30",
        flight_number=flight_number,
        carrier_code="6E",
        flight_id="flight_1234",
        journey_id="journey_1234",
        fare_product_class="B",
        fare_class="B",
        fare_family=fare_family,
        fare_availability_key="KEY-" + fare_family,
        source_offer_id="OFFER-" + fare_family,
        total_fare=total_fare,
        is_sold=False,
        passenger_type="ADT",
        search_timestamp=search_timestamp,
        target_lead_days=target_lead_days,
    )


def test_same_fare_matches():
    old = make_observation(
        "old-1",
        "2026-09-14T12:00:00+05:30",
    )

    new = make_observation(
        "new-1",
        "2026-09-14T17:20:00+05:30",
        total_fare=3800,
    )

    assert comparable_pair(old, new) is True


def test_same_target_lead_days_match():
    old = make_observation("old-1", "2026-09-14T12:00:00+05:30", target_lead_days=1)
    new = make_observation("new-1", "2026-09-14T17:20:00+05:30", target_lead_days=1)

    assert comparable_pair(old, new) is True


def test_same_target_lead_days_match_for_other_horizon():
    old = make_observation("old-1", "2026-09-14T12:00:00+05:30", target_lead_days=7)
    new = make_observation("new-1", "2026-09-14T17:20:00+05:30", target_lead_days=7)

    assert comparable_pair(old, new) is True


def test_different_target_lead_days_do_not_match():
    old = make_observation("old-1", "2026-09-14T12:00:00+05:30", target_lead_days=1)
    new = make_observation("new-1", "2026-09-14T17:20:00+05:30", target_lead_days=7)

    assert comparable_pair(old, new) is False


def test_reverse_different_target_lead_days_do_not_match():
    old = make_observation("old-1", "2026-09-14T12:00:00+05:30", target_lead_days=7)
    new = make_observation("new-1", "2026-09-14T17:20:00+05:30", target_lead_days=1)

    assert comparable_pair(old, new) is False


def test_different_route_does_not_match():
    old = make_observation(
        "old-1",
        "2026-09-14T12:00:00+05:30",
    )

    new = make_observation(
        "new-1",
        "2026-09-14T17:20:00+05:30",
    )

    new = Observation(
        **{
            **new.__dict__,
            "destination": "BLR",
        }
    )

    assert comparable_pair(old, new) is False


def test_different_fare_family_does_not_match():
    old = make_observation(
        "old-1",
        "2026-09-14T12:00:00+05:30",
        fare_family="Saver",
    )

    new = make_observation(
        "new-1",
        "2026-09-14T17:20:00+05:30",
        fare_family="Flex",
    )

    assert comparable_pair(old, new) is False


def test_same_price_is_unchanged():
    result = classify_price_change(
        3500,
        3500,
    )

    assert result == "UNCHANGED"


def test_price_increase():
    result = classify_price_change(
        3500,
        3800,
    )

    assert result == "PRICE_INCREASE"


def test_price_decrease():
    result = classify_price_change(
        3500,
        3200,
    )

    assert result == "PRICE_DECREASE"


def test_missing_price_not_checkable():
    result = classify_price_change(
        None,
        3500,
    )

    assert result == "PRICE_NOT_CHECKABLE"


def test_repeated_snapshot_matching():
    old = [
        make_observation(
            "old-1",
            "2026-09-14T12:00:00+05:30",
            total_fare=3500,
        ),
        make_observation(
            "old-2",
            "2026-09-14T12:00:00+05:30",
            total_fare=4200,
            fare_family="Flex",
        ),
    ]

    new = [
        make_observation(
            "new-1",
            "2026-09-14T17:20:00+05:30",
            total_fare=3800,
        ),
        make_observation(
            "new-2",
            "2026-09-14T17:20:00+05:30",
            total_fare=4500,
            fare_family="Flex",
        ),
    ]

    result = match_repeated_snapshots(
        old,
        new,
    )

    assert result["old_count"] == 2
    assert result["new_count"] == 2
    assert result["matched_count"] == 2
    assert result["old_unmatched_count"] == 0
    assert result["new_unmatched_count"] == 0


def test_summary():
    comparisons = [
        {
            "price_change_type": "UNCHANGED",
        },
        {
            "price_change_type": "PRICE_INCREASE",
        },
        {
            "price_change_type": "PRICE_DECREASE",
        },
        {
            "price_change_type": "PRICE_NOT_CHECKABLE",
        },
    ]

    result = summarize_comparisons(comparisons)

    assert result["matched"] == 4
    assert result["unchanged"] == 1
    assert result["price_increase"] == 1
    assert result["price_decrease"] == 1
    assert result["price_not_checkable"] == 1


if __name__ == "__main__":
    tests = [
        test_same_fare_matches,
        test_same_target_lead_days_match,
        test_same_target_lead_days_match_for_other_horizon,
        test_different_target_lead_days_do_not_match,
        test_reverse_different_target_lead_days_do_not_match,
        test_different_route_does_not_match,
        test_different_fare_family_does_not_match,
        test_same_price_is_unchanged,
        test_price_increase,
        test_price_decrease,
        test_missing_price_not_checkable,
        test_repeated_snapshot_matching,
        test_summary,
    ]

    for test in tests:
        test()

    print("ALL TRANSITION READINESS TESTS PASSED")
    print(f"Tests passed: {len(tests)}")