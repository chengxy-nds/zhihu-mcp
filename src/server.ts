import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { resolveCookie, DEFAULT_USER_SLUG } from "./config.js";
import { fetchFollowingQuestions, rankQuestions } from "./zhihu.js";

const PORT = Number(process.env.PORT) || 3333;
const PROJECT_ROOT = process.cwd();
const WEB_DIR = path.resolve(PROJECT_ROOT, "web");
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, "output");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: GET /api/questions
  if (req.method === "GET" && pathname === "/api/questions") {
    try {
      const jsonPath = path.join(OUTPUT_DIR, "ranked_questions.json");
      if (fs.existsSync(jsonPath)) {
        const content = fs.readFileSync(jsonPath, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(content);
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end("[]");
      return;
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: String(err) }));
      return;
    }
  }

  // API 2: POST /api/refresh
  if (req.method === "POST" && pathname === "/api/refresh") {
    try {
      console.log(`[API] 收到实时拉取请求，正在同步知乎最新关注问题...`);
      const cookie = resolveCookie();
      const raw = await fetchFollowingQuestions({
        userSlug: DEFAULT_USER_SLUG,
        cookie,
        maxFetch: 500,
      });

      const ranked = rankQuestions(raw, { sortBy: "ratio" });

      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(OUTPUT_DIR, "ranked_questions.json"),
        JSON.stringify(ranked, null, 2),
        "utf-8"
      );
      fs.writeFileSync(
        path.join(WEB_DIR, "data.js"),
        `window.INITIAL_QUESTIONS = ${JSON.stringify(ranked, null, 2)};\n`,
        "utf-8"
      );

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(ranked));
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: msg }));
      return;
    }
  }

  // Static File Serving
  let filePath = path.join(WEB_DIR, pathname === "/" ? "index.html" : pathname);

  // Security check: stay within WEB_DIR
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 知乎关注问题机会分析查询系统已启动:`);
  console.log(`👉 本地访问地址: http://localhost:${PORT}`);
  console.log(`📁 静态文件目录: ${WEB_DIR}`);
});
