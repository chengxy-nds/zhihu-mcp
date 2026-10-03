#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { resolveCookie, DEFAULT_USER_SLUG } from "./config.js";
import {
  fetchFollowingQuestions,
  rankQuestions,
  formatQuestionsMarkdown,
} from "./zhihu.js";

async function run() {
  const args = process.argv.slice(2);
  const userSlug = args[0] || DEFAULT_USER_SLUG;
  const cookie = resolveCookie();

  console.log(`\n🔍 正在拉取用户 @${userSlug} 的知乎关注问题...`);
  console.log(`📡 请求目标: https://www.zhihu.com/people/${userSlug}/following/questions\n`);

  try {
    const rawQuestions = await fetchFollowingQuestions({
      userSlug,
      cookie,
      maxFetch: 500,
      onProgress(fetched, total) {
        process.stdout.write(`\r📥 已拉取: ${fetched}/${total} 个问题...`);
      },
    });

    console.log(`\n✅ 拉取完成！共获得 ${rawQuestions.length} 个关注问题。\n`);

    // Rank questions
    const ranked = rankQuestions(rawQuestions, {
      sortBy: "ratio",
    });

    // Save outputs
    const outputDir = path.resolve(process.cwd(), "output");
    fs.mkdirSync(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, "ranked_questions.json");
    fs.writeFileSync(jsonPath, JSON.stringify(ranked, null, 2), "utf-8");

    const mdPath = path.join(outputDir, "ranked_questions.md");
    const mdContent = formatQuestionsMarkdown(ranked, {
      title: `知乎用户 @${userSlug} 关注问题全量机会排名榜单`,
      totalAvailable: rawQuestions.length,
    });
    fs.writeFileSync(mdPath, mdContent, "utf-8");

    console.log(`💾 数据已成功保存到:`);
    console.log(`   - Markdown 榜单: ${mdPath}`);
    console.log(`   - JSON 完整数据: ${jsonPath}\n`);

    console.log(`🏆 Top 20 蓝海机会问题精选：\n`);
    for (const q of ranked.slice(0, 20)) {
      console.log(
        `${String(q.rank).padStart(2, " ")}. [权重比: ${q.ratio.toFixed(2).padStart(6, " ")}] ` +
          `关注: ${String(q.follower_count).padStart(5, " ")} | 回答: ${String(q.answer_count).padStart(4, " ")} | ` +
          `${q.title} (${q.questionUrl})`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ 执行出错: ${msg}`);
    process.exit(1);
  }
}

run();
