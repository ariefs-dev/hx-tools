from pathlib import Path

from hx_cli import codec, diff, edit, model

FIXTURE = Path(__file__).parent / "fixtures" / "minimal_preset.hlx"


def _load():
    return codec.loads(FIXTURE.read_text(encoding="utf-8"))


def test_preset_name():
    assert model.preset_name(_load()) == "Test Patch"


def test_ordered_blocks_sorted_by_position():
    data = _load()
    dsp = model.dsp_paths(data)["dsp0"]
    keys = [key for key, _ in model.ordered_blocks(dsp)]
    assert keys == ["inputA", "block0", "cab0", "outputA"]


def test_snapshots_lists_both_in_order():
    data = _load()
    names = [snap["@name"] for _, snap in model.snapshots(data)]
    assert names == ["SNAPSHOT 1", "LEAD"]


def test_diff_snapshots_finds_the_bypass_state_change():
    data = _load()
    diffs = diff.diff_snapshots(data, "snapshot0", "snapshot1")
    paths = [p for p, _, _ in diffs]
    assert "blocks.dsp0.block0" in paths


def test_set_param_rejects_unknown_parameter():
    data = _load()
    try:
        edit.set_param(data, "dsp0", "block0", "NotAParam", 1)
        assert False, "expected KeyError"
    except KeyError:
        pass


def test_set_param_updates_value_in_place():
    data = _load()
    edit.set_param(data, "dsp0", "block0", "Drive", 0.42)
    assert data["data"]["tone"]["dsp0"]["block0"]["Drive"] == 0.42
