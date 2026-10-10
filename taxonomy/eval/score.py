"""Score topic predictions against BMW's own labels.

    python taxonomy/eval/score.py taxonomy/eval/predictions.csv [--split dev|test|all]

predictions.csv columns:
    id         BMW verbatim ID (e.g. G60-1430)
    topic_ids  predicted topic IDs, ';'-separated, most confident first (empty = no finding)

Only verbatims present in predictions.csv are scored, so a sample is fine.
BMW tagged each verbatim with some topics, not necessarily all of them, so precision
is a lower bound: a correct extra topic counts as a false positive.
"""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent


def split_ids(s):
    return [x.strip() for x in (s or "").split(";") if x.strip()]


def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return p, r, f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("predictions")
    ap.add_argument("--gold", default=str(HERE / "gold.csv"))
    ap.add_argument("--taxonomy", default=str(HERE.parent / "taxonomy.json"))
    ap.add_argument("--split", choices=["dev", "test", "all"], default="all")
    args = ap.parse_args()

    tax = json.loads(Path(args.taxonomy).read_text(encoding="utf-8"))
    area_of = {t["id"]: t["car_area"] for t in tax["topics"]}
    # Accept aliases and raw BMW labels too, but report them; the classifier should emit canonical IDs.
    alias = {}
    for t in tax["topics"]:
        for label in t["vfc_level2"]:
            alias[label] = t["id"]
    fallback = tax["fallback_topic"]

    with open(args.gold, encoding="utf-8", newline="") as f:
        gold = {r["id"]: r for r in csv.DictReader(f) if args.split == "all" or r["split"] == args.split}
    with open(args.predictions, encoding="utf-8", newline="") as f:
        preds = {r["id"]: split_ids(r["topic_ids"]) for r in csv.DictReader(f)}

    scored = [i for i in preds if i in gold]
    if not scored:
        raise SystemExit("No prediction IDs match the gold set (check --split).")

    n_pred_labels = invalid = non_canonical = n_other = hit1 = 0
    t_tp = t_fp = t_fn = a_tp = a_fp = a_fn = 0
    confusions = Counter()
    invalid_examples = Counter()
    for vid in scored:
        g_topics = set(split_ids(gold[vid]["gold_topics"]))
        g_areas = set(split_ids(gold[vid]["gold_areas"]))
        p_topics = []
        for raw in preds[vid]:
            n_pred_labels += 1
            if raw == fallback:
                n_other += 1
                continue
            if raw in area_of:
                p_topics.append(raw)
            elif raw in alias:
                non_canonical += 1
                p_topics.append(alias[raw])
            else:
                invalid += 1
                invalid_examples[raw] += 1
        if p_topics and p_topics[0] in g_topics:
            hit1 += 1
        p_set = set(p_topics)
        t_tp += len(p_set & g_topics)
        t_fp += len(p_set - g_topics)
        t_fn += len(g_topics - p_set)
        p_areas = {area_of[t] for t in p_set}
        a_tp += len(p_areas & g_areas)
        a_fp += len(p_areas - g_areas)
        a_fn += len(g_areas - p_areas)
        for pa in p_areas - g_areas:
            for ga in g_areas - p_areas:
                confusions[(ga, pa)] += 1

    n = len(scored)
    tp_, tr_, tf_ = prf(t_tp, t_fp, t_fn)
    ap_, ar_, af_ = prf(a_tp, a_fp, a_fn)
    print(f"taxonomy {tax['version']} | split={args.split} | scored verbatims: {n} "
          f"(of {len(preds)} predicted, {len(gold)} in gold)")
    print(f"invalid labels:        {invalid} of {n_pred_labels}  <- must be 0")
    if invalid_examples:
        print("  e.g.", ", ".join(f"{k} ({v})" for k, v in invalid_examples.most_common(5)))
    print(f"non-canonical labels:  {non_canonical} (aliases or raw BMW labels, accepted)")
    print(f"'{fallback}' rate:          {n_other / max(n_pred_labels, 1):.1%}")
    print(f"topic   hit@1 {hit1 / n:.3f} | precision {tp_:.3f} recall {tr_:.3f} F1 {tf_:.3f}")
    print(f"area    precision {ap_:.3f} recall {ar_:.3f} F1 {af_:.3f}")
    if confusions:
        print("top car-area confusions (gold -> predicted):")
        for (g, p), c in confusions.most_common(8):
            print(f"  {g:<22} -> {p:<22} {c}")


if __name__ == "__main__":
    main()
