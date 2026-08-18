"""Exercises the MCP tool functions directly (bypassing the wire protocol) —
the @server.tool() decorator returns the original callable unchanged, so
these are plain function calls against real fixture data.
"""

import shutil
from pathlib import Path

import pytest

from hx_mcp import server

FIXTURE = Path(__file__).parents[1] / "tests" / "fixtures" / "minimal_preset.hlx"


def test_read_preset_structure():
    result = server.read_preset(str(FIXTURE))
    assert result["name"] == "Test Patch"
    assert [b["slot"] for b in result["paths"]["dsp0"]] == ["inputA", "block0", "cab0", "outputA"]
    assert result["snapshots"] == [
        {"key": "snapshot0", "name": "SNAPSHOT 1"},
        {"key": "snapshot1", "name": "LEAD"},
    ]


def test_explain_preset_returns_text():
    text = server.explain_preset(str(FIXTURE))
    assert "Test Patch" in text
    assert "HD2_AmpLine6Fatality" in text


def test_list_snapshots():
    assert server.list_snapshots(str(FIXTURE)) == [
        {"key": "snapshot0", "name": "SNAPSHOT 1"},
        {"key": "snapshot1", "name": "LEAD"},
    ]


def test_diff_snapshots_reports_bypass_change():
    diffs = server.diff_snapshots(str(FIXTURE), "snapshot0", "snapshot1")
    paths = [d["path"] for d in diffs]
    assert "blocks.dsp0.block0" in paths


def test_diff_snapshots_unknown_key_raises_value_error():
    with pytest.raises(ValueError):
        server.diff_snapshots(str(FIXTURE), "snapshot0", "snapshot99")


def test_validate_preset_ok_on_fixture():
    assert server.validate_preset(str(FIXTURE)) == {"path": str(FIXTURE), "roundtrips_byte_exact": True}


def test_get_param_reads_existing_value():
    assert server.get_param(str(FIXTURE), "dsp0", "block0", "Drive") == 0.75


def test_get_param_unknown_param_raises_value_error():
    with pytest.raises(ValueError):
        server.get_param(str(FIXTURE), "dsp0", "block0", "NotAParam")


def test_set_param_writes_change_and_reports_before_after(tmp_path):
    work = tmp_path / "preset.hlx"
    shutil.copy(FIXTURE, work)

    result = server.set_param(str(work), "dsp0", "block0", "Drive", 0.42)

    assert result == {
        "path": str(work),
        "dsp": "dsp0",
        "block": "block0",
        "param": "Drive",
        "before": 0.75,
        "after": 0.42,
    }
    assert server.get_param(str(work), "dsp0", "block0", "Drive") == 0.42
    assert (tmp_path / "preset.hlx.bak").exists()


def test_set_param_no_backup_skips_bak_file(tmp_path):
    work = tmp_path / "preset.hlx"
    shutil.copy(FIXTURE, work)

    server.set_param(str(work), "dsp0", "block0", "Drive", 0.42, backup=False)

    assert not (tmp_path / "preset.hlx.bak").exists()


def test_read_preset_missing_file_raises_value_error():
    with pytest.raises(ValueError):
        server.read_preset(str(FIXTURE.parent / "does_not_exist.hlx"))
