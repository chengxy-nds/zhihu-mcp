export interface ZhihuQuestion {
  id: string | number;
  title: string;
  url?: string;
  follower_count: number;
  answer_count: number;
  comment_count?: number;
  visit_count?: number;
  created?: number;
  updated_time?: number;
  question_type?: string;
}

export interface RankedQuestion extends ZhihuQuestion {
  rank: number;
  ratio: number;
  opportunityScore: number;
  questionUrl: string;
}

export interface FetchOptions {
  userSlug: string;
  cookie: string;
  maxFetch?: number;
  pageSize?: number;
  delayMs?: number;
  onProgress?: (fetched: number, total: number) => void;
}

export interface RankingOptions {
  sortBy?: "ratio" | "opportunity" | "followers" | "answers_asc";
  minFollowers?: number;
  maxAnswers?: number;
  keyword?: string;
  limit?: number;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

/**
 * Fetch all or up to `maxFetch` followed questions of a Zhihu member.
 */
export async function fetchFollowingQuestions(options: FetchOptions): Promise<ZhihuQuestion[]> {
  const {
    userSlug,
    cookie,
    maxFetch = 500,
    pageSize = 50,
    delayMs = 150,
    onProgress,
  } = options;

  if (!cookie || !cookie.trim()) {
    throw new Error(
      "Zhihu cookie is required. Please provide it via tool argument, ZHIHU_COOKIE environment variable, or configuration."
    );
  }

  const allQuestions: ZhihuQuestion[] = [];
  let offset = 0;
  let totals = 0;

  const headers: Record<string, string> = {
    accept: "*/*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    cookie: cookie.trim(),
    origin: "https://www.zhihu.com",
    referer: `https://www.zhihu.com/people/${encodeURIComponent(userSlug)}/following/questions`,
    "user-agent": DEFAULT_USER_AGENT,
    "x-requested-with": "fetch",
  };

  while (allQuestions.length < maxFetch) {
    const currentLimit = Math.min(pageSize, maxFetch - allQuestions.length);
    const apiUrl = `https://api.zhihu.com/members/${encodeURIComponent(
      userSlug
    )}/following-questions?include=data%5B*%5D.follower_count%2Canswer_count%2Ccomment_count%2Cvisit_count&offset=${offset}&limit=${currentLimit}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Zhihu API returned HTTP ${response.status} Forbidden/Unauthorized. Your Cookie may have expired or is invalid.`
        );
      }
      throw new Error(`Failed to fetch Zhihu questions: HTTP ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as {
      paging?: { is_end?: boolean; totals?: number };
      data?: ZhihuQuestion[];
    };

    const questions = json.data || [];
    if (questions.length === 0) {
      break;
    }

    allQuestions.push(...questions);
    totals = json.paging?.totals ?? allQuestions.length;

    if (onProgress) {
      onProgress(allQuestions.length, totals);
    }

    if (json.paging?.is_end || allQuestions.length >= totals || allQuestions.length >= maxFetch) {
      break;
    }

    offset += currentLimit;

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return allQuestions;
}

/**
 * Calculate opportunity score and rank questions based on weight criteria.
 */
export function rankQuestions(
  questions: ZhihuQuestion[],
  options: RankingOptions = {}
): RankedQuestion[] {
  const {
    sortBy = "ratio",
    minFollowers = 0,
    maxAnswers,
    keyword,
    limit,
  } = options;

  let filtered = questions.filter((q) => {
    const fc = q.follower_count || 0;
    const ac = q.answer_count || 0;

    if (fc < minFollowers) return false;
    if (maxAnswers !== undefined && ac > maxAnswers) return false;
    if (keyword && keyword.trim()) {
      const kw = keyword.toLowerCase();
      if (!q.title.toLowerCase().includes(kw)) return false;
    }
    return true;
  });

  const calculated: RankedQuestion[] = filtered.map((q) => {
    const fc = q.follower_count || 0;
    const ac = q.answer_count || 0;
    // Follower-to-answer ratio: followers / (answers + 1)
    const ratio = Math.round((fc / (ac + 1)) * 100) / 100;
    // Opportunity score: ratio * log10(followers + 1)
    const opportunityScore =
      Math.round(ratio * Math.log10(fc + 1) * 10) / 10;
    const questionUrl = `https://www.zhihu.com/question/${q.id}`;

    return {
      ...q,
      rank: 0,
      ratio,
      opportunityScore,
      questionUrl,
    };
  });

  // Sort based on strategy
  calculated.sort((a, b) => {
    if (sortBy === "opportunity") {
      if (b.opportunityScore !== a.opportunityScore) {
        return b.opportunityScore - a.opportunityScore;
      }
      return b.follower_count - a.follower_count;
    }
    if (sortBy === "followers") {
      if (b.follower_count !== a.follower_count) {
        return b.follower_count - a.follower_count;
      }
      return a.answer_count - b.answer_count;
    }
    if (sortBy === "answers_asc") {
      if (a.answer_count !== b.answer_count) {
        return a.answer_count - b.answer_count;
      }
      return b.follower_count - a.follower_count;
    }
    // Default: ratio (followers / (answers + 1))
    if (b.ratio !== a.ratio) {
      return b.ratio - a.ratio;
    }
    return b.follower_count - a.follower_count;
  });

  // Assign 1-indexed ranks
  calculated.forEach((q, idx) => {
    q.rank = idx + 1;
  });

  if (limit !== undefined && limit > 0) {
    return calculated.slice(0, limit);
  }

  return calculated;
}

/**
 * Format ranked questions as a GitHub Markdown table.
 */
export function formatQuestionsMarkdown(
  questions: RankedQuestion[],
  options?: { title?: string; totalAvailable?: number }
): string {
  const title = options?.title || "知乎关注问题权重分析列表";
  const lines: string[] = [];

  lines.push(`### ${title}`);
  if (options?.totalAvailable !== undefined) {
    lines.push(`> 共检索到 **${options.totalAvailable}** 个关注问题，当前展示前 **${questions.length}** 个（按关注度/回答量比值降序）\n`);
  }

  lines.push(
    `| 排名 | 权重比 | 机会分 | 关注数 | 回答数 | 问题标题 | 链接 |`
  );
  lines.push(
    `| :---: | :---: | :---: | :---: | :---: | :--- | :---: |`
  );

  for (const q of questions) {
    const cleanTitle = q.title.replace(/\|/g, "\\|").trim();
    lines.push(
      `| ${q.rank} | **${q.ratio.toFixed(2)}** | ${q.opportunityScore.toFixed(1)} | ${q.follower_count} | ${q.answer_count} | [${cleanTitle}](${q.questionUrl}) | [查看](https://www.zhihu.com/question/${q.id}) |`
    );
  }

  return lines.join("\n");
}
