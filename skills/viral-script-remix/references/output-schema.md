# Output Schema

Use this shape exactly. Keep all keys.

```json
{
  "title": "本次仿写脚本短标题",
  "summary": "50-100字总结原视频可复用价值",
  "source_video_summary": {
    "topic": "原视频主题",
    "visible_elements": ["截图/录屏中能看到的关键画面、标题、字幕、评论或账号线索"],
    "spoken_or_ocr_text": ["材料中可识别的口播、字幕、OCR或评论原话"],
    "missing_context": ["材料里没有提供但会影响判断的信息"]
  },
  "viral_breakdown": {
    "hook": "前3秒钩子/第一眼吸引点",
    "conflict_or_tension": "冲突、反差、焦虑、利益点或情绪张力",
    "structure": ["开头", "展开", "证明/案例", "转折", "收口"],
    "persona_style": "人设与表达风格",
    "visual_style": "画面形式、镜头、字幕、节奏",
    "transferable_moves": ["可以迁移到自己账号的做法"]
  },
  "comment_insights": {
    "pain_points": [
      {
        "pain": "用户痛点",
        "evidence_quote": "材料中的评论区/字幕/口播原话",
        "content_opportunity": "可延展的选题或脚本机会"
      }
    ],
    "audience_profile_tags": ["可推测的用户画像标签"],
    "reply_or_private_message_angles": ["可以评论回复或私信切入的话术方向"]
  },
  "remix_angles": [
    {
      "angle": "仿写角度",
      "why_it_works": "为什么可能有效",
      "different_from_source": "如何避免照搬原视频",
      "suitable_account": "适合的人设/账号类型"
    }
  ],
  "shooting_script": {
    "douyin_title": "抖音标题",
    "cover_text": "封面文案",
    "opening_hooks": ["3个可选开头钩子"],
    "shot_list": [
      {
        "time": "0-3s",
        "visual": "画面/动作/素材",
        "voiceover": "口播",
        "subtitle": "字幕"
      }
    ],
    "full_voiceover": "完整口播稿",
    "comment_prompt": "评论区引导话术",
    "variants": ["可继续扩展的系列选题"]
  },
  "compliance_notes": {
    "copyright_risk": "版权/搬运风险提醒",
    "claim_risk": "夸大承诺/效果保证风险提醒",
    "privacy_risk": "隐私/昵称/评论引用风险提醒",
    "safer_rewrite": "更稳妥的改写建议"
  }
}
```
