# zhihu-mcp

> **知乎 MCP 服务器**：一键拉取知乎关注问题，基于【**高关注、少回答**】的供需关系算法智能排序，精准挖掘蓝海潜力问题与创作选题。

---

## 🌟 核心特性

- 🎯 **蓝海权重算法**：默认以 `关注人数 / (回答人数 + 1)` 计算供求比率，优先推荐关注基数大且回答竞争少的潜力问题。
- 📊 **多种排序策略**：
  - `ratio`（默认）：纯关注/回答比率，极高 ROI 发现器。
  - `opportunity`：结合对数加权关注总量的综合机会指数。
  - `followers`：纯关注量降序，大流量池池底挖掘。
  - `answers_asc`：回答数升序，优先发现新提问或低竞争题。
- 🔍 **多维过滤**：支持 `min_followers`（关注数门槛）、`max_answers`（回答数上限）、`keyword`（标题关键词过滤）。
- 🔌 **标准 MCP 协议**：基于 `@modelcontextprotocol/sdk` 构建，支持 Claude Desktop、Cursor、Antigravity IDE、Windsurf 等任意 MCP 客户端。
- 💻 **独立 CLI 工具**：无需启动 MCP 客户端，在终端直接运行 `pnpm cli`，自动导出全量 Markdown 表格与 JSON 数据。

---

## 🚀 快速开始

### 1. 安装依赖与构建

```bash
pnpm install
pnpm run build
```

### 2. 命令行直接运行（CLI）

拉取关注问题并自动在 `./output/` 下生成 `ranked_questions.md` 和 `ranked_questions.json`：

```bash
# 默认拉取 xiaofucode
pnpm run cli

# 指定其他知乎用户名/slug
pnpm run cli <user_slug>
```

---

## 🛠️ MCP 客户端配置

### 1. Antigravity IDE / Cursor / Claude Desktop 配置

编辑你的 MCP 配置文件（如 `~/.gemini/config/mcp_config.json` 或 `claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "zhihu": {
      "command": "node",
      "args": ["/Users/apple/GithubProjects/zhihu-mcp/dist/index.js"],
      "env": {
        "ZHIHU_COOKIE": "你的知乎Cookie（可选，项目内置了默认凭据）"
      }
    }
  }
}
```

> **Cookie 优先级**：
> 1. MCP 工具调用时传入的 `cookie` 参数
> 2. 环境变量 `ZHIHU_COOKIE`
> 3. 项目根目录下的 `.cookie` 文件
> 4. 内置默认 Cookie

---

## 🧰 MCP 工具列表

### 1. `get_following_questions`
拉取指定用户的关注问题并按照设定的权重算法排序输出。

**参数说明**：
- `user_slug` (string, 可选): 知乎用户主页 Slug，默认 `xiaofucode`。
- `sort_by` (string, 可选): 排序策略，可选 `ratio` (默认)、`opportunity`、`followers`、`answers_asc`。
- `min_followers` (number, 可选): 关注人数下限过滤。
- `max_answers` (number, 可选): 回答人数上限过滤。
- `keyword` (string, 可选): 标题关键词匹配过滤（如 `"Java"`、`"架构"`、`"Agent"`）。
- `limit` (number, 可选): 返回条数限制，默认 `50`。
- `max_fetch` (number, 可选): 抓取上限，默认 `400`。
- `cookie` (string, 可选): 自定义请求 Cookie。

### 2. `analyze_following_questions`
对关注的问题进行全景蓝海与高价值度分析报告，输出 Top 核心蓝海题、Top 低竞争潜力题、Top 超级大流量热点题与选题定位建议。

---

## 📐 算法原理

$$Ratio = \frac{\text{Followers}}{\text{Answers} + 1}$$

- **分母 $+1$ 平滑处理**：防止回答数为 0 时产生除零异常（拉普拉斯平滑思想）。
- **指标解读**：
  - 权重比越大，代表该问题的**读者关注度极高**，而**答主竞争极低**。
  - 是技术内容创作者、个人 IP 答主抢占知乎 SEO 搜索流量和高赞排名的黄金选题。

---

## 📄 许可证

MIT License
