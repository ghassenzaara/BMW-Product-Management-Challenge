"""Build agent-friendly derived files in 02-bmw-data/processed/ from the raw BMW data.

Raw files in 02-bmw-data/raw/ are never modified. Re-run after the raw data changes:

    python 02-bmw-data/scripts/build_processed.py

Needs pandas + openpyxl, and `pdftotext` (poppler) on PATH for the option lists.
"""
from pathlib import Path
import shutil
import subprocess

import pandas as pd

DATA = Path(__file__).resolve().parents[1]
RAW = DATA / "raw"
OUT = DATA / "processed"
OUT.mkdir(exist_ok=True)

MODELS = {
    "F70": ("1 Series", "customer-feedback_F70_1-series.xlsx"),
    "G60": ("5 Series", "customer-feedback_G60_5-series.xlsx"),
    "G70": ("7 Series", "customer-feedback_G70_7-series.xlsx"),
}
US_LEVELS = ["I Hate It", "A Failure", "Unsatisfactory", "Satisfactory",
             "Excellent", "Delightful", "I Love It"]  # scored 1..7


def feedback():
    frames = []
    for code, (series, fname) in MODELS.items():
        df = pd.read_excel(RAW / fname)
        df = df.rename(columns={
            "ID": "id", "Source": "source", "Country": "country",
            "Derivate (e-code)": "model", "Engine Type": "engine",
            "Feedback Type": "feedback_type", "Customer Feedback": "text",
            "Vfc level2 Name": "topic", "Vfc level3 Name": "aspect",
        })
        df["series"] = series
        df["engine"] = df["engine"].replace({"BEVE": "BEV"})
        df["feedback_type"] = df["feedback_type"].fillna("Unclassified")
        df["topic"] = df["topic"].fillna("no_class_found")
        df["aspect"] = df["aspect"].fillna("")
        frames.append(df[["id", "model", "series", "source", "country", "engine",
                          "feedback_type", "topic", "aspect", "text"]])
    rows = pd.concat(frames, ignore_index=True)
    rows.to_csv(OUT / "feedback_rows.csv", index=False, encoding="utf-8")

    # One row per verbatim; topic/type labels joined with " | ".
    def join(s):
        return " | ".join(dict.fromkeys(x for x in s if x))

    # Named aggregation can't use "engine" (it is an agg() keyword), so rename after.
    verb = (rows.assign(label=rows["topic"] + " : " + rows["aspect"])
            .groupby("id", sort=False)
            .agg(model=("model", "first"), series=("series", "first"),
                 source=("source", "first"), country=("country", "first"),
                 engine_=("engine", "first"), feedback_types=("feedback_type", join),
                 topics=("label", join), text=("text", "first"))
            .rename(columns={"engine_": "engine"})
            .reset_index())
    verb["text_len"] = verb["text"].astype(str).str.len()
    verb.to_csv(OUT / "feedback_verbatims.csv", index=False, encoding="utf-8")

    # Counts of distinct verbatims per model/engine/type/topic/aspect.
    counts = (rows.groupby(["model", "engine", "feedback_type", "topic", "aspect"])["id"]
              .nunique().rename("n_verbatims").reset_index()
              .sort_values(["model", "n_verbatims"], ascending=[True, False]))
    counts.to_csv(OUT / "feedback_topic_counts.csv", index=False, encoding="utf-8")


def study():
    # CN_EU_2025: alternating rows "<attribute>" / "Mean", 5 value columns.
    a = pd.read_excel(RAW / "customer-study_2025_all-models.xlsx", "CN_EU_2025", header=None)
    cols = [("China", "G68", "5 Series"), ("China", "G70", "7 Series"),
            ("EU", "F70", "1 Series"), ("EU", "G60", "5 Series"), ("EU", "G70", "7 Series")]
    recs = []
    for i in range(2, len(a) - 1, 2):
        attr = a.iat[i, 0]
        if a.iat[i + 1, 0] != "Mean":
            continue
        for j, (market, model, series) in enumerate(cols, start=1):
            recs.append({"attribute": attr, "market": market, "model": model,
                         "series": series, "mean_score_10": round(float(a.iat[i + 1, j]), 3)})
    pd.DataFrame(recs).to_csv(OUT / "study_cn_eu_2025.csv", index=False, encoding="utf-8")

    # US_2025: blocks of title row, "Sample total", then the 7 satisfaction levels.
    b = pd.read_excel(RAW / "customer-study_2025_all-models.xlsx", "US_2025", header=None)
    recs, attr, block = [], None, {}

    def flush():
        if attr and block:
            for model, col in (("G60", 2), ("G70", 3)):
                shares = {lvl: float(block[lvl][col]) for lvl in US_LEVELS if lvl in block}
                if len(shares) < 7:
                    continue
                total = sum(shares.values())
                mean = sum((k + 1) * shares[l] for k, l in enumerate(US_LEVELS)) / total
                recs.append({
                    "attribute": attr, "model": model,
                    "series": "5 Series" if model == "G60" else "7 Series",
                    **{f"share_{l.lower().replace(' ', '_')}": round(shares[l], 4) for l in US_LEVELS},
                    "top2_box": round(shares["Delightful"] + shares["I Love It"], 4),
                    "bottom3_box": round(shares["I Hate It"] + shares["A Failure"] + shares["Unsatisfactory"], 4),
                    "mean_score_7": round(mean, 3),
                })

    for _, r in b.iterrows():
        label = r[0]
        if label in US_LEVELS or label == "Sample total":
            block[label] = r
        elif pd.isna(r[1]):  # attribute title row (two titles in the sheet are blank)
            flush()
            attr, block = (label if isinstance(label, str) else None), {}
    flush()
    pd.DataFrame(recs).to_csv(OUT / "study_us_2025.csv", index=False, encoding="utf-8")


def sales():
    recs = []
    for sheet in ["F70", "G60_G68", "G70"]:
        df = pd.read_excel(RAW / "sales-volumes_2024-2030.xlsx", sheet)
        df.insert(0, "model", sheet)
        recs.append(df)
    s = pd.concat(recs, ignore_index=True)
    s["growth_2025_2030_pct"] = (100 * (s.volume_2030 / s.volume_2025 - 1)).round(1)
    s.loc[s.volume_2025 == 0, "growth_2025_2030_pct"] = None
    s["share_of_model_2025_pct"] = (100 * s.volume_2025 / s.groupby("model").volume_2025.transform("sum")).round(1)
    s.to_csv(OUT / "sales_volumes.csv", index=False, encoding="utf-8")


def option_lists():
    exe = shutil.which("pdftotext")
    if not exe:
        print("pdftotext not found, skipping option lists")
        return
    target = OUT / "option-lists"
    target.mkdir(exist_ok=True)
    for pdf in sorted(RAW.glob("option-list_*.pdf")):
        out = target / (pdf.stem + ".txt")
        # The PDFs are owner-encrypted; pdftotext reads them with an empty password.
        # A harmless "Unknown filter 'Crypt'" warning is printed for an embedded image.
        subprocess.run([exe, "-layout", "-enc", "UTF-8", str(pdf), str(out)],
                       check=False, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    feedback()
    study()
    sales()
    option_lists()
    for f in sorted(OUT.rglob("*.*")):
        print(f"{f.relative_to(DATA)}  {f.stat().st_size // 1024} KB")
