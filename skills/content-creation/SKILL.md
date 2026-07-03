---
name: content-creation
description: Analyze new-media creative materials, competitor posts, comment screenshots, search terms, videos with notes, and user-provided observations into keyword tables, content topics, creative breakdowns, platform-specific scripts, and marketing-risk prompts. Use when processing Douyin, Xiaohongshu, Zhihu, WeChat official account, short-video, social-commerce, or cross-border e-commerce content research inputs.
---

# Content Creation Insight

## Goal

Turn mixed new-media research inputs into reusable content creation assets without scraping platforms:

1. Core terms and long-tail search terms
2. Candidate topics with user-need analysis
3. Creative/video breakdown
4. Platform scripts for Zhihu, WeChat official account, Douyin, and Xiaohongshu
5. Marketing-risk scan written as reusable prompts

## Input Handling

- Treat the input as manually provided, authorized, or user-owned research material.
- Use OCR text from screenshots when available.
- For video files, rely on user notes, title, filename, subtitles, OCR text, and any pasted transcript. If no transcript exists, state the limitation inside `video_breakdown.transferable_moves` without blocking the analysis.
- Do not invent exact claims, metrics, quotes, or competitor facts that are not present in the material.
- Extract user language exactly when useful, but remove private data and identifiers.

## Analysis Rules

- Prefer user pain language over industry jargon.
- For cross-border e-commerce, prioritize seller intent around selection, listing, SKU expansion, operations workload, ad cost, margin pressure, inventory, AI automation, and team efficiency.
- Distinguish seed/grass-planting topics from conversion topics.
- When analyzing a good work, identify transferable structure rather than copying wording.
- Keep sales language restrained unless the input explicitly asks for conversion copy.

## Required JSON Shape

Return only valid JSON with these top-level fields:

- `keywords`
- `topics`
- `video_breakdown`
- `platform_scripts`
- `marketing_risk_scan`
- `title`
- `summary`

See `references/output-schema.md` for the exact field intent.

## Style

- Chinese output by default.
- Make titles concrete and scene-driven.
- Use concise bullet-like strings inside JSON arrays.
- Avoid vague phrases such as "赋能", "闭环", "颠覆", "全链路" unless used as risk examples.
