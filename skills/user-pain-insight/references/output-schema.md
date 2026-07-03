# Output Schema

Use this shape exactly. Keep all top-level keys.

```json
{
  "title": "本次材料的短标题",
  "summary": "50-100字复盘摘要，说明材料来源、主要痛点和可建联线索质量",
  "pain_points": [
    {
      "pain_point": "用户痛点的标签化表述",
      "description": "用一句话解释痛点的真实含义",
      "user_quotes": [
        {
          "quote": "材料中的真实用户原话，保持原文，不要编造",
          "speaker": "昵称或unknown",
          "platform": "平台或unknown"
        }
      ],
      "evidence_quality": "quoted|inferred",
      "severity": "high|medium|low",
      "scenario": "痛点出现的使用场景或业务场景"
    }
  ],
  "user_profiles": [
    {
      "tag": "标签，如 角色:跨境卖家",
      "evidence": "从材料中推测该标签的依据",
      "confidence": "high|medium|low",
      "related_quotes": ["相关用户原话，可为空数组"]
    }
  ],
  "contact_leads": [
    {
      "nickname": "用户昵称；没有则unknown",
      "platform": "平台名；没有则unknown",
      "source_context": "来自评论区、提问截图、私信截图、作品区等",
      "matched_pain_points": ["与该用户关联的痛点标签"],
      "profile_tags": ["与该用户关联的画像标签"],
      "outreach_note": "后续私信建联时可使用的低压切入点"
    }
  ]
}
```
