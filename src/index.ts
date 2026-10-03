#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveCookie, DEFAULT_USER_SLUG } from "./config.js";
import {
  fetchFollowingQuestions,
  rankQuestions,
  formatQuestionsMarkdown,
} from "./zhihu.js";

const server = new McpServer({
  name: "zhihu-mcp",
  version: "1.0.0",
});

// Tool 1: Get ranked following questions
server.tool(
  "get_following_questions",
  "拉取知乎用户关注的问题，并根据【关注人数多、回答人数少】的权重比进行智能排序，挖掘蓝海与高转化问题",
  {
    user_slug: z
      .string()
      .optional()
      .describe(`知乎用户的主页 slug，例如 xiaofucode (默认为 ${DEFAULT_USER_SLUG})`),
    cookie: z
      .string()
      .optional()
      .describe("知乎请求 Cookie。若不传则自动使用环境变量 ZHIHU_COOKIE 或内置默认凭据"),
    sort_by: z
      .enum(["ratio", "opportunity", "followers", "answers_asc"])
      .optional()
      .describe(
        "排序维度：ratio(关注/回答比率，默认)；opportunity(机会指数，加权关注量级)；followers(纯关注量降序)；answers_asc(回答量升序)"
      ),
    min_followers: z
      .number()
      .optional()
      .describe("关注人数下限过滤，例如设置 50 则只看关注人数 >= 50 的问题"),
    max_answers: z
      .number()
      .optional()
      .describe("回答人数上限过滤，例如设置 30 则只看回答人数 <= 30 的问题"),
    keyword: z
      .string()
      .optional()
      .describe("问题标题关键词过滤，例如 'Java'、'架构'、'Redis'、'Agent'"),
    limit: z
      .number()
      .optional()
      .describe("返回的问题数量限制，默认为 50 条，传入 -1 或较大值可返回全部"),
    max_fetch: z
      .number()
      .optional()
      .describe("最大向知乎拉取的问题总数，默认 400 条（可覆盖该用户目前全部 390 关注问题）"),
  },
  async ({
    user_slug,
    cookie,
    sort_by = "ratio",
    min_followers = 0,
    max_answers,
    keyword,
    limit = 50,
    max_fetch = 400,
  }) => {
    try {
      const targetSlug = user_slug || DEFAULT_USER_SLUG;
      const targetCookie = resolveCookie(cookie);

      const rawQuestions = await fetchFollowingQuestions({
        userSlug: targetSlug,
        cookie: targetCookie,
        maxFetch: max_fetch,
      });

      const ranked = rankQuestions(rawQuestions, {
        sortBy: sort_by,
        minFollowers: min_followers,
        maxAnswers: max_answers,
        keyword,
        limit: limit > 0 ? limit : undefined,
      });

      const mdTable = formatQuestionsMarkdown(ranked, {
        title: `知乎用户 @${targetSlug} 关注问题机会排名 (排序: ${sort_by})`,
        totalAvailable: rawQuestions.length,
      });

      return {
        content: [
          {
            type: "text",
            text: `${mdTable}\n\n\`\`\`json\n${JSON.stringify(
              ranked.map((q) => ({
                rank: q.rank,
                id: q.id,
                title: q.title,
                follower_count: q.follower_count,
                answer_count: q.answer_count,
                ratio: q.ratio,
                opportunity_score: q.opportunityScore,
                url: q.questionUrl,
              })),
              null,
              2
            )}\n\`\`\``,
          },
        ],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `[错误] 获取知乎关注问题失败: ${errorMsg}`,
          },
        ],
      };
    }
  }
);

// Tool 2: Opportunity Analysis
server.tool(
  "analyze_following_questions",
  "深入分析关注问题的整体数据，产出蓝海问题清单、高流量热点清单与选题定位建议",
  {
    user_slug: z
      .string()
      .optional()
      .describe(`知乎用户的主页 slug (默认: ${DEFAULT_USER_SLUG})`),
    cookie: z
      .string()
      .optional()
      .describe("知乎请求 Cookie"),
    max_fetch: z
      .number()
      .optional()
      .describe("最大向知乎拉取的问题总数，默认 400"),
  },
  async ({ user_slug, cookie, max_fetch = 400 }) => {
    try {
      const targetSlug = user_slug || DEFAULT_USER_SLUG;
      const targetCookie = resolveCookie(cookie);

      const rawQuestions = await fetchFollowingQuestions({
        userSlug: targetSlug,
        cookie: targetCookie,
        maxFetch: max_fetch,
      });

      const ranked = rankQuestions(rawQuestions, { sortBy: "ratio" });

      // Categorizations
      const topBlueOcean = ranked.slice(0, 10);
      const megaHot = [...rawQuestions]
        .sort((a, b) => b.follower_count - a.follower_count)
        .slice(0, 10);
      const lowAnswerHighPotential = ranked
        .filter((q) => q.answer_count <= 20 && q.follower_count >= 100)
        .slice(0, 10);

      const totalFollowers = rawQuestions.reduce((acc, q) => acc + (q.follower_count || 0), 0);
      const totalAnswers = rawQuestions.reduce((acc, q) => acc + (q.answer_count || 0), 0);
      const avgRatio =
        rawQuestions.length > 0
          ? (totalFollowers / (totalAnswers + rawQuestions.length)).toFixed(2)
          : "0";

      const report = `# 知乎关注问题全景蓝海与价值分析报告

- **目标用户**: @${targetSlug}
- **关注问题总量**: ${rawQuestions.length} 个
- **总关注人次**: ${totalFollowers.toLocaleString()}
- **总回答数**: ${totalAnswers.toLocaleString()}
- **平均蓝海比 (关注/回答)**: ${avgRatio}

---

## 🔥 Top 10 核心蓝海问题（高关注量 / 低竞争）
这些问题拥有极高的关注基数，且回答量相对克制，是回答获得长尾曝光与高赞回答的最佳切入点：

${topBlueOcean
  .map(
    (q, i) =>
      `${i + 1}. **[${q.title}](${q.questionUrl})**\n   - 权重比: \`${q.ratio}\` | 关注数: **${q.follower_count}** | 回答数: **${q.answer_count}**`
  )
  .join("\n")}

---

## ⚡ Top 10 极低竞争潜力题（回答数 ≤ 20，关注数 ≥ 100）
回答者较少，只要输出一篇高质量专业回答极易冲上该问题前排：

${lowAnswerHighPotential
  .map(
    (q, i) =>
      `${i + 1}. **[${q.title}](${q.questionUrl})**\n   - 权重比: \`${q.ratio}\` | 关注数: **${q.follower_count}** | 回答数: **${q.answer_count}**`
  )
  .join("\n")}

---

## 🚀 Top 10 超级大流量热点题（总关注数最多）
这些是全网大流量池问题，适合作为长期技术或职场品牌建设的核心阵地：

${megaHot
  .map(
    (q, i) =>
      `${i + 1}. **[${q.title}](https://www.zhihu.com/question/${q.id})**\n   - 总关注数: **${q.follower_count.toLocaleString()}** | 总回答数: **${q.answer_count}**`
  )
  .join("\n")}
`;

      return {
        content: [
          {
            type: "text",
            text: report,
          },
        ],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `[错误] 分析知乎关注问题失败: ${errorMsg}`,
          },
        ],
      };
    }
  }
);

// Connect via Stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zhihu MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting Zhihu MCP Server:", err);
  process.exit(1);
});
