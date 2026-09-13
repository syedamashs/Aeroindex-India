# APIx production normalizers

Put these files in `APIx/normalizers/`:

- `normalizer_common.py`
- `airindia_normalizer.py`
- `indigo_normalizer.py`
- `spicejet_normalizer.py`
- `__init__.py`

Each function is task-driven:
`normalize_<source>(raw_json, task)`

Required task fields: `run_id`, `task_id`, `route_id`, `origin`, `destination`, `departure_date`, `target_lead_days`.
Recommended: `search_timestamp`/`collection_timestamp`, `source_url`.

Output is exactly the frozen 45-column canonical APIx schema.

Important: DGCA route weights and airport→city/market mappings remain reference data, not observation fields. The normalizers do not hard-code routes or dates. SpiceJet fees are only populated when the source explicitly exposes a fee amount; unknown tax/fee splits are left null rather than guessed.
