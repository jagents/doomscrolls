# Code Review: ccNewFeedAlgoPlanv1.md

Scope: Review of Claude Code's implementation plan for the new feed algorithm, based only on the plan itself and the original prompt.

## Findings (ordered by severity)

### Critical

1) Signal presence defaults will corrupt resonance scoring and tiering.
- `ccNewFeedAlgoPlanv1.md:104` sets new signal columns with defaults (`FALSE` / `0`).
- `ccNewFeedAlgoPlanv1.md:416` treats a signal as "present" when the column is non-null, which will always be true for the defaulted columns.
- Result: every chunk appears to have all signals present (but many are false/zero), driving weighted sums toward zero, destroying the confidence penalty logic, and forcing `signalCount` to max for all rows.
- Fix: make signal columns nullable by default, use NULL as "unknown", and only set TRUE/COUNT when a signal is actually observed. Update the `present` logic to reflect real availability. Also consider a separate `*_observed` flag where NULL is ambiguous.

2) `quality_tier` will incorrectly mark unknown rows as `C`.
- `ccNewFeedAlgoPlanv1.md:93` uses `ELSE 'C'` and does not handle NULL `resonance_score`.
- This will treat any row without a computed score as low quality, which biases sampling and breaks the notion of "unknown".
- Fix: include `WHEN resonance_score IS NULL THEN NULL` in the generated column and adjust sampling to handle NULL tiers (or backfill before usage).

3) Cluster-quality computation is not feasible as written for 10M+ embeddings.
- `ccNewFeedAlgoPlanv1.md:553` proposes loading all embeddings into memory or running kNN for every row.
- 10.3M * 1536 floats is tens of GB, and kNN for every row is an enormous compute cost even with pgvector.
- Fix: design a scalable approach (sampled clustering, ANN index + batch sampling, or offline job on a separate machine). At minimum: compute cluster quality on a representative sample, then infer scores with a smaller nearest-centroid pass.

### High

4) `sample_key` backfill and maintenance plan is incomplete.
- `ccNewFeedAlgoPlanv1.md:225` uses a full-table UPDATE with `random()` but does not describe batching or update strategy.
- There is no default for new rows, so fresh content will have NULL `sample_key` and be excluded from sampling.
- Fix: add `ALTER TABLE chunks ALTER COLUMN sample_key SET DEFAULT random()` after backfill; batch updates to avoid long locks and bloat; consider `NOT NULL` after backfill.

5) Schema/index migrations on a 10M-row table need concurrency-safe steps.
- `ccNewFeedAlgoPlanv1.md:114` and `ccNewFeedAlgoPlanv1.md:365` propose multiple indexes and generated columns without noting `CONCURRENTLY` or lock minimization.
- On large tables, these can block reads/writes or cause long-running locks.
- Fix: use `CREATE INDEX CONCURRENTLY`, split migrations, and explicitly plan maintenance windows or background migration scripts.

6) Sampling queries ignore existing feed constraints and may under-fill.
- The example `sampleFromTier` query only filters by `quality_tier` and exclusions (`ccNewFeedAlgoPlanv1.md:251`).
- The existing algorithm applies text length, type, author/work recency, etc. If these are added as filters later, a single scan from a random start can return fewer than `limit` rows.
- Fix: implement a looped sampler that retries with new `startKey` or widens constraints to guarantee `limit` results while respecting diversity rules.

### Medium

7) Trigram matching on `chunks.text` likely creates a very large GIN index.
- `ccNewFeedAlgoPlanv1.md:365` suggests a full text trigram index; for 10M passages this can be huge and slow to build.
- Fix: consider building a trigram index on a normalized/shortened text field or on a subset (e.g., only canonical quote sources), or use a two-stage candidate filter.

8) Resonance computation assumes author IDs for Bartlett quotes without a mapping plan.
- `ccNewFeedAlgoPlanv1.md:371` references `author_id = $2` but does not specify how the quote-to-author mapping will be created from Gutenberg data.
- Fix: add a parsing/matching strategy for authors or drop the author constraint and use stricter similarity thresholds + manual review.

9) Preference normalization is underspecified and may skew the blend.
- `ccNewFeedAlgoPlanv1.md:523` assumes preference scores are on a 0-10 scale, but the current codebase may use a different scale.
- Fix: document the current preference score scale and normalize based on actual min/max or percentiles.

10) Signal count uses likes + bookmarks only, ignoring other known signals.
- `ccNewFeedAlgoPlanv1.md:475` uses `likeCount + bookmarkCount` and does not mention follows, hides, or read completions if those exist.
- Fix: define a canonical "user signal count" that covers all events contributing to preference strength.

### Low

11) Embedding integration assumes pgvector usage but does not address indexing or similarity operator choice.
- `ccNewFeedAlgoPlanv1.md:610` outlines a taste vector and cosine similarity but does not specify using an index or the right operator class.
- Fix: specify `vector_cosine_ops` and add an index if similarity queries are part of the request path.

12) Rollout metrics lack baselines and guardrails.
- `ccNewFeedAlgoPlanv1.md:759` lists targets but not baseline values or thresholds for rollback.
- Fix: define current baselines and explicit rollback triggers.

## Open questions / assumptions

- Are `chunks` inserts ongoing during migration? If yes, the plan should include a trigger/default for `sample_key` and a policy for `resonance_score` updates on new data.
- Is there an existing configuration system that would conflict with the new config tables? The plan assumes new tables without describing cache invalidation or admin APIs.
- Are there user safety constraints (e.g., NSFW filters) currently enforced in feed queries? If yes, those must be carried into the new sampling pipeline explicitly.

## Change summary (what I would do differently)

- Make all signal columns nullable by default and treat NULL as "unknown"; adjust `quality_tier` generation to handle NULL scores.
- Add `sample_key` default and batch backfill; avoid long locks with concurrent index builds and staged migrations.
- Redesign cluster-quality computation to be scalable (sample-based clustering + centroid assignment), or defer it behind a separate offline pipeline.
- Expand the feed sampling loop to guarantee `limit` results under all filters without compromising diversity.
- Specify the existing preference score scale and the real definition of `signalCount` before blending.

## Addendum: Codebase + strategy cross-check

This section incorporates findings from the actual codebase and the referenced strategy documents:
`FeedAlgoReArchitecture/DSbootstrapPlanArch.md`, `FeedAlgoReArchitecture/doomscrolls-bootstrap-strategy-v6.md`,
`FeedAlgoReArchitecture/DOCDoomscrollsv4.md`, and `FeedAlgoReArchitecture/DOCSDoomscrollsDataReport.md`.

### Critical

1) The plan updates the base feed but omits the personalized feed path actually used by logged-in users.
- The API routes send logged-in users to `generatePersonalizedFeed` (`server/routes/feed.ts:18`), not `generateFeed`.
- The plan focuses on `generateFeed` and does not call out the need to replace the personalized pipeline (`server/services/feed-algorithm.ts:925`).
- Result: most logged-in traffic would still use the old random+boost algorithm.
- Fix: treat `generatePersonalizedFeed` as the primary integration target (or refactor to a single shared pipeline).

### High

2) The plan diverges from the authoritative bootstrap spec by omitting `preference_config` and Kindle highlights.
- The spec requires `kindle_highlight_count` and `preference_config` (`FeedAlgoReArchitecture/DSbootstrapPlanArch.md:94`, `FeedAlgoReArchitecture/DSbootstrapPlanArch.md:140`).
- The plan adds resonance/tier/corpus tables but never introduces `preference_config`, and leaves out the Kindle signal.
- Result: missing config for the existing preference boosts and an incomplete resonance signal set.
- Fix: add the missing column + config table (or explicitly justify removing them).

3) The plan ignores the existing config system and cache, which will conflict with new tables.
- Feed settings are currently stored in `app_config` JSON with a memory cache (`server/services/config.ts:112`).
- The plan introduces multiple new config tables but does not describe how they integrate with `app_config`, cache invalidation, or the admin endpoints.
- Fix: either extend the existing `app_config` structure, or plan a full migration that updates all config read/write paths.

4) Signal count semantics differ between the strategy and the current implementation.
- The strategy defines `signalCount = likeCount + bookmarkCount` (`FeedAlgoReArchitecture/DSbootstrapPlanArch.md:330`).
- The current implementation uses counts of liked authors + followed authors + bookmarked works (`server/services/feed-algorithm.ts:769`).
- Result: blend thresholds will trigger at different times than planned.
- Fix: align on a single definition and update both the plan and code accordingly.

### Medium

5) The plan assumes a post-scoring “applyDiversityRules” step that does not exist in code.
- Current diversity enforcement is done via bucketed sampling and post-selection (`server/services/feed-algorithm.ts:444`), not a single rule-application function.
- The plan should either map the new algorithm into the existing bucketed approach or propose a new explicit diversity stage.

6) The plan does not account for `w.chunk_count > 10` filtering on the full corpus path.
- The base feed excludes tiny works (`server/services/feed-algorithm.ts:521`) and the personalized path does so unless an author is followed (`server/services/feed-algorithm.ts:1045`).
- The sample-key queries in the plan omit this constraint, so behavior will change for logged-in users.

7) The data report shows `chunk_stats` is effectively empty, so popularity signals are currently unreliable.
- `chunk_stats` count is 4 rows (`FeedAlgoReArchitecture/DOCSDoomscrollsDataReport.md:22`).
- The plan assumes popularity/like-count signals without acknowledging that most rows have no stats.
- Fix: either backfill `chunk_stats` or treat popularity as a no-op until the table is populated.

8) Type distribution is heavily skewed toward NULL/prose, which affects tier sampling.
- `chunks.type` is NULL for 8.1M rows, while quotes/poems are a small minority (`FeedAlgoReArchitecture/DOCSDoomscrollsDataReport.md:83`).
- The plan does not mention how tier sampling will preserve type diversity (a stated goal in the spec).

### Low

9) The plan’s “24 ORDER BY RANDOM()” count doesn’t match the current code.
- There are 21 `ORDER BY RANDOM()` calls in `server/services/feed-algorithm.ts` (example at `server/services/feed-algorithm.ts:472`).
- Not a functional issue, but the plan’s audit is slightly off and misses other random usages (e.g., suggested authors).

## Additional notes (alignment opportunities)

- The strategy doc specifies a separate “validation-first” phase for Bartlett’s matching; the plan reorders this behind `sample_key`. Consider preserving the validation-first sequencing from `FeedAlgoReArchitecture/DSbootstrapPlanArch.md:746` to de-risk signal pipelines early.
- The `user_taste_vectors` table is gated on pgvector (`server/db/migrate-phase2.ts:176`). The plan should acknowledge this runtime dependency when scheduling embedding-based features.
