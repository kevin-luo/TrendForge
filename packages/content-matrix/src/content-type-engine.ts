import type { MatrixContentType } from "@trendforge/core";

export type ContentTypeDefinition = {
  id: MatrixContentType;
  label: string;
  persona: string;
  platformFit: string[];
  sceneStructure: string[];
  visualStyle: string;
  keywords: string[];
};

export const contentTypes: ContentTypeDefinition[] = [
  {
    id: "tool_list",
    label: "工具榜单 / 产品盘点",
    persona: "工具推荐号",
    platformFit: ["douyin", "xiaohongshu", "youtube_shorts"],
    sceneStructure: ["封面", "总览", "产品 1", "产品 2", "产品 3", "产品 4", "产品 5", "总结推荐"],
    visualStyle: "产品截图、排名、亮点标签、数据卡",
    keywords: ["product hunt", "工具", "产品", "app", "ai tool", "榜单", "推荐"]
  },
  {
    id: "news_explain",
    label: "新闻解读",
    persona: "AI 快讯号",
    platformFit: ["douyin", "wechat_channels", "bilibili"],
    sceneStructure: ["发生了什么", "关键背景", "3 个核心信息", "影响分析", "一句话判断"],
    visualStyle: "新闻标题、事实卡、影响分析卡、时间线",
    keywords: ["新闻", "发布", "快讯", "融资", "模型", "政策", "行业"]
  },
  {
    id: "science_explain",
    label: "科普解释",
    persona: "知识科普号",
    platformFit: ["xiaohongshu", "bilibili", "youtube"],
    sceneStructure: ["问题引入", "概念解释", "简单例子", "常见误区", "一句话总结"],
    visualStyle: "概念图、流程图、对比卡、关键词卡",
    keywords: ["为什么", "原理", "概念", "是什么", "科普", "教程"]
  },
  {
    id: "history_story",
    label: "历史故事",
    persona: "历史科普号",
    platformFit: ["douyin", "bilibili", "youtube"],
    sceneStructure: ["反常识钩子", "时代背景", "冲突爆发", "关键转折", "结果影响", "今天的启发"],
    visualStyle: "档案风背景、人物卡、时间线、地点卡",
    keywords: ["历史", "人物", "战争", "朝代", "事件", "冷知识"]
  },
  {
    id: "opinion_comment",
    label: "观点评论",
    persona: "程序员副业号",
    platformFit: ["douyin", "xiaohongshu", "wechat_channels"],
    sceneStructure: ["现象", "我的判断", "原因", "行动建议", "结论"],
    visualStyle: "大字观点、论点卡、数据引用卡、结论强调",
    keywords: ["观点", "判断", "趋势", "副业", "创业", "程序员", "普通人"]
  }
];

export class ContentTypeEngine {
  list(): ContentTypeDefinition[] {
    return contentTypes;
  }

  get(id: MatrixContentType): ContentTypeDefinition {
    return contentTypes.find((type) => type.id === id) ?? contentTypes[0]!;
  }

  recommend(input: string): MatrixContentType[] {
    const text = input.toLowerCase();
    const scored = contentTypes.map((type) => ({
      id: type.id,
      score: type.keywords.reduce((sum, keyword) => sum + (text.includes(keyword.toLowerCase()) ? 2 : 0), 0)
    }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter((item) => item.score > 0).map((item) => item.id);
    return top.length ? top.slice(0, 3) : ["news_explain", "science_explain", "opinion_comment"];
  }
}
