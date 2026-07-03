---
name: user-pain-insight
description: Extract user pain points, quoted user language, inferred user profiles, and nickname/platform contact leads from mixed screenshots, images, videos with notes, pasted text, comments, Q&A posts, social posts, and private-message research materials. Use when turning manually collected customer/user materials into structured SQLite-ready insight records for later review.
---

# User Pain Insight

## Goal

Turn mixed manually collected materials into structured user insight records without scraping platforms:

1. All user pain points found in the material, each with a real user quote when present
2. Inferred user profiles expressed as concise tags with evidence and confidence
3. Nickname/platform contact leads for later private-message outreach
4. A short title for the material
5. A 50-100 Chinese character review summary

## Input Handling

- Treat the input as manually provided, authorized, or user-owned research material.
- Use OCR text from screenshots when available.
- For video files, rely on user notes, title, filename, subtitles, OCR text, and any pasted transcript. If no transcript exists, state the limitation in `summary` without blocking the analysis.
- Do not invent exact claims, quotes, nicknames, platforms, metrics, or facts that are not present in the material.
- Keep user quotes exact, short, and traceable. Remove phone numbers, addresses, order numbers, and other private identifiers.
- If the same user appears multiple times, keep one contact lead and merge evidence.

## Analysis Rules

- Prefer user pain language over industry jargon.
- Separate explicit pain points from inferred pain points.
- Attach every explicit pain point to at least one real quote from the material.
- Express user profile traits as tags such as `角色:跨境卖家`, `阶段:新手`, `预算:敏感`, `情绪:焦虑`, `需求:降本增效`.
- Give each profile tag a confidence value: `high`, `medium`, or `low`.
- Mark missing nickname or platform as `unknown`; never guess.
- Keep outreach notes practical and low-pressure.

## Required JSON Shape

Return only valid JSON with these top-level fields:

- `pain_points`
- `user_profiles`
- `contact_leads`
- `title`
- `summary`

See `references/output-schema.md` for the exact field intent.

## Style

- Chinese output by default.
- Make titles concrete and scene-driven.
- Use concise bullet-like strings inside JSON arrays.
- Avoid vague phrases such as "赋能", "闭环", "颠覆", "全链路".
