# Reference classifier prompt

Provider-neutral. It works with any LLM API that supports structured output against a JSON Schema (OpenAI `response_format: json_schema`, Anthropic structured outputs, etc.). Use the schema in [`classifier.schema.json`](classifier.schema.json); its `topic_id` enum *is* the taxonomy, so the model cannot return an invented topic.

## Inputs per call
| Field | Example |
|---|---|
| `text` | the verbatim, review paragraph, transcript chunk or article excerpt (original language is fine) |
| `source_type` | `bmw_feedback`, `review`, `youtube`, `reddit`, `forum`, `news`, `competitor_spec` |
| `vehicle` | `BMW 5 Series (G60)`, or the competitor model the text talks about |

## System prompt
Put the static part first so it can be prompt-cached. The topic list is about 3.5k tokens.

```text
You classify automotive customer and market statements for BMW product managers.

Split the input into findings. One finding = one statement about one topic of the car.
A text that praises the seats and complains about the screen gives two findings.
Ignore greetings, dealer logistics and anything that is not about the car or its services.
If the text says nothing about the car, return an empty findings list.

For each finding:
- topic_id: choose exactly one ID from the topic list below. Never invent an ID.
  Choose the most specific topic that fits (e.g. seat_massage over seats).
  If nothing in the list fits, use "other" and put a short proposed name in other_suggestion.
- aspect_group: what the statement is about (see the aspect_group list).
- quote: copy the exact words from the input text. Do not paraphrase or translate the quote.
- summary: at most 20 words, in English.
- confidence: high if the topic is explicit, medium if inferred, low if you had to guess.

Do not decide the car area; it is derived from the topic in code.

<topic_list>
{{contents of prompt_topics.md}}
</topic_list>
```

## User message
```text
source_type: {{source_type}}
vehicle: {{vehicle}}
text:
<<<
{{text}}
>>>
```

## After the call (in code, not in the model)
1. Check that every `quote` appears in `text` (normalize whitespace). If it doesn't, quarantine the finding (`validation = quarantined`, reason `quote_not_found`).
2. Set `car_area` from `taxonomy.json` (`topics[].car_area`) and store `taxonomy_version`.
3. If `topic_id = other` or `confidence = low`, insert a row into the taxonomy review queue (`TAXONOMY_PROPOSAL`) with the text, quote and `other_suggestion`. The finding stays visible as unclustered.
4. Map BMW's Feedback Type or the statement's polarity to `kind` / `severity` as today.

## BMW rows skip the LLM
Rows from the BMW feedback files already carry a VFC level-2 label. Map them with `taxonomy.json` → `vfc_level2_to_topic` (deterministic, no LLM). Only rows whose label maps to `null` (`no_class_found`, `General enquiry`, about 1.2k verbatims in `eval/unlabeled.csv`) go through the classifier.

## Optional: shortlist for cheaper models
With a small model or very high volume, embed `label + hint` for each topic once. Per text, take the top 30 topics by cosine similarity, plus `other`, and send only those in the prompt and the enum. Measure on `eval/` that recall does not drop before switching.
