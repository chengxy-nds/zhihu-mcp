(function () {
  // Global Application State
  const state = {
    allQuestions: [],
    filteredQuestions: [],
    currentPage: 1,
    pageSize: 30,
    searchKeyword: "",
    minFollowers: 0,
    maxAnswers: null,
    sortBy: "ratio",
    activePreset: "all",
    viewMode: "table",
  };

  // DOM Elements
  const el = {
    statTotalQuestions: document.getElementById("stat-total-questions"),
    statTotalFollowers: document.getElementById("stat-total-followers"),
    statTotalAnswers: document.getElementById("stat-total-answers"),
    statAvgRatio: document.getElementById("stat-avg-ratio"),
    statHighPotential: document.getElementById("stat-high-potential"),

    searchInput: document.getElementById("search-input"),
    clearSearchBtn: document.getElementById("clear-search"),
    minFollowersInput: document.getElementById("min-followers"),
    maxAnswersInput: document.getElementById("max-answers"),
    sortSelect: document.getElementById("sort-select"),
    presetChips: document.querySelectorAll(".preset-chips-row .chip"),

    resultCount: document.getElementById("result-count"),
    viewTableBtn: document.getElementById("view-table-btn"),
    viewCardBtn: document.getElementById("view-card-btn"),
    tableContainer: document.getElementById("table-container"),
    cardsContainer: document.getElementById("cards-container"),
    questionsTbody: document.getElementById("questions-tbody"),
    emptyState: document.getElementById("empty-state"),

    pageSizeSelect: document.getElementById("page-size-select"),
    pageControls: document.getElementById("page-controls"),
    toastContainer: document.getElementById("toast-container"),

    refreshBtn: document.getElementById("refresh-btn"),
    exportBtn: document.getElementById("export-btn"),
  };

  // Initialize
  async function init() {
    setupEventListeners();
    await loadData();
  }

  // Load Data: Try API first, fallback to preloaded window.INITIAL_QUESTIONS
  async function loadData() {
    try {
      const res = await fetch("/api/questions");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          state.allQuestions = normalizeQuestions(data);
          onDataLoaded();
          return;
        }
      }
    } catch {
      // API not available, proceed to fallback
    }

    if (window.INITIAL_QUESTIONS && Array.isArray(window.INITIAL_QUESTIONS)) {
      state.allQuestions = normalizeQuestions(window.INITIAL_QUESTIONS);
      onDataLoaded();
    } else {
      showToast("未检测到数据，请检查网络或后端服务", "error");
    }
  }

  function normalizeQuestions(questions) {
    return questions.map((q, idx) => {
      const fc = Number(q.follower_count || 0);
      const ac = Number(q.answer_count || 0);
      const ratio = Number(q.ratio || (fc / (ac + 1)).toFixed(2));
      const opp = Number(
        q.opportunityScore || (ratio * Math.log10(fc + 1)).toFixed(1)
      );

      return {
        id: q.id,
        title: q.title || "",
        follower_count: fc,
        answer_count: ac,
        ratio: ratio,
        opportunityScore: opp,
        rank: q.rank || idx + 1,
        created: q.created || 0,
        updated_time: q.updated_time || 0,
        questionUrl: q.questionUrl || `https://www.zhihu.com/question/${q.id}`,
      };
    });
  }

  function onDataLoaded() {
    renderStats();
    updatePresetCounts();
    applyFilterAndSort();
  }

  // Calculate and Render Overview Stats
  function renderStats() {
    const list = state.allQuestions;
    const totalQ = list.length;
    const totalF = list.reduce((acc, q) => acc + q.follower_count, 0);
    const totalA = list.reduce((acc, q) => acc + q.answer_count, 0);
    const avgRatio =
      totalQ > 0 ? (totalF / (totalA + totalQ)).toFixed(2) : "0.00";
    const highPot = list.filter((q) => q.ratio >= 30).length;

    el.statTotalQuestions.textContent = totalQ.toLocaleString();
    el.statTotalFollowers.textContent = totalF.toLocaleString();
    el.statTotalAnswers.textContent = totalA.toLocaleString();
    el.statAvgRatio.textContent = avgRatio;
    el.statHighPotential.textContent = highPot.toLocaleString();
  }

  function updatePresetCounts() {
    const list = state.allQuestions;
    el.presetChips.forEach((chip) => {
      const preset = chip.dataset.preset;
      let count = 0;
      if (preset === "all") count = list.length;
      else if (preset === "blue-ocean") count = list.filter((q) => q.ratio >= 30).length;
      else if (preset === "low-comp") count = list.filter((q) => q.answer_count <= 20 && q.follower_count >= 100).length;
      else if (preset === "mega-hot") count = list.filter((q) => q.follower_count >= 10000).length;
      else if (preset === "tag-java") count = list.filter((q) => /java|spring|jvm|mybatis|tomcat/i.test(q.title)).length;
      else if (preset === "tag-arch") count = list.filter((q) => /架构|设计|重构|模式|原则/i.test(q.title)).length;
      else if (preset === "tag-dist") count = list.filter((q) => /分布式|kafka|mq|raft|paxos|一致性|幂等/i.test(q.title)).length;
      else if (preset === "tag-db") count = list.filter((q) => /mysql|redis|数据库|nosql|索引|分库分表|clickhouse/i.test(q.title)).length;
      else if (preset === "tag-ai") count = list.filter((q) => /ai|agent|大模型|智能体|gpt|prompt/i.test(q.title)).length;

      const baseLabel = chip.textContent.split(" [")[0].split(" (")[0];
      chip.textContent = `${baseLabel} [${count}]`;
    });
  }

  // Filter & Sort Logic
  function applyFilterAndSort() {
    let result = [...state.allQuestions];

    // 1. Search keyword
    const kw = state.searchKeyword.trim().toLowerCase();
    if (kw) {
      result = result.filter((q) => q.title.toLowerCase().includes(kw));
    }

    // 2. Preset Filter
    switch (state.activePreset) {
      case "blue-ocean":
        result = result.filter((q) => q.ratio >= 30);
        break;
      case "low-comp":
        result = result.filter(
          (q) => q.answer_count <= 20 && q.follower_count >= 100
        );
        break;
      case "mega-hot":
        result = result.filter((q) => q.follower_count >= 10000);
        break;
      case "tag-java":
        result = result.filter((q) =>
          /java|spring|jvm|mybatis|tomcat/i.test(q.title)
        );
        break;
      case "tag-arch":
        result = result.filter((q) =>
          /架构|设计|重构|模式|原则/i.test(q.title)
        );
        break;
      case "tag-dist":
        result = result.filter((q) =>
          /分布式|kafka|mq|raft|paxos|一致性|幂等/i.test(q.title)
        );
        break;
      case "tag-db":
        result = result.filter((q) =>
          /mysql|redis|数据库|nosql|索引|分库分表|clickhouse/i.test(q.title)
        );
        break;
      case "tag-ai":
        result = result.filter((q) =>
          /ai|agent|大模型|智能体|gpt|prompt/i.test(q.title)
        );
        break;
    }

    // 3. Numeric Filters
    if (state.minFollowers > 0) {
      result = result.filter((q) => q.follower_count >= state.minFollowers);
    }
    if (state.maxAnswers !== null && state.maxAnswers !== undefined) {
      result = result.filter((q) => q.answer_count <= state.maxAnswers);
    }

    // 4. Sort
    result.sort((a, b) => {
      switch (state.sortBy) {
        case "ratio":
          if (b.ratio !== a.ratio) return b.ratio - a.ratio;
          return b.follower_count - a.follower_count;
        case "opportunityScore":
          if (b.opportunityScore !== a.opportunityScore)
            return b.opportunityScore - a.opportunityScore;
          return b.follower_count - a.follower_count;
        case "follower_count":
          if (b.follower_count !== a.follower_count)
            return b.follower_count - a.follower_count;
          return a.answer_count - b.answer_count;
        case "answer_count_asc":
          if (a.answer_count !== b.answer_count)
            return a.answer_count - b.answer_count;
          return b.follower_count - a.follower_count;
        case "answer_count_desc":
          if (b.answer_count !== a.answer_count)
            return b.answer_count - a.answer_count;
          return b.follower_count - a.follower_count;
        case "created":
          return (b.created || 0) - (a.created || 0);
        default:
          return b.ratio - a.ratio;
      }
    });

    state.filteredQuestions = result;
    state.currentPage = 1;
    renderCurrentPage();
  }

  // Render Current Page
  function renderCurrentPage() {
    const total = state.filteredQuestions.length;

    if (total === 0) {
      el.tableContainer.style.display = "none";
      el.cardsContainer.style.display = "none";
      el.emptyState.style.display = "block";
      el.resultCount.innerHTML = `未检索到匹配问题`;
      renderPagination(0);
      return;
    }

    el.emptyState.style.display = "none";
    if (state.viewMode === "table") {
      el.tableContainer.style.display = "block";
      el.cardsContainer.style.display = "none";
    } else {
      el.tableContainer.style.display = "none";
      el.cardsContainer.style.display = "grid";
    }

    let pagedItems = [];
    if (state.pageSize === -1) {
      pagedItems = state.filteredQuestions;
      el.resultCount.innerHTML = `检索到 <strong>${total}</strong> 个问题，当前展示全部`;
    } else {
      const startIdx = (state.currentPage - 1) * state.pageSize;
      const endIdx = Math.min(startIdx + state.pageSize, total);
      pagedItems = state.filteredQuestions.slice(startIdx, endIdx);
      el.resultCount.innerHTML = `检索到 <strong>${total}</strong> 个问题，当前展示 <strong>${
        startIdx + 1
      } - ${endIdx}</strong>`;
    }

    if (state.viewMode === "table") {
      renderTable(pagedItems);
    } else {
      renderCards(pagedItems);
    }

    renderPagination(total);
  }

  function getTierBadge(ratio) {
    if (ratio >= 50) return `<span class="tier-tag tier-sss">SSS 蓝海</span>`;
    if (ratio >= 30) return `<span class="tier-tag tier-ss">SS 热选</span>`;
    if (ratio >= 15) return `<span class="tier-tag tier-s">S 优质</span>`;
    if (ratio >= 8) return `<span class="tier-tag tier-a">A 潜力</span>`;
    return "";
  }

  function highlightText(text, keyword) {
    if (!keyword) return escapeHtml(text);
    const escapedText = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(keyword)})`, "gi");
    return escapedText.replace(regex, `<span class="highlight">$1</span>`);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  // Render Table View
  function renderTable(items) {
    const kw = state.searchKeyword.trim();
    const rows = items.map((q, index) => {
      const actualRank =
        state.pageSize === -1
          ? index + 1
          : (state.currentPage - 1) * state.pageSize + index + 1;

      let rankBadgeClass = "rank-badge";
      if (actualRank === 1) rankBadgeClass += " top-1";
      else if (actualRank === 2) rankBadgeClass += " top-2";
      else if (actualRank === 3) rankBadgeClass += " top-3";

      const tierBadge = getTierBadge(q.ratio);
      const highlightedTitle = highlightText(q.title, kw);
      const answersClass =
        q.answer_count <= 20 ? "answers-metric low" : "answers-metric";

      return `
        <tr>
          <td style="text-align: center;">
            <span class="${rankBadgeClass}">${actualRank}</span>
          </td>
          <td>
            <span class="ratio-chip">${q.ratio.toFixed(2)}</span>
          </td>
          <td class="title-cell">
            ${tierBadge}
            <a href="${q.questionUrl}" target="_blank" rel="noopener noreferrer" class="question-title-link">
              ${highlightedTitle}
            </a>
          </td>
          <td>
            <span class="metric-num followers-metric">${q.follower_count.toLocaleString()}</span>
          </td>
          <td>
            <span class="metric-num ${answersClass}">${q.answer_count.toLocaleString()}</span>
          </td>
          <td>
            <span class="metric-num" style="color: var(--claude-terracotta);">${q.opportunityScore.toFixed(1)}</span>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="table-action-btn" onclick="window.copyText('${escapeHtml(q.title)}', '已复制问题标题')" title="复制问题标题">
                复制
              </button>
              <a href="${q.questionUrl}" target="_blank" rel="noopener noreferrer" class="table-action-btn" title="直达知乎原题">
                直达 ↗
              </a>
            </div>
          </td>
        </tr>
      `;
    });

    el.questionsTbody.innerHTML = rows.join("");
  }

  // Render Card View
  function renderCards(items) {
    const kw = state.searchKeyword.trim();
    const cards = items.map((q, index) => {
      const actualRank =
        state.pageSize === -1
          ? index + 1
          : (state.currentPage - 1) * state.pageSize + index + 1;

      let rankBadgeClass = "rank-badge";
      if (actualRank === 1) rankBadgeClass += " top-1";
      else if (actualRank === 2) rankBadgeClass += " top-2";
      else if (actualRank === 3) rankBadgeClass += " top-3";

      const tierBadge = getTierBadge(q.ratio);
      const highlightedTitle = highlightText(q.title, kw);

      return `
        <div class="question-card">
          <div class="card-top">
            <span class="${rankBadgeClass}">#${actualRank}</span>
            <span class="ratio-chip">权重比: ${q.ratio.toFixed(2)}</span>
          </div>
          <div class="card-title">
            ${tierBadge}
            <a href="${q.questionUrl}" target="_blank" rel="noopener noreferrer" class="question-title-link">
              ${highlightedTitle}
            </a>
          </div>
          <div class="card-metrics">
            <div class="metric-item">
              <div class="metric-label">关注人数</div>
              <div class="metric-value followers-metric">${q.follower_count.toLocaleString()}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">回答总数</div>
              <div class="metric-value ${q.answer_count <= 20 ? 'answers-metric low' : 'answers-metric'}">
                ${q.answer_count.toLocaleString()}
              </div>
            </div>
            <div class="metric-item">
              <div class="metric-label">综合机会分</div>
              <div class="metric-value" style="color: var(--claude-terracotta);">${q.opportunityScore.toFixed(1)}</div>
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="window.copyText('${escapeHtml(q.title)}', '已复制标题')">
              📋 复制标题
            </button>
            <a href="${q.questionUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;">
              知乎直达 ↗
            </a>
          </div>
        </div>
      `;
    });

    el.cardsContainer.innerHTML = cards.join("");
  }

  // Render Pagination Buttons
  function renderPagination(total) {
    if (state.pageSize === -1 || total <= state.pageSize) {
      el.pageControls.innerHTML = "";
      return;
    }

    const totalPages = Math.ceil(total / state.pageSize);
    const cur = state.currentPage;
    const buttons = [];

    // Prev
    buttons.push(`
      <button class="page-btn" ${cur === 1 ? "disabled" : ""} data-page="${cur - 1}">
        ‹
      </button>
    `);

    // Page range logic
    let startPage = Math.max(1, cur - 2);
    let endPage = Math.min(totalPages, cur + 2);

    if (startPage > 1) {
      buttons.push(`<button class="page-btn" data-page="1">1</button>`);
      if (startPage > 2) {
        buttons.push(`<span style="color: var(--text-muted); padding: 0 4px;">...</span>`);
      }
    }

    for (let p = startPage; p <= endPage; p++) {
      buttons.push(`
        <button class="page-btn ${p === cur ? "active" : ""}" data-page="${p}">
          ${p}
        </button>
      `);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(`<span style="color: var(--text-muted); padding: 0 4px;">...</span>`);
      }
      buttons.push(`<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`);
    }

    // Next
    buttons.push(`
      <button class="page-btn" ${cur === totalPages ? "disabled" : ""} data-page="${cur + 1}">
        ›
      </button>
    `);

    el.pageControls.innerHTML = buttons.join("");
  }

  // Event Listeners Setup
  function setupEventListeners() {
    // Search input (debounced)
    let searchTimer = null;
    el.searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      el.clearSearchBtn.style.display = val ? "block" : "none";
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.searchKeyword = val;
        applyFilterAndSort();
      }, 150);
    });

    el.clearSearchBtn.addEventListener("click", () => {
      el.searchInput.value = "";
      el.clearSearchBtn.style.display = "none";
      state.searchKeyword = "";
      applyFilterAndSort();
    });

    // Min followers input
    el.minFollowersInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      state.minFollowers = isNaN(val) ? 0 : val;
      applyFilterAndSort();
    });

    // Max answers input
    el.maxAnswersInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      state.maxAnswers = isNaN(val) ? null : val;
      applyFilterAndSort();
    });

    // Sort select
    el.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      applyFilterAndSort();
    });

    // Table header sort
    document.querySelectorAll(".data-table th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (col === "ratio") state.sortBy = "ratio";
        else if (col === "opportunityScore") state.sortBy = "opportunityScore";
        else if (col === "follower_count") state.sortBy = "follower_count";
        else if (col === "answer_count") {
          state.sortBy =
            state.sortBy === "answer_count_asc"
              ? "answer_count_desc"
              : "answer_count_asc";
        }
        el.sortSelect.value = state.sortBy;
        applyFilterAndSort();
      });
    });

    // Preset chips
    el.presetChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        el.presetChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.activePreset = chip.dataset.preset;
        applyFilterAndSort();
      });
    });

    // View toggles
    el.viewTableBtn.addEventListener("click", () => {
      state.viewMode = "table";
      el.viewTableBtn.classList.add("active");
      el.viewCardBtn.classList.remove("active");
      renderCurrentPage();
    });

    el.viewCardBtn.addEventListener("click", () => {
      state.viewMode = "card";
      el.viewCardBtn.classList.add("active");
      el.viewTableBtn.classList.remove("active");
      renderCurrentPage();
    });

    // Page size
    el.pageSizeSelect.addEventListener("change", (e) => {
      state.pageSize = parseInt(e.target.value, 10);
      state.currentPage = 1;
      renderCurrentPage();
    });

    // Pagination delegation
    el.pageControls.addEventListener("click", (e) => {
      const btn = e.target.closest(".page-btn");
      if (btn && !btn.disabled) {
        state.currentPage = parseInt(btn.dataset.page, 10);
        renderCurrentPage();
        window.scrollTo({ top: 350, behavior: "smooth" });
      }
    });

    // Export button
    el.exportBtn.addEventListener("click", () => {
      exportCurrentResults();
    });

    // Refresh from API
    el.refreshBtn.addEventListener("click", async () => {
      el.refreshBtn.disabled = true;
      el.refreshBtn.innerHTML = `<span>⏳</span> 正在抓取...`;
      try {
        const resp = await fetch("/api/refresh", { method: "POST" });
        if (resp.ok) {
          const freshData = await resp.json();
          if (Array.isArray(freshData)) {
            state.allQuestions = normalizeQuestions(freshData);
            onDataLoaded();
            showToast("成功更新知乎最新关注问题！");
          }
        } else {
          showToast("抓取失败，当前运行在静态模式", "error");
        }
      } catch {
        showToast("无法连接后端抓取服务，已展示本地数据");
      } finally {
        el.refreshBtn.disabled = false;
        el.refreshBtn.innerHTML = `<span>🔄</span> 重新拉取`;
      }
    });
  }

  // Toast System
  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${type === "error" ? "❌" : "✨"}</span> <span>${message}</span>`;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // Copy to clipboard helper
  window.copyText = function (text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || "已复制到剪贴板");
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(successMsg || "已复制到剪贴板");
    }
  };

  // Export current filtered list as CSV / Markdown
  function exportCurrentResults() {
    const list = state.filteredQuestions;
    if (list.length === 0) {
      showToast("当前没有可导出的数据", "error");
      return;
    }

    const headers = ["排名", "权重比", "机会分", "关注数", "回答数", "标题", "链接"];
    const rows = list.map((q, i) => [
      i + 1,
      q.ratio,
      q.opportunityScore,
      q.follower_count,
      q.answer_count,
      `"${q.title.replace(/"/g, '""')}"`,
      q.questionUrl,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `知乎蓝海问题导出_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`已成功导出 ${list.length} 条数据为 CSV`);
  }

  // Start app on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
