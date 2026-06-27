#!/usr/bin/env python3
"""
pcoc-agent calibration A/B runner.

Runs a candidate skill version (B) against a baseline (A) over a set of
golden cases, scoring each output, and producing a JSON report.

Two scoring modes per case:
  1. Programmatic: deterministic checks declared in the case YAML
     (e.g., must_contain, must_not_contain, max_tokens).
  2. LLM-as-judge: rubric dimensions scored 1-10 by a separate judge LLM.

The judge LLM is NEVER the same instance that produced the candidates.

Usage:
  python3 calibration/ab_runner.py \\
      --skill pcoc-fengchao-style \\
      --version-a baseline \\
      --version-b staging \\
      --output calibration/results/pcoc-fengchao-style_$(date +%Y%m%d_%H%M%S).json

Exit codes:
  0  ran to completion (recommendation in JSON)
  1  setup error (missing golden cases, missing skill files)
  2  runner crash during execution
"""
import argparse
import json
import os
import sys
import time
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# YAML parsing — we use PyYAML if available, else a tiny fallback for the
# subset of YAML we actually use in golden case files.
# ---------------------------------------------------------------------------
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


def parse_yaml(text):
    if HAS_YAML:
        return yaml.safe_load(text)
    # Minimal fallback — only handles flat-ish dicts. Sufficient for cases
    # but encourage installing PyYAML for production use.
    result = {}
    current_list_key = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if not line.startswith(" "):
            if ":" in line:
                key, _, val = line.partition(":")
                val = val.strip()
                if val:
                    result[key.strip()] = val.strip("\"'")
                else:
                    result[key.strip()] = []
                    current_list_key = key.strip()
        elif current_list_key and line.lstrip().startswith("- "):
            item = line.lstrip()[2:].strip().strip("\"'")
            if isinstance(result[current_list_key], list):
                result[current_list_key].append(item)
    return result


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def shannon_entropy(s):
    if not s:
        return 0.0
    counts = Counter(s)
    total = len(s)
    return -sum((c/total) * math.log2(c/total) for c in counts.values())


def programmatic_score(case, output):
    """Returns (score_0_to_10, failure_modes)."""
    score = 10.0
    failures = []

    checks = case.get("programmatic_checks", {})
    if isinstance(checks, dict):
        # must_contain — each missing term deducts 2
        for term in checks.get("must_contain", []) or []:
            if term and term not in output:
                score -= 2.0
                failures.append(f"missing required term: {term[:40]}")

        # must_not_contain — each forbidden term present deducts 3
        for term in checks.get("must_not_contain", []) or []:
            if term and term in output:
                score -= 3.0
                failures.append(f"forbidden term present: {term[:40]}")

        # max_chars — over budget deducts proportionally
        max_chars = checks.get("max_chars")
        if max_chars and len(output) > int(max_chars):
            over = (len(output) - int(max_chars)) / int(max_chars)
            score -= min(3.0, over * 5)
            failures.append(f"length {len(output)} > max_chars {max_chars}")

        # min_chars — too short deducts
        min_chars = checks.get("min_chars")
        if min_chars and len(output) < int(min_chars):
            score -= 2.0
            failures.append(f"length {len(output)} < min_chars {min_chars}")

    return max(0.0, score), failures


def llm_judge_score(case, output_a, output_b, judge_model):
    """
    Calls a judge LLM to score outputs per rubric.
    Stub: in this open-source baseline, we return a deterministic
    placeholder. Override this function by setting PCOC_JUDGE_FN env
    var to a Python dotted path of your own implementation, e.g.:
        export PCOC_JUDGE_FN=overlays.my-work.judge:score
    """
    custom = os.environ.get("PCOC_JUDGE_FN")
    if custom:
        try:
            mod_path, _, fn_name = custom.rpartition(":")
            import importlib
            module = importlib.import_module(mod_path)
            fn = getattr(module, fn_name)
            return fn(case, output_a, output_b, judge_model)
        except Exception as e:
            print(f"[warn] custom judge failed ({e}); falling back to placeholder",
                  file=sys.stderr)

    # Placeholder: simple heuristic based on length similarity to expected.
    expected_len = case.get("expected_length_hint", 500)
    a_dev = abs(len(output_a) - expected_len) / expected_len
    b_dev = abs(len(output_b) - expected_len) / expected_len
    a_score = max(0, 10 - a_dev * 10)
    b_score = max(0, 10 - b_dev * 10)
    return {"a": round(a_score, 1), "b": round(b_score, 1),
            "method": "placeholder",
            "note": "Set PCOC_JUDGE_FN env var to use a real judge."}


# ---------------------------------------------------------------------------
# Candidate generation
# ---------------------------------------------------------------------------
def generate_outputs_for_case(case, version_a_path, version_b_path):
    """
    Produces (output_a, output_b) for a case under both skill versions.

    In a real install this would invoke the LLM with the trigger prompt
    while having loaded the respective SKILL.md as system context. We
    stub it here to make the runner self-contained — overlays can set
    PCOC_GEN_FN to provide a real implementation.
    """
    custom = os.environ.get("PCOC_GEN_FN")
    if custom:
        try:
            mod_path, _, fn_name = custom.rpartition(":")
            import importlib
            module = importlib.import_module(mod_path)
            fn = getattr(module, fn_name)
            return fn(case, version_a_path, version_b_path)
        except Exception as e:
            print(f"[warn] custom generator failed ({e}); using stubs",
                  file=sys.stderr)

    # Stub outputs: derived from case content, deterministic, for runner
    # smoke testing only.
    trigger = case.get("trigger_prompt", "")
    output_a = f"[stub baseline output for: {trigger[:80]}]"
    output_b = f"[stub candidate output for: {trigger[:80]}]"
    return output_a, output_b


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def load_cases(cases_dir):
    cases_dir = Path(cases_dir)
    if not cases_dir.exists():
        return []
    case_files = sorted(cases_dir.glob("case-*.yaml"))
    cases = []
    for cf in case_files:
        try:
            data = parse_yaml(cf.read_text(encoding="utf-8"))
            data["_source_file"] = str(cf)
            cases.append(data)
        except Exception as e:
            print(f"[warn] failed to parse {cf}: {e}", file=sys.stderr)
    return cases


def resolve_version_path(skill_id, version):
    if version == "baseline":
        p = Path(f".claude/skills/{skill_id}/SKILL.md")
        return str(p) if p.exists() else None
    if version == "staging":
        p = Path(f".claude/skills/_staging/{skill_id}/SKILL.md")
        return str(p) if p.exists() else None
    # Treat as an explicit path
    p = Path(version)
    return str(p) if p.exists() else None


def compute_recommendation(aggregate, any_critical_failure):
    delta = aggregate["delta"]
    if any_critical_failure:
        return "reject"
    if delta >= 5.0:
        return "promote"
    if delta <= -3.0:
        return "reject"
    return "iterate"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skill", required=True)
    ap.add_argument("--version-a", default="baseline")
    ap.add_argument("--version-b", default="staging")
    ap.add_argument("--cases", default=None)
    ap.add_argument("--output", required=True)
    ap.add_argument("--judge-model", default="external-judge-default")
    args = ap.parse_args()

    cases_dir = args.cases or f"calibration/golden_cases/{args.skill}"
    cases = load_cases(cases_dir)
    if len(cases) < 3:
        print(f"[fatal] {len(cases)} golden cases at {cases_dir}; need at least 3",
              file=sys.stderr)
        sys.exit(1)

    va = resolve_version_path(args.skill, args.version_a)
    vb = resolve_version_path(args.skill, args.version_b)
    if not va or not vb:
        print(f"[fatal] could not resolve skill versions (a={va}, b={vb})",
              file=sys.stderr)
        sys.exit(1)

    report = {
        "skill_id": args.skill,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version_a": {"label": args.version_a, "path": va},
        "version_b": {"label": args.version_b, "path": vb},
        "case_count": len(cases),
        "cases": [],
        "failure_modes_in_b": [],
    }

    any_critical = False
    a_total = 0.0
    b_total = 0.0
    a_wins = b_wins = ties = 0

    for case in cases:
        case_id = case.get("case_id") or Path(case["_source_file"]).stem
        output_a, output_b = generate_outputs_for_case(case, va, vb)

        a_prog, a_fail = programmatic_score(case, output_a)
        b_prog, b_fail = programmatic_score(case, output_b)
        judge = llm_judge_score(case, output_a, output_b, args.judge_model)

        # Combine: average of programmatic + judge for each side
        a_score = round((a_prog + judge["a"]) / 2.0, 2)
        b_score = round((b_prog + judge["b"]) / 2.0, 2)
        delta = round(b_score - a_score, 2)

        a_total += a_score
        b_total += b_score
        if delta > 0.5: b_wins += 1
        elif delta < -0.5: a_wins += 1
        else: ties += 1

        # Critical failure detection
        if any("forbidden term present" in f for f in b_fail):
            any_critical = True
            report["failure_modes_in_b"].append(
                f"{case_id}: leaked forbidden term"
            )

        report["cases"].append({
            "case_id": case_id,
            "a_score": a_score,
            "b_score": b_score,
            "delta": delta,
            "a_failures": a_fail,
            "b_failures": b_fail,
            "judge_method": judge.get("method", "unknown"),
        })

    report["aggregate"] = {
        "a_total": round(a_total, 2),
        "b_total": round(b_total, 2),
        "delta": round(b_total - a_total, 2),
        "a_wins": a_wins,
        "b_wins": b_wins,
        "ties": ties,
    }
    report["recommendation"] = compute_recommendation(report["aggregate"], any_critical)

    # Write report
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    # Append summary to audit log
    audit_path = Path("calibration/audit_log.local.md")
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    with audit_path.open("a", encoding="utf-8") as f:
        f.write(
            f"\n## {report['timestamp']} — calibration\n"
            f"- skill: {args.skill}\n"
            f"- delta: {report['aggregate']['delta']}\n"
            f"- recommendation: {report['recommendation']}\n"
            f"- report: {out_path}\n"
        )

    print(f"[ok] report: {out_path}")
    print(f"[ok] recommendation: {report['recommendation']}")
    print(f"[ok] delta: {report['aggregate']['delta']}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(2)
    except Exception as e:
        print(f"[crash] {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(2)
