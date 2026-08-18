from pathlib import Path

from hx_cli import codec

FIXTURE = Path(__file__).parent / "fixtures" / "minimal_preset.hlx"


def test_roundtrip_byte_exact():
    original = FIXTURE.read_text(encoding="utf-8")
    data = codec.loads(original)
    dumped = codec.dumps(data)
    assert dumped == original.rstrip("\n")


def test_float_uses_full_precision():
    assert codec.dumps(0.64999997615814209) == "0.64999997615814209"


def test_bool_is_lowercase_and_not_confused_with_int():
    assert codec.dumps(True) == "true"
    assert codec.dumps(False) == "false"


def test_int_has_no_decimal_point():
    assert codec.dumps(120) == "120"


def test_key_value_separator_has_space_before_colon():
    assert codec.dumps({"a": 1}) == '{\n  "a" : 1\n}'
