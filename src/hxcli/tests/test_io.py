import shutil
from pathlib import Path

from hx_cli import edit, io

FIXTURE = Path(__file__).parent / "fixtures" / "minimal_preset.hlx"


def test_load_then_save_unmodified_is_byte_identical(tmp_path):
    work = tmp_path / "preset.hlx"
    shutil.copy(FIXTURE, work)
    original = work.read_bytes()

    preset = io.load(work)
    assert io.verify_roundtrip(preset)

    io.save(preset, backup=False)
    assert work.read_bytes() == original


def test_save_writes_backup_of_previous_contents(tmp_path):
    work = tmp_path / "preset.hlx"
    shutil.copy(FIXTURE, work)
    original = work.read_bytes()

    preset = io.load(work)
    edit.set_param(preset.data, "dsp0", "block0", "Drive", 0.9)
    io.save(preset, backup=True)

    backup = work.with_name(work.name + ".bak")
    assert backup.read_bytes() == original


def test_save_to_different_path_leaves_source_untouched(tmp_path):
    work = tmp_path / "preset.hlx"
    shutil.copy(FIXTURE, work)
    original = work.read_bytes()
    out = tmp_path / "edited.hlx"

    preset = io.load(work)
    edit.set_param(preset.data, "dsp0", "block0", "Drive", 0.9)
    io.save(preset, path=out, backup=False)

    assert work.read_bytes() == original
    assert out.exists()
