# Output Schema

Use this shape exactly. Values may be arrays or strings where appropriate, but keep all keys.

```json
{
  "title": "本次素材的短标题",
  "summary": "50-100字总结",
  "keywords": {
    "core_terms": ["核心词"],
    "long_tail_terms": ["长尾搜索词"],
    "user_language": ["素材里的用户原话/高频表达"],
    "intent_clusters": [
      {
        "cluster": "痛点类别",
        "intent": "搜索/评论背后的真实意图",
        "terms": ["相关词"]
      }
    ]
  },
  "topics": {
    "candidate_topics": [
      {
        "title": "备选选题",
        "platform_fit": ["抖音", "小红书"],
        "user_need": "用户需求点",
        "why_it_works": "为什么可能有效",
        "sales_level": "种草/教育/转化"
      }
    ]
  },
  "video_breakdown": {
    "hook": "钩子是什么",
    "structure": "内容结构是什么",
    "persona_style": "人设风格是什么",
    "visual_form": "视觉形式是什么",
    "comment_triggers": ["怎样激发用户评论"],
    "transferable_moves": ["可迁移到自己账号的做法"]
  },
  "platform_scripts": {
    "zhihu": {
      "title": "知乎标题",
      "fields": ["问题背景", "观点", "案例", "方法", "边界"],
      "content_style": "理性、解释充分、像回答问题",
      "script": "可发布草稿"
    },
    "wechat": {
      "title": "公众号标题",
      "fields": ["开头", "案例", "分析", "方法", "结尾"],
      "content_style": "完整叙事、可信、适合沉淀",
      "script": "可发布草稿"
    },
    "douyin": {
      "title": "抖音标题",
      "fields": ["前3秒", "冲突", "细节", "轻方法", "评论引导"],
      "content_style": "短、强钩子、口语",
      "script": "可发布草稿"
    },
    "xiaohongshu": {
      "title": "小红书标题",
      "fields": ["标题", "正文", "分段", "标签", "互动"],
      "content_style": "真实经验、低销售感、可收藏",
      "script": "可发布草稿"
    }
  },
  "marketing_risk_scan": {
    "privacy": "隐私/个人信息检查提示词",
    "platform_compliance": "平台合规检查提示词",
    "sales_claims": "夸大承诺/硬广风险检查提示词",
    "competitor_risk": "竞品与版权风险检查提示词",
    "rewrite_prompt": "把内容改成低销售感种草表达的提示词"
  }
}
```
