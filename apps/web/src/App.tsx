import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AudioLines,
  BookOpen,
  Captions,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Cog,
  Database,
  Download,
  Film,
  FolderOpen,
  Gauge,
  History,
  Home,
  Image,
  Languages,
  Layers,
  Monitor,
  MoreVertical,
  PackageOpen,
  PencilLine,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Wrench,
  X
} from "lucide-react";
import type { Language, Ratio, SubtitleCue, VideoScript } from "@trendforge/core";
import { api } from "./api";
import type { JobRow, LogRow, ProjectDetail, SourceInfo, SystemStatusMap } from "./types";

type UiLang = "zh" | "en";
type ViewId = "studio" | "history" | "tools" | "templates" | "settings" | "guide";
type TabId = "content" | "script" | "voice" | "subtitles" | "cover" | "template" | "export" | "logs";

const tabs: Array<{ id: TabId; icon: typeof Database; zh: string; en: string }> = [
  { id: "content", icon: Database, zh: "内容", en: "Content" },
  { id: "script", icon: Wand2, zh: "脚本", en: "Script" },
  { id: "subtitles", icon: Captions, zh: "字幕", en: "Subtitles" },
  { id: "voice", icon: AudioLines, zh: "配音", en: "Voice" },
  { id: "cover", icon: Image, zh: "封面", en: "Cover" },
  { id: "template", icon: Layers, zh: "模板", en: "Template" },
  { id: "export", icon: Download, zh: "导出", en: "Export" },
  { id: "logs", icon: Activity, zh: "日志", en: "Logs" }
];

const navItems: Array<{ id: ViewId; icon: typeof Gauge; zh: string; en: string }> = [
  { id: "studio", icon: Home, zh: "首页", en: "Home" },
  { id: "history", icon: History, zh: "历史项目", en: "History" },
  { id: "tools", icon: Wrench, zh: "视频工具箱", en: "Toolbox" },
  { id: "templates", icon: PackageOpen, zh: "模板中心", en: "Templates" },
  { id: "settings", icon: Cog, zh: "设置", en: "Settings" },
  { id: "guide", icon: BookOpen, zh: "使用引导", en: "Guide" }
];

const copy = {
  zh: {
    brandSub: "本地 AI 视频工作台",
    newProject: "新建视频项目",
    recentProjects: "历史项目",
    viewAll: "查看全部",
    ready: "系统就绪",
    refresh: "刷新",
    studioEyebrow: "输入主题或选择数据源，AI 将为你生成多个视频方案",
    commandDeck: "用 AI，把热点变成视频",
    systemOverview: "系统状态",
    previewTitle: "等待脚本生成",
    previewDesc: "选择内容来源后生成可编辑视频脚本",
    timeline: "场景时间线",
    timelineEmpty: "脚本生成后显示场景时长",
    currentTask: "当前任务",
    queueIdle: "任务队列空闲",
    exportParams: "导出参数",
    ratio: "比例",
    template: "模板",
    status: "状态",
    bottomLog: "等待任务日志",
    projectCreated: "项目已创建",
    sourceSaved: "热点内容已保存",
    scriptStarted: "脚本任务已启动",
    scriptSaved: "脚本已保存",
    voiceStarted: "可选配音任务已启动",
    subtitlesGenerated: "字幕已生成",
    subtitlesSaved: "字幕已保存",
    coverGenerated: "封面已生成",
    templateSaved: "模板已切换",
    renderStarted: "渲染任务已启动",
    settingsSaved: "设置已保存",
    language: "界面语言",
    outputFile: "输出文件",
    openFolder: "打开文件夹",
    noOutput: "尚未渲染，点击渲染视频后输出到本地",
    renderDone: "渲染完成！",
  },
  en: {
    brandSub: "Local AI Video Workstation",
    newProject: "New Project",
    recentProjects: "Recent Projects",
    viewAll: "View all",
    ready: "System ready",
    refresh: "Refresh",
    studioEyebrow: "Enter a topic or choose a source. AI generates multiple video plans.",
    commandDeck: "Turn Trends into Video with AI",
    systemOverview: "System Status",
    previewTitle: "Waiting for script",
    previewDesc: "Fetch content, then generate an editable video script",
    timeline: "Scene Timeline",
    timelineEmpty: "Scenes appear after script generation",
    currentTask: "Current Task",
    queueIdle: "Queue idle",
    exportParams: "Export Settings",
    ratio: "Ratio",
    template: "Template",
    status: "Status",
    bottomLog: "Waiting for task logs",
    projectCreated: "Project created",
    sourceSaved: "Content saved",
    scriptStarted: "Script job started",
    scriptSaved: "Script saved",
    voiceStarted: "Optional voice job started",
    subtitlesGenerated: "Subtitles generated",
    subtitlesSaved: "Subtitles saved",
    coverGenerated: "Cover generated",
    templateSaved: "Template updated",
    renderStarted: "Render job started",
    settingsSaved: "Settings saved",
    language: "Language",
    outputFile: "Output File",
    openFolder: "Open Folder",
    noOutput: "Not rendered yet. Click Render Video to export.",
    renderDone: "Render complete!",
  }
} as const;

// ─── Toast System ─────────────────────────────────────────────────
type Toast = { id: string; type: "success" | "error" | "info"; message: string };

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function push(type: Toast["type"], message: string) {
    const id = String(Date.now());
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  }
  return { toasts, push };
}

export function App() {
  const [lang, setLang] = useState<UiLang>("zh");
  const [view, setView] = useState<ViewId>("studio");
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<ProjectDetail>();
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [status, setStatus] = useState<SystemStatusMap>({});
  const [settings, setSettings] = useState<Record<string, string | undefined>>({});
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("content");
  const [job, setJob] = useState<JobRow>();
  const [message, setMessage] = useState<string>(copy.zh.ready);
  const { toasts, push } = useToast();

  const c = copy[lang];

  async function refresh(nextSelectedId = selectedId) {
    const [projectRows, sourceRows, statusRows, settingRows] = await Promise.all([api.projects(), api.sources(), api.status(), api.settings()]);
    setProjects(projectRows as ProjectDetail[]);
    setSources(sourceRows);
    setStatus(statusRows);
    setSettings(settingRows);
    const nextId = nextSelectedId ?? projectRows[0]?.id;
    if (nextId) {
      setSelectedId(nextId);
      const nextDetail = await api.project(nextId);
      setDetail(nextDetail);
      setLogs(await api.logs(nextId));
    }
  }

  useEffect(() => {
    void refresh().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!job || job.status === "success" || job.status === "failed" || job.status === "canceled") {
      if (job?.status === "success") {
        push("success", lang === "zh" ? c.renderDone : c.renderDone);
        void refresh(selectedId);
      }
      if (job?.status === "failed") push("error", job.error_message ?? (lang === "zh" ? "任务失败" : "Job failed"));
      return;
    }
    const timer = setInterval(async () => {
      const next = await api.job(job.id);
      setJob(next);
      if (detail?.id) {
        setDetail(await api.project(detail.id));
        setLogs(await api.logs(detail.id));
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [job?.id, job?.status, detail?.id]);

  async function createProject() {
    const project = await api.createProject(lang === "zh" ? "今日 AI 产品信号" : "Today AI Product Signals", "9:16");
    setSelectedId(project.id);
    setView("studio");
    setActiveTab("content");
    setMessage(c.projectCreated);
    push("success", c.projectCreated);
    await refresh(project.id);
  }

  async function selectProject(id: string) {
    setSelectedId(id);
    setView("studio");
    setDetail(await api.project(id));
    setLogs(await api.logs(id));
  }

  async function runJob(action: () => Promise<JobRow>, nextMessage: string) {
    try {
      const next = await action();
      setJob(next);
      setMessage(nextMessage);
      push("info", nextMessage);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      push("error", msg);
      setMessage(msg);
    }
  }

  async function saveSettings(values: Record<string, string | undefined>) {
    await api.saveSettings(values);
    setMessage(c.settingsSaved);
    push("success", c.settingsSaved);
    await refresh();
  }

  async function selectTemplate(templateId: string) {
    if (!detail) return;
    await api.patchProject(detail.id, { templateId });
    setMessage(c.templateSaved);
    push("success", c.templateSaved);
    await refresh(detail.id);
  }

  function openTools(tab: TabId) {
    setActiveTab(tab);
    setView("tools");
  }

  async function generateVideoPlan(options: {
    prompt: string;
    source: string;
    ratio: Ratio;
    language: Language;
    limit: number;
    mode: string;
    style: string;
  }) {
    try {
      let project = detail;
      if (!project) {
        project = await api.createProject(lang === "zh" ? "今日 AI 产品信号" : "Today AI Product Signals", options.ratio);
        setSelectedId(project.id);
      } else if (project.ratio !== options.ratio) {
        project = await api.patchProject(project.id, { ratio: options.ratio });
      }
      setDetail(project);
      push("info", lang === "zh" ? "正在采集内容…" : "Fetching content…");
      await api.fetchSource(project.id, options.source, {
        manualText: options.prompt,
        limit: options.limit,
        mode: options.mode,
        style: options.style
      });
      setMessage(c.sourceSaved);
      const next = await api.generateScript(project.id, options.language);
      setJob(next);
      setMessage(c.scriptStarted);
      push("info", c.scriptStarted);
      setSelectedId(project.id);
      setView("studio");
      setDetail(await api.project(project.id));
      setLogs(await api.logs(project.id));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      push("error", msg);
      setMessage(msg);
    }
  }

  const currentRatio = (detail?.ratio ?? "9:16") as Ratio;
  const script = detail?.script;
  const cues = useMemo(() => {
    const row = detail?.subtitles?.find((item) => item.format === "srt");
    return row?.cues_json ? (JSON.parse(row.cues_json) as SubtitleCue[]) : [];
  }, [detail?.subtitles]);

  const outputPath = detail?.status === "exported" ? detail?.finalVideoPath : undefined;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">TF</div>
          <div>
            <div className="brand">TrendForge</div>
            <div className="muted">{c.brandSub}</div>
          </div>
        </div>
        <button className="primary-button" onClick={createProject}>
          <Rocket size={17} />
          {c.newProject}
        </button>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => setView(item.id)}>
                <Icon size={17} />
                {label(item, lang)}
              </button>
            );
          })}
        </nav>
        <div className="project-list">
          <div className="panel-label">{c.recentProjects}</div>
          {projects.map((project) => (
            <button key={project.id} className={`project-chip ${project.id === selectedId ? "selected" : ""}`} onClick={() => selectProject(project.id)}>
              <span>{project.title}</span>
              <small>{project.ratio} / {projectStatusLabel(project.status, lang)}</small>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="sidebar-empty">
              <Film size={20} />
              <p>{lang === "zh" ? "点击「新建视频项目」开始" : "Click New Project to start"}</p>
            </div>
          )}
        </div>
      </aside>

      <main className="workspace">
        <header className={`topbar ${view === "studio" ? "home-topbar" : ""}`}>
          <div>
            <p className="eyebrow">{view === "studio" ? c.studioEyebrow : label(navItems.find((item) => item.id === view)!, lang)}</p>
            <h1>{view === "studio" ? detail?.title ?? c.commandDeck : viewTitle(view, lang)}</h1>
          </div>
          <div className="top-actions">
            <label className="language-switch">
              <Languages size={15} />
              <select value={lang} onChange={(event) => setLang(event.target.value as UiLang)}>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <button className="ghost-button" onClick={() => refresh()}>
              <RefreshCw size={16} />
              {c.refresh}
            </button>
            <div className="status-pill">{message}</div>
          </div>
        </header>

        <section className="dashboard-strip" aria-label={c.systemOverview}>
          {Object.values(status).map((item) => (
            <div key={item.id} className={`system-cell ${item.status}`}>
              <span>{serviceLabel(item.label, lang)}</span>
              <strong>{compactStatus(item.message, lang)}</strong>
            </div>
          ))}
        </section>

        {view === "studio" && (
          <HomeStudio
            lang={lang}
            detail={detail}
            sources={sources}
            status={status}
            job={job}
            onGenerate={generateVideoPlan}
            onOpenTools={openTools}
            onOpenSettings={() => setView("settings")}
            onRender={(settings) => detail && runJob(() => api.render(detail.id, settings), c.renderStarted)}
            onPreview={() => detail && window.open(api.previewUrl(detail.id), "_blank")}
          />
        )}

        {view === "tools" && (
          <section className="studio">
            {/* Step breadcrumb */}
            <div className="step-bar">
              {tabs.map((tab, i) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDone = tabIsDone(tab.id, detail, job);
                return (
                  <button
                    key={tab.id}
                    className={`step-dot ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                    title={label(tab, lang)}
                  >
                    {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                    <span>{label(tab, lang)}</span>
                    {i < tabs.length - 1 && <span className="step-arrow">›</span>}
                  </button>
                );
              })}
            </div>
            <div className="studio-body">
              {activeTab === "content" && <ContentPanel lang={lang} detail={detail} sources={sources} onFetch={async (source, options) => {
                if (!detail) { push("error", lang === "zh" ? "请先新建项目" : "Create a project first"); return; }
                try {
                  await api.fetchSource(detail.id, source, options);
                  setDetail(await api.project(detail.id));
                  setMessage(c.sourceSaved);
                  push("success", c.sourceSaved);
                } catch (error) {
                  push("error", error instanceof Error ? error.message : String(error));
                }
              }} />}
              {activeTab === "script" && <ScriptPanel lang={lang} script={script} onGenerate={() => detail ? runJob(() => api.generateScript(detail.id, lang as Language), c.scriptStarted) : push("error", lang === "zh" ? "请先新建项目" : "Create a project first")} onRegenerate={async (sceneId) => {
                if (!detail) return;
                try {
                  await api.regenerateScene(detail.id, sceneId);
                  setDetail(await api.project(detail.id));
                  push("success", lang === "zh" ? "场景已重新生成" : "Scene regenerated");
                } catch (error) { push("error", error instanceof Error ? error.message : String(error)); }
              }} onSave={async (next) => {
                if (!detail) return;
                try {
                  await api.saveScript(detail.id, next);
                  setDetail(await api.project(detail.id));
                  setMessage(c.scriptSaved);
                  push("success", c.scriptSaved);
                } catch (error) { push("error", error instanceof Error ? error.message : String(error)); }
              }} />}
              {activeTab === "subtitles" && <SubtitlePanel lang={lang} cues={cues} onGenerate={async () => {
                if (!detail) { push("error", lang === "zh" ? "请先生成脚本" : "Generate a script first"); return; }
                try {
                  await api.generateSubtitles(detail.id);
                  setDetail(await api.project(detail.id));
                  setMessage(c.subtitlesGenerated);
                  push("success", c.subtitlesGenerated);
                } catch (error) { push("error", error instanceof Error ? error.message : String(error)); }
              }} onSave={async (next) => {
                if (!detail) return;
                try {
                  await api.saveSubtitles(detail.id, next);
                  setDetail(await api.project(detail.id));
                  setMessage(c.subtitlesSaved);
                  push("success", c.subtitlesSaved);
                } catch (error) { push("error", error instanceof Error ? error.message : String(error)); }
              }} />}
              {activeTab === "voice" && <VoicePanel lang={lang} detail={detail} onGenerate={(options) => detail ? runJob(() => api.generateTts(detail.id, options), c.voiceStarted) : push("error", lang === "zh" ? "请先新建项目" : "Create a project first")} />}
              {activeTab === "cover" && <CoverPanel lang={lang} detail={detail} onSaveScript={async (next) => {
                if (!detail) return;
                try {
                  await api.saveScript(detail.id, next);
                  setDetail(await api.project(detail.id));
                  push("success", lang === "zh" ? "标题已保存" : "Title saved");
                } catch (error) { push("error", error instanceof Error ? error.message : String(error)); }
              }} onGenerate={async () => {
                if (!detail) return;
                try {
                  await api.generateCover(detail.id);
                  setDetail(await api.project(detail.id));
                  setMessage(c.coverGenerated);
                  push("success", c.coverGenerated);
                } catch (error) { push("error", error instanceof Error ? error.message : String(error)); }
              }} />}
              {activeTab === "template" && <TemplatePanel lang={lang} detail={detail} onSelect={selectTemplate} />}
              {activeTab === "export" && (
                <ExportPanel
                  lang={lang}
                  ratio={currentRatio}
                  job={job}
                  outputPath={outputPath}
                  onRender={(settings) => detail ? runJob(() => api.render(detail.id, settings), c.renderStarted) : push("error", lang === "zh" ? "请先新建项目" : "Create a project first")}
                  onOpenFolder={async (p) => { try { await api.openFolder(p); } catch { /* ignore */ } }}
                />
              )}
              {activeTab === "logs" && <LogPanel lang={lang} logs={logs} />}
            </div>
          </section>
        )}

        {view === "history" && <HistoryPage lang={lang} projects={projects} selectedId={selectedId} onSelect={selectProject} />}
        {view === "templates" && <TemplateLibraryPage lang={lang} detail={detail} onSelect={selectTemplate} />}
        {view === "settings" && <SettingsPage lang={lang} settings={settings} onSave={saveSettings} />}
        {view === "guide" && <GuidePage lang={lang} onStart={() => { setView("studio"); createProject(); }} onOpenTools={openTools} />}
      </main>

      {/* Right-side Inspector — always visible */}
      <Inspector lang={lang} detail={detail} script={script} job={job} logs={logs} />

      {/* Bottom log footer */}
      <footer className="bottom-log">
        <Activity size={16} />
        <span>{logs[0]?.message ?? c.bottomLog}</span>
      </footer>

      {/* Toast stack */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" && <CheckCircle2 size={15} />}
            {t.type === "error" && <AlertCircle size={15} />}
            {t.type === "info" && <Activity size={15} />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── tabIsDone: light check whether a pipeline step has data ─────
function tabIsDone(tab: TabId, detail?: ProjectDetail, job?: JobRow): boolean {
  if (!detail) return false;
  if (tab === "content") return (detail.trendItems?.length ?? 0) > 0;
  if (tab === "script") return Boolean(detail.script);
  if (tab === "voice") return (detail.assets?.some((a) => a.type === "audio")) ?? false;
  if (tab === "subtitles") return (detail.subtitles?.length ?? 0) > 0;
  if (tab === "cover") return Boolean(detail.coverPath);
  if (tab === "export") return detail.status === "exported" && Boolean(detail.finalVideoPath);
  return false;
}

// ─── Guide Page ───────────────────────────────────────────────────
function GuidePage(props: { lang: UiLang; onStart: () => void; onOpenTools: (tab: TabId) => void }) {
  const zh = props.lang === "zh";
  const steps = [
    { icon: <Rocket size={22} />, title: zh ? "① 新建项目" : "① New Project", desc: zh ? "点击左侧「新建视频项目」或在首页直接生成视频方案，系统会自动建立本地项目文件夹。" : "Click New Project in the sidebar or generate a plan from the Home page. A local project folder is created automatically." },
    { icon: <Database size={22} />, title: zh ? "② 采集内容" : "② Fetch Content", desc: zh ? "选择数据源（Hacker News、Product Hunt、RSS 或手动粘贴），点击「抓取并保存」把热点条目拉到项目里。没有 API Key 时，系统会用本地 mock 数据走通流程。" : "Choose a source (Hacker News, Product Hunt, RSS, or manual). Click Fetch. Missing API keys fall back to local mock data." },
    { icon: <Wand2 size={22} />, title: zh ? "③ 生成脚本" : "③ Generate Script", desc: zh ? "进入「脚本」标签，点击「生成脚本」。DeepSeek 会把热点条目变成可编辑的多场景脚本。没有 Key 时使用本地 mock 脚本生成器。" : "Open the Script tab and click Generate Script. DeepSeek turns trend items into editable scenes. Falls back to local mock." },
    { icon: <Captions size={22} />, title: zh ? "④ 生成字幕" : "④ Generate Subtitles", desc: zh ? "进入「字幕」标签，点击「生成字幕」。系统根据脚本文案创建时间轴，支持逐条编辑。" : "Open Subtitles and click Generate. The timeline is created from script text and can be edited cue by cue." },
    { icon: <AudioLines size={22} />, title: zh ? "⑤ 配音（可选）" : "⑤ Voice (optional)", desc: zh ? "配置豆包后可以生成真实语音；跳过这一步也能导出图文字幕视频。" : "Doubao can create real voice audio. Skipping this step still exports the poster video with subtitles." },
    { icon: <Image size={22} />, title: zh ? "⑥ 导出封面（可选）" : "⑥ Export Cover (optional)", desc: zh ? "进入「封面」标签，编辑主标题和副标题，点击「导出封面」生成 SVG 封面文件。" : "Open Cover, edit the title and subtitle, then click Export Cover to generate an SVG cover file." },
    { icon: <Download size={22} />, title: zh ? "⑦ 渲染导出" : "⑦ Render & Export", desc: zh ? "进入「导出」标签，选择画幅比例（9:16 / 16:9 / 1:1 / 4:5）、帧率和格式，点击「渲染视频」。FFmpeg 会把视频、配音、字幕合成为本地 MP4 文件，完成后点「打开文件夹」查看输出。" : "Open Export, select ratio (9:16 / 16:9 / 1:1 / 4:5), FPS, and format. Click Render Video. FFmpeg merges video, audio, and subtitles into a local MP4. Click Open Folder to find the output." }
  ];
  return (
    <section className="view-panel guide-view">
      <div className="guide-hero">
        <BookOpen size={36} />
        <h2>{zh ? "快速上手 TrendForge" : "Getting Started with TrendForge"}</h2>
        <p>{zh ? "按以下步骤完成你的第一个 AI 热点视频。DeepSeek 用于真实脚本和画面方案，配音是可选步骤。" : "Follow these steps to create your first AI trend video. DeepSeek powers the script and visual plan. Voice is optional."}</p>
        <button className="primary-button guide-cta" onClick={props.onStart}><Rocket size={16} /> {zh ? "立即新建项目并开始" : "Create Project & Start Now"}</button>
      </div>
      <div className="guide-steps">
        {steps.map((step, i) => (
          <div key={i} className="guide-step">
            <div className="guide-step-icon">{step.icon}</div>
            <div>
              <strong>{step.title}</strong>
              <p>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="guide-config-note">
        <AlertCircle size={16} />
        <div>
          <strong>{zh ? "首次运行配置" : "First-run setup"}</strong>
          <p>{zh ? "运行前需执行：pnpm install → pnpm prisma:generate → pnpm prisma:migrate → pnpm dev。详见 README.md。服务启动后访问 http://127.0.0.1:4788。" : "Before running: pnpm install → pnpm prisma:generate → pnpm prisma:migrate → pnpm dev. See README.md. Then open http://127.0.0.1:4788."}</p>
        </div>
      </div>
    </section>
  );
}

function HomeStudio(props: {
  lang: UiLang;
  detail?: ProjectDetail;
  sources: SourceInfo[];
  status: SystemStatusMap;
  job?: JobRow;
  onGenerate: (options: { prompt: string; source: string; ratio: Ratio; language: Language; limit: number; mode: string; style: string }) => Promise<void>;
  onOpenTools: (tab: TabId) => void;
  onOpenSettings: () => void;
  onRender: (settings: { ratio: Ratio; fps: 24 | 30 | 60; format: "mp4" | "webm"; burnSubtitles: boolean }) => void | Promise<void>;
  onPreview: () => void;
}) {
  const zh = props.lang === "zh";
  const [prompt, setPrompt] = useState("整理今天 Product Hunt 上最值得看的 5 个 AI 产品，做成 60 秒的竖版视频，科技风格");
  const [source, setSource] = useState("product-hunt");
  const [ratio, setRatio] = useState<Ratio>("9:16");
  const [duration, setDuration] = useState("60 秒左右");
  const [style, setStyle] = useState("科技 / 未来感");
  const [isGenerating, setIsGenerating] = useState(false);
  const exportStatus = props.status.ffmpegExport;
  const isRenderingReady = exportStatus?.status === "ready";
  const script = props.detail?.script;
  const trendCount = props.detail?.trendItems?.length ?? 0;
  const plans = buildPlanCards(props.detail, props.lang);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      await props.onGenerate({ prompt, source, ratio, language: props.lang as Language, limit: 5, mode: "topstories", style });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="home-studio">
      <div className="hero-copy">
        <h1>{zh ? "用 AI，把热点变成视频" : "Turn Trends into Video with AI"}</h1>
        <p>{zh ? "输入主题或选择数据源，AI 将为你生成多个视频方案。" : "Enter a topic or choose a source. AI generates multiple video plans."}</p>
      </div>

      <section className="generator-panel">
        <div className="step-title">
          <span>1</span>
          <strong>{zh ? "告诉 AI 你想做什么视频" : "Tell AI what to make"}</strong>
        </div>
        <textarea className="prompt-box" value={prompt} maxLength={500} onChange={(event) => setPrompt(event.target.value)} />
        <div className="prompt-count">{prompt.length}/500</div>

        <div className="field-group">
          <span>{zh ? "数据源" : "Source"}</span>
          <div className="source-pills">
            {props.sources.map((item) => (
              <button key={item.id} className={source === item.id ? "selected" : ""} onClick={() => setSource(item.id)}>
                {sourceIcon(item.id)}
                {sourceLabel(item.id, props.lang)}
              </button>
            ))}
          </div>
        </div>

        <div className="quick-controls">
          <label>{zh ? "视频类型" : "Type"}<select><option>{zh ? "热点榜单" : "Trend list"}</option><option>{zh ? "单条解读" : "Single story"}</option></select></label>
          <label>{zh ? "语言" : "Language"}<select value={props.lang} disabled><option value="zh">中文（双语字幕）</option><option value="en">English</option></select></label>
          <label>{zh ? "比例" : "Ratio"}<select value={ratio} onChange={(event) => setRatio(event.target.value as Ratio)}><option value="9:16">9:16 竖屏</option><option value="16:9">16:9 横屏</option><option value="1:1">1:1 方形</option><option value="4:5">4:5 社媒</option></select></label>
          <label>{zh ? "时长" : "Duration"}<select value={duration} onChange={(event) => setDuration(event.target.value)}><option>60 秒左右</option><option>45 秒左右</option><option>90 秒左右</option></select></label>
          <label>{zh ? "风格" : "Style"}<select value={style} onChange={(event) => setStyle(event.target.value)}><option>科技 / 未来感</option><option>极简榜单风</option><option>产品解说风</option></select></label>
        </div>

        <div className="generator-action">
          <button className={`generate-button ${isGenerating ? "loading" : ""}`} disabled={isGenerating} onClick={handleGenerate}>
            {isGenerating ? <span className="spinner" /> : <Sparkles size={18} />}
            {isGenerating ? (zh ? "生成中…" : "Generating…") : (zh ? "生成视频方案" : "Generate plans")}
          </button>
          <span>{props.job && props.job.status === "running" ? `${jobTypeLabel(props.job.type, props.lang)} ${props.job.progress}%` : zh ? "预计 2-3 分钟完成" : "Usually done in 2-3 minutes"}</span>
        </div>
      </section>

      <section className="plans-section">
        <div className="section-line">
          <div className="step-title">
            <span>2</span>
            <strong>{zh ? "选择你喜欢的方案" : "Choose a plan"}</strong>
          </div>
          <button className="text-button" onClick={() => props.onOpenTools("script")}><RefreshCw size={15} /> {zh ? "重新生成方案" : "Regenerate"}</button>
        </div>
        <p className="section-hint">
          {script ? (zh ? `已生成 ${plans.length} 个视频方案，采集 ${trendCount} 条热点。` : `${plans.length} plans generated from ${trendCount} items.`) : (zh ? "生成后可预览、编辑并导出。" : "Generated plans can be previewed, edited, and exported.")}
        </p>
        <div className="plan-grid">
          {plans.map((plan, index) => (
            <article className="plan-card" key={plan.id}>
              <div className={`plan-badge badge-${index}`}>{zh ? `方案 ${String.fromCharCode(65 + index)}` : `Plan ${String.fromCharCode(65 + index)}`}</div>
              <div className="plan-cover">
                <div className="cover-grid" />
                <div className="cover-title">
                  <strong>{plan.title}</strong>
                  <span>{plan.subtitle}</span>
                </div>
                <button className="play-button" title={zh ? "预览视频模板" : "Preview video template"} onClick={props.onPreview}><Play size={22} fill="currentColor" /></button>
                <small>{plan.time}</small>
              </div>
              <div className="plan-tags">
                {plan.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="plan-meta">
                <span>{plan.duration}</span>
                <span>{plan.created}</span>
                <button aria-label={zh ? "更多操作" : "More actions"}><MoreVertical size={18} /></button>
              </div>
              <div className="plan-actions">
                <button onClick={props.onPreview} title={zh ? "在新标签页预览 HTML 动态模板" : "Preview HTML template in new tab"}>
                  <Play size={15} /> {zh ? "预览" : "Preview"}
                </button>
                <button onClick={() => props.onOpenTools("script")}><PencilLine size={15} /> {zh ? "编辑" : "Edit"}</button>
                <button className="export-action" onClick={() => props.onOpenTools("export")}>
                  <Download size={15} /> {zh ? "导出" : "Export"}
                </button>
              </div>
            </article>
          ))}
        </div>
        {plans.length === 0 && !script && (
          <div className="empty-plan-hint">
            <Sparkles size={28} />
            <strong>{zh ? "还没有视频方案" : "No plans yet"}</strong>
            <p>{zh ? "在上方填写主题并点击「生成视频方案」，AI 会自动采集热点并生成脚本。" : "Fill in your topic above and click Generate plans. AI will fetch trends and generate a script automatically."}</p>
          </div>
        )}
      </section>

      <div className="feature-strip">
        <div><Wand2 size={18} /><strong>{zh ? "一键 AI 生成" : "AI generation"}</strong><span>{zh ? "脚本、字幕、图文画面；配音可选" : "Script, subtitles, visual posters; optional voice"}</span></div>
        <div><Layers size={18} /><strong>{zh ? "多方案备选" : "Multiple plans"}</strong><span>{zh ? "提供不同风格供你选择" : "Choose from distinct styles"}</span></div>
        <div><Monitor size={18} /><strong>{zh ? "可视化编辑" : "Visual editing"}</strong><span>{zh ? "进入工具箱继续精修" : "Polish in the toolbox"}</span></div>
        <div><Download size={18} /><strong>{zh ? "多格式导出" : "Multi-format export"}</strong><span>{zh ? "适配抖音、小红书、YouTube" : "Ready for social formats"}</span></div>
        <div><ShieldCheck size={18} /><strong>{zh ? "本地优先" : "Local-first"}</strong><span>{zh ? "项目文件保存在本地" : "Project files stay local"}</span></div>
      </div>
    </section>
  );
}

function HistoryPage(props: { lang: UiLang; projects: ProjectDetail[]; selectedId?: string; onSelect: (id: string) => Promise<void> }) {
  const zh = props.lang === "zh";
  return (
    <section className="view-panel history-view">
      <div className="section-line">
        <div className="section-title"><History size={18} /> {zh ? "历史项目" : "Project history"}</div>
      </div>
      {props.projects.length === 0 && (
        <div className="empty-inline">
          <History size={32} />
          <strong>{zh ? "暂无历史项目" : "No projects yet"}</strong>
          <p>{zh ? "新建一个项目开始制作。" : "Create a project to get started."}</p>
        </div>
      )}
      <div className="history-grid">
        {props.projects.map((project) => (
          <button key={project.id} className={project.id === props.selectedId ? "history-card selected" : "history-card"} onClick={() => props.onSelect(project.id)}>
            <span>{project.ratio}</span>
            <strong>{project.title}</strong>
            <small>{projectStatusLabel(project.status, props.lang)} · {new Date(project.updatedAt).toLocaleString()}</small>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </section>
  );
}

function buildPlanCards(detail: ProjectDetail | undefined, lang: UiLang) {
  const zh = lang === "zh";
  const title = detail?.script?.title ?? (zh ? "今日 AI 产品信号" : "AI Product Signals");
  const subtitle = detail?.script?.subtitle ?? (zh ? "Top 5 值得关注的产品" : "Top 5 products to watch");
  const date = new Date(detail?.updatedAt ?? Date.now()).toLocaleString();
  if (!detail?.script) return [];
  return [
    { id: "a", title, subtitle, duration: "58 秒", time: "9:16", created: date, tags: zh ? ["科技快讯风", "节奏紧凑", "双语字幕"] : ["Tech brief", "Fast pace", "Bilingual"] },
    { id: "b", title: zh ? "今天值得关注的 5 个 AI 产品" : "5 AI Products Worth Watching", subtitle: zh ? "Product Hunt 精选" : "Product Hunt picks", duration: "64 秒", time: "9:16", created: date, tags: zh ? ["产品解说", "双语字幕", "沉浸叙述"] : ["Product brief", "Bilingual", "Narrative"] },
    { id: "c", title: zh ? "AI 产品 今日盘点" : "AI Product Daily", subtitle: "Top 5", duration: "45 秒", time: "9:16", created: date, tags: zh ? ["极简榜单风", "快节奏", "中文配音"] : ["List style", "Quick cut", "Voiceover"] }
  ];
}

function sourceIcon(id: string) {
  if (id === "manual") return <PencilLine size={15} />;
  if (id === "rss") return <Activity size={15} />;
  if (id === "product-hunt") return <PackageOpen size={15} />;
  return <Database size={15} />;
}

function ContentPanel(props: { lang: UiLang; detail?: ProjectDetail; sources: SourceInfo[]; onFetch: (source: string, options: Record<string, unknown>) => Promise<void> }) {
  const [source, setSource] = useState("manual");
  const [manualText, setManualText] = useState("把最近 AI 工具热点整理成 60 秒短视频，重点讲清楚产品是什么、解决什么问题、为什么值得关注。");
  const [rssUrls, setRssUrls] = useState("");
  const [limit, setLimit] = useState(8);
  const [mode, setMode] = useState("topstories");
  const [loading, setLoading] = useState(false);
  const zh = props.lang === "zh";

  async function handleFetch() {
    setLoading(true);
    try {
      await props.onFetch(source, { manualText, rssUrls: rssUrls.split(/\r?\n/).filter(Boolean), limit, mode });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="split-grid">
      <div className="work-panel">
        <div className="panel-toolbar">
          <div className="section-title"><Database size={18} /> {zh ? "内容采集" : "Content Capture"}</div>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            {props.sources.map((item) => <option key={item.id} value={item.id}>{sourceLabel(item.id, props.lang)}</option>)}
          </select>
        </div>
        <div className="form-grid compact">
          <label>{zh ? "数量" : "Limit"}<select value={limit} onChange={(event) => setLimit(Number(event.target.value))}><option value={5}>5</option><option value={8}>8</option><option value={12}>12</option><option value={20}>20</option></select></label>
          <label>{zh ? "模式" : "Mode"}<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="topstories">HN Top</option><option value="beststories">HN Best</option><option value="newstories">HN New</option><option value="hot">Reddit Hot</option><option value="top">Reddit Top</option></select></label>
        </div>
        <div className="source-grid">
          {props.sources.map((item) => (
            <button key={item.id} className={source === item.id ? "source selected" : "source"} onClick={() => setSource(item.id)}>
              <strong>{sourceLabel(item.id, props.lang)}</strong>
              <span>{item.enabled ? (zh ? "可用" : "Ready") : (zh ? "可配置" : "Configurable")}</span>
            </button>
          ))}
        </div>
        <label className="field-label">{zh ? "手动内容" : "Manual text"}</label>
        <textarea value={manualText} onChange={(event) => setManualText(event.target.value)} />
        <label className="field-label">RSS</label>
        <textarea className="small-textarea" value={rssUrls} onChange={(event) => setRssUrls(event.target.value)} placeholder={zh ? "每行一个 RSS 地址" : "One RSS URL per line"} />
        <button className="primary-button" disabled={loading} onClick={handleFetch}>
          {loading ? <span className="spinner" /> : <Sparkles size={16} />}
          {loading ? (zh ? "采集中…" : "Fetching…") : (zh ? "抓取并保存" : "Fetch and Save")}
        </button>
      </div>
      <div className="work-panel">
        <div className="section-title"><Film size={18} /> {zh ? "已选条目" : "Selected Items"}</div>
        <div className="item-list">
          {(props.detail?.trendItems ?? []).map((item) => (
            <div key={item.id} className="trend-row">
              <strong>{item.rank || 1}. {item.title}</strong>
              <p>{item.summary ?? item.content}</p>
              <span>{sourceLabel(item.source, props.lang)} / {zh ? "热度" : "score"} {item.score ?? 0}</span>
            </div>
          ))}
          {(props.detail?.trendItems ?? []).length === 0 && (
            <div className="empty-inline">
              <Film size={24} />
              <strong>{zh ? "等待内容采集" : "Waiting for content"}</strong>
              <p>{zh ? "选择数据源后点击「抓取并保存」，条目会显示在这里进入脚本生成。" : "Select a source and click Fetch. Items appear here and feed the script generator."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScriptPanel(props: { lang: UiLang; script?: VideoScript; onGenerate: () => void | Promise<void>; onRegenerate: (sceneId: string) => Promise<void>; onSave: (script: VideoScript) => Promise<void> }) {
  const [draft, setDraft] = useState<VideoScript | undefined>(props.script);
  useEffect(() => setDraft(props.script), [props.script]);
  const zh = props.lang === "zh";
  if (!draft) {
    return <EmptyState icon={<Wand2 />} title={zh ? "生成可编辑脚本" : "Generate editable script"} action={zh ? "生成脚本" : "Generate Script"} onAction={props.onGenerate}>{zh ? "先在「内容」标签采集热点，再点「生成脚本」。DeepSeek 会把条目变成含封面、开场、热点解读、分析和收尾的完整脚本。" : "First fetch content, then click Generate Script. DeepSeek turns items into a full script with cover, intro, items, analysis, and outro scenes."}</EmptyState>;
  }
  return (
    <div className="work-panel">
      <div className="panel-toolbar">
        <div className="section-title"><Wand2 size={18} /> {zh ? "脚本编辑器" : "Script Editor"}</div>
        <button className="ghost-button" onClick={() => props.onSave(draft)}><Save size={16} /> {zh ? "保存脚本" : "Save"}</button>
      </div>
      <div className="form-grid compact">
        <label>{zh ? "标题" : "Title"}<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>{zh ? "副标题" : "Subtitle"}<input value={draft.subtitle ?? ""} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label>
      </div>
      <div className="scene-list">
        {draft.scenes.map((scene, index) => (
          <div className="scene-editor" key={scene.id}>
            <div className="scene-head">
              <span>{zh ? "场景" : "Scene"} {index + 1} / {sceneTypeLabel(scene.type, props.lang)}</span>
              <button className="mini-button" onClick={() => props.onRegenerate(scene.id)}>{zh ? "重生成" : "Regenerate"}</button>
            </div>
            <input value={scene.title} onChange={(event) => setDraft({ ...draft, scenes: draft.scenes.map((item) => item.id === scene.id ? { ...item, title: event.target.value } : item) })} />
            <textarea value={scene.screenText} onChange={(event) => setDraft({ ...draft, scenes: draft.scenes.map((item) => item.id === scene.id ? { ...item, screenText: event.target.value } : item) })} />
            <textarea value={scene.voiceText} onChange={(event) => setDraft({ ...draft, scenes: draft.scenes.map((item) => item.id === scene.id ? { ...item, voiceText: event.target.value } : item) })} />
          </div>
        ))}
      </div>
    </div>
  );
}

function VoicePanel(props: { lang: UiLang; detail?: ProjectDetail; onGenerate: (options: Record<string, unknown>) => void | Promise<void> }) {
  const zh = props.lang === "zh";
  const audio = props.detail?.assets?.filter((asset) => asset.type === "audio").at(-1);
  const [format, setFormat] = useState("wav");
  const [voice, setVoice] = useState("default");
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  return (
    <div className="split-grid">
      <div className="work-panel">
        <div className="section-title"><AudioLines size={18} /> {zh ? "配音控制台（可选）" : "Voice Console (optional)"}</div>
        {!props.detail?.script && (
          <div className="inline-warn"><AlertCircle size={15} /> {zh ? "请先生成脚本，再生成配音。" : "Generate a script first, then generate voice."}</div>
        )}
        <div className="form-grid">
          <label>{zh ? "服务" : "Provider"}<select><option>{zh ? "豆包 TTS（配置后可用）" : "Doubao TTS (when configured)"}</option></select></label>
          <label>{zh ? "音色" : "Voice"}<input value={voice} onChange={(event) => setVoice(event.target.value)} /></label>
          <label>{zh ? "语速" : "Speed"}<input type="number" min="0.5" max="2" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label>
          <label>{zh ? "音量" : "Volume"}<input type="number" min="0" max="2" step="0.1" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
          <label>{zh ? "格式" : "Format"}<select value={format} onChange={(event) => setFormat(event.target.value)}><option value="wav">WAV</option><option value="mp3">MP3</option></select></label>
        </div>
        <button className="primary-button" disabled={!props.detail?.script} onClick={() => props.onGenerate({ format, voice, speed, volume })}><Play size={16} /> {zh ? "生成可选配音" : "Generate Optional Voice"}</button>
      </div>
      <div className="work-panel">
        <div className="section-title"><Clapperboard size={18} /> {zh ? "音频资产" : "Audio Asset"}</div>
        {audio ? (
          <div className="output-file-block">
            <p className="mono-path">{audio.path}</p>
            <span className="output-ok"><CheckCircle2 size={14} /> {zh ? "配音已生成" : "Voice ready"}</span>
          </div>
        ) : (
          <p className="muted">{zh ? "配音可以跳过；导出会使用图文和字幕。" : "Voice can be skipped. Export uses visuals and subtitles."}</p>
        )}
      </div>
    </div>
  );
}

function SubtitlePanel(props: { lang: UiLang; cues: SubtitleCue[]; onGenerate: () => Promise<void>; onSave: (cues: SubtitleCue[]) => Promise<void> }) {
  const [draft, setDraft] = useState<SubtitleCue[]>(props.cues);
  useEffect(() => setDraft(props.cues), [props.cues]);
  const zh = props.lang === "zh";
  function addCue() {
    const last = draft.at(-1);
    const start = last?.end ?? 0;
    setDraft([...draft, { id: `cue_${Date.now()}`, start, end: start + 3, text: zh ? "新字幕" : "New subtitle" }]);
  }
  return (
    <div className="work-panel">
      <div className="panel-toolbar">
        <div className="section-title"><Captions size={18} /> {zh ? "字幕时间线" : "Subtitle Timeline"}</div>
        <div className="toolbar-actions">
          <button className="ghost-button" onClick={addCue}><Plus size={16} /> {zh ? "新增" : "Add"}</button>
          <button className="ghost-button" onClick={props.onGenerate}>{zh ? "生成字幕" : "Generate"}</button>
          <button className="ghost-button" onClick={() => props.onSave(draft)}><Save size={16} /> {zh ? "保存" : "Save"}</button>
        </div>
      </div>
      <div className="subtitle-table">
        {draft.map((cue) => (
          <div key={cue.id} className="subtitle-row">
            <input value={cue.start} type="number" step="0.1" onChange={(event) => setDraft(draft.map((item) => item.id === cue.id ? { ...item, start: Number(event.target.value) } : item))} />
            <input value={cue.end} type="number" step="0.1" onChange={(event) => setDraft(draft.map((item) => item.id === cue.id ? { ...item, end: Number(event.target.value) } : item))} />
            <textarea value={cue.text} onChange={(event) => setDraft(draft.map((item) => item.id === cue.id ? { ...item, text: event.target.value } : item))} />
          </div>
        ))}
        {draft.length === 0 && <div className="empty-inline"><Captions size={24} /><strong>{zh ? "等待字幕生成" : "Waiting for subtitles"}</strong><p>{zh ? "先生成脚本，再点「生成字幕」创建时间轴；配音可以在字幕之后生成。" : "Generate a script, then click Generate to create the timeline. Voice can be generated after subtitles."}</p></div>}
      </div>
    </div>
  );
}

function CoverPanel(props: { lang: UiLang; detail?: ProjectDetail; onSaveScript: (script: VideoScript) => Promise<void>; onGenerate: () => Promise<void> }) {
  const zh = props.lang === "zh";
  const [title, setTitle] = useState(props.detail?.script?.title ?? props.detail?.title ?? "TrendForge");
  const [subtitle, setSubtitle] = useState(props.detail?.script?.subtitle ?? "Neo Signal");
  useEffect(() => {
    setTitle(props.detail?.script?.title ?? props.detail?.title ?? "TrendForge");
    setSubtitle(props.detail?.script?.subtitle ?? "Neo Signal");
  }, [props.detail?.id, props.detail?.script?.title, props.detail?.script?.subtitle]);
  async function saveTitle() {
    if (!props.detail?.script) return;
    await props.onSaveScript({ ...props.detail.script, title, subtitle });
  }
  return (
    <div className="split-grid">
      <div className="work-panel">
        <div className="section-title"><Image size={18} /> {zh ? "封面编辑器" : "Cover Editor"}</div>
        <div className="form-grid compact">
          <label>{zh ? "主标题" : "Title"}<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>{zh ? "副标题" : "Subtitle"}<input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} /></label>
        </div>
        <div className="cover-preview">
          <span>{zh ? "趋势封面 / Neo Signal" : "Cover / Neo Signal"}</span>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="toolbar-actions">
          <button className="ghost-button" onClick={saveTitle}><Save size={16} /> {zh ? "保存标题" : "Save title"}</button>
          <button className="primary-button" onClick={props.onGenerate}>{zh ? "导出封面" : "Export cover"}</button>
        </div>
      </div>
      <div className="work-panel">
        <div className="section-title">{zh ? "封面文件" : "Cover file"}</div>
        {props.detail?.coverPath ? (
          <div className="output-file-block">
            <p className="mono-path">{props.detail.coverPath}</p>
            <span className="output-ok"><CheckCircle2 size={14} /> {zh ? "封面已生成" : "Cover ready"}</span>
          </div>
        ) : (
          <p className="muted">{zh ? "等待生成封面" : "Waiting for cover"}</p>
        )}
      </div>
    </div>
  );
}

function TemplatePanel(props: { lang: UiLang; detail?: ProjectDetail; onSelect: (templateId: string) => Promise<void> }) {
  return <TemplateChooser lang={props.lang} activeId={props.detail?.templateId ?? "neo-signal"} onSelect={props.onSelect} compact />;
}

function ExportPanel(props: {
  lang: UiLang;
  ratio: Ratio;
  job?: JobRow;
  outputPath?: string;
  onRender: (settings: { ratio: Ratio; fps: 24 | 30 | 60; format: "mp4" | "webm"; burnSubtitles: boolean }) => void | Promise<void>;
  onOpenFolder: (path: string) => Promise<void>;
}) {
  const zh = props.lang === "zh";
  const [ratio, setRatio] = useState<Ratio>(props.ratio);
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const isRunning = props.job?.status === "running" || props.job?.status === "pending";
  const durationLabel = formatJobDuration(props.job, props.lang);

  return (
    <div className="work-panel">
      <div className="section-title"><Film size={18} /> {zh ? "导出控制台" : "Export Console"}</div>

      {/* Output file display */}
      {props.outputPath ? (
        <div className="output-file-card">
          <div className="output-file-info">
            <CheckCircle2 size={18} className="output-icon-ok" />
            <div>
              <strong>{zh ? "输出文件" : "Output File"}</strong>
              <p className="mono-path">{props.outputPath}</p>
              {durationLabel && <span className="render-time-label">{durationLabel}</span>}
            </div>
          </div>
          <button className="ghost-button" onClick={() => props.onOpenFolder(props.outputPath!)}>
            <FolderOpen size={15} /> {zh ? "打开文件夹" : "Open Folder"}
          </button>
        </div>
      ) : (
        <div className="output-placeholder">
          <Download size={18} />
          <span>{zh ? "尚未渲染，配置参数后点「渲染视频」" : "Not rendered yet — configure settings and click Render Video"}</span>
        </div>
      )}

      <div className="form-grid">
        <label>{zh ? "画幅比例" : "Ratio"}<select value={ratio} onChange={(event) => setRatio(event.target.value as Ratio)}><option value="9:16">9:16 竖屏 1080×1920</option><option value="16:9">16:9 横屏 1920×1080</option><option value="1:1">1:1 方形 1080×1080</option><option value="4:5">4:5 社媒 1080×1350</option></select></label>
        <label>{zh ? "帧率" : "FPS"}<select value={fps} onChange={(event) => setFps(Number(event.target.value) as 24 | 30 | 60)}><option value={24}>24 fps</option><option value={30}>30 fps（推荐）</option><option value={60}>60 fps</option></select></label>
        <label>{zh ? "格式" : "Format"}<select value={format} onChange={(event) => setFormat(event.target.value as "mp4" | "webm")}><option value="mp4">MP4（H.264）</option><option value="webm">WebM（VP9）</option></select></label>
        <label className="check-field"><input type="checkbox" checked={burnSubtitles} onChange={(event) => setBurnSubtitles(event.target.checked)} /> {zh ? "烧录字幕到视频" : "Burn subtitles into video"}</label>
      </div>

      <button className={`primary-button render-button ${isRunning ? "loading" : ""}`} disabled={isRunning} onClick={() => props.onRender({ ratio, fps, format, burnSubtitles })}>
        {isRunning ? <span className="spinner" /> : <Play size={16} />}
        {isRunning ? (zh ? `渲染中 ${props.job?.progress ?? 0}%…` : `Rendering ${props.job?.progress ?? 0}%…`) : (zh ? "渲染视频" : "Render Video")}
      </button>

      {isRunning && props.job && (
        <div className="render-progress-bar">
          <div className="progress"><span style={{ width: `${props.job.progress}%` }} /></div>
          <p className="muted">{jobStepLabel(props.job.step ?? props.job.status, props.lang)}</p>
          {durationLabel && <p className="muted">{durationLabel}</p>}
        </div>
      )}
    </div>
  );
}

function TemplateLibraryPage(props: { lang: UiLang; detail?: ProjectDetail; onSelect: (templateId: string) => Promise<void> }) {
  return (
    <section className="view-panel">
      <TemplateChooser lang={props.lang} activeId={props.detail?.templateId ?? "neo-signal"} onSelect={props.onSelect} />
    </section>
  );
}

function TemplateChooser(props: { lang: UiLang; activeId: string; onSelect: (templateId: string) => Promise<void>; compact?: boolean }) {
  const zh = props.lang === "zh";
  const templates = [
    { id: "neo-signal", title: zh ? "Neo Signal / 科技信号" : "Neo Signal", desc: zh ? "深色视频工作台风格，适合 AI 工具榜单和热点解读。" : "Dark workstation style for AI tools and trend analysis.", ready: true },
    { id: "clean-product", title: zh ? "Clean Product / 产品简报" : "Clean Product", desc: zh ? "明快产品说明风，适合软件发布和功能盘点。" : "Clean product brief style.", ready: true },
    { id: "news-terminal", title: zh ? "News Terminal / 新闻终端" : "News Terminal", desc: zh ? "信息终端风，适合资讯快报和多条热点。" : "Terminal-news style for fast updates.", ready: true }
  ];
  return (
    <div className="work-panel full-panel">
      <div className="section-title"><Layers size={18} /> {zh ? "模板库" : "Template Library"}</div>
      <div className={props.compact ? "template-picker compact-picker" : "template-picker"}>
        {templates.map((template) => (
          <button key={template.id} className={`template-card ${props.activeId === template.id ? "selected" : ""}`} onClick={() => props.onSelect(template.id)}>
            <div className="template-thumbnail"><Monitor size={28} /><span>{template.id}</span></div>
            <strong>{template.title}</strong>
            <p>{template.desc}</p>
            <em>{props.activeId === template.id ? (zh ? "当前模板" : "Active") : (zh ? "选择模板" : "Select")}</em>
          </button>
        ))}
      </div>
      <div className="form-grid compact">
        <label>{zh ? "主题色" : "Accent"}<select><option>{zh ? "冷光青蓝" : "Cyan blue"}</option><option>{zh ? "低饱和紫" : "Soft violet"}</option></select></label>
        <label>{zh ? "字幕位置" : "Subtitle position"}<select><option>{zh ? "底部安全区" : "Bottom safe"}</option><option>{zh ? "中下区域" : "Lower middle"}</option></select></label>
      </div>
    </div>
  );
}

function SettingsPage(props: { lang: UiLang; settings: Record<string, string | undefined>; onSave: (values: Record<string, string | undefined>) => Promise<void> }) {
  const zh = props.lang === "zh";
  const [draft, setDraft] = useState<Record<string, string | undefined>>({});
  function field(key: string, labelText: string, type = "text", hint?: string) {
    const saved = Boolean(props.settings[key]);
    return (
      <label>
        {labelText}
        <input type={type} value={draft[key] ?? ""} placeholder={props.settings[key] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
        <span className="field-hint">{saved ? (zh ? "已保存，输入新值即可更新" : "Saved. Enter a new value to update.") : hint ?? (zh ? "保存后自动生效" : "Applied after saving.")}</span>
      </label>
    );
  }
  return (
    <section className="view-panel settings-layout">
      <div className="settings-hero">
        <span>{zh ? "配置入口" : "Configuration Hub"}</span>
        <h2>{zh ? "接入大模型、语音、数据源和本地渲染工具" : "Connect models, voice, sources, and local render tools"}</h2>
        <p>{zh ? "密钥保存在本地 SQLite，界面按掩码展示；空配置时会使用本地回退链路完成制作流程。" : "Secrets are stored locally and masked in the UI. Local fallbacks keep the pipeline runnable."}</p>
      </div>
      <div className="work-panel">
        <div className="section-title"><Cog size={18} /> {zh ? "模型与语音" : "Models and Voice"}</div>
        <div className="form-grid">
          {field("DEEPSEEK_API_KEY", zh ? "DeepSeek 密钥" : "DeepSeek API Key", "password", zh ? "用于真实脚本生成" : "Used for real script generation.")}
          {field("DEEPSEEK_API_BASE", zh ? "DeepSeek 接口地址" : "DeepSeek API Base")}
          {field("DEEPSEEK_MODEL", zh ? "DeepSeek 模型" : "DeepSeek Model")}
          {field("VOLCENGINE_ACCESS_TOKEN", zh ? "豆包访问令牌" : "Doubao Access Token", "password", zh ? "用于真实配音生成" : "Used for real voice generation.")}
          {field("VOLCENGINE_APP_ID", zh ? "豆包应用 ID" : "Doubao App ID")}
          {field("VOLCENGINE_VOICE_TYPE", zh ? "默认音色" : "Default Voice")}
        </div>
      </div>
      <div className="work-panel">
        <div className="section-title"><SlidersHorizontal size={18} /> {zh ? "数据源与本地工具" : "Sources and Local Tools"}</div>
        <div className="form-grid">
          {field("PRODUCT_HUNT_TOKEN", zh ? "Product Hunt 令牌" : "Product Hunt Token", "password")}
          {field("REDDIT_CLIENT_ID", zh ? "Reddit 客户端 ID" : "Reddit Client ID")}
          {field("REDDIT_CLIENT_SECRET", zh ? "Reddit 客户端密钥" : "Reddit Client Secret", "password")}
          {field("REDDIT_USER_AGENT", zh ? "Reddit User Agent" : "Reddit User Agent")}
          {field("X_BEARER_TOKEN", zh ? "X 访问令牌" : "X Bearer Token", "password")}
          {field("FFMPEG_PATH", zh ? "FFmpeg 路径（可选）" : "FFmpeg Path (optional)", "text", zh ? "自动查找 PATH、C:\\ffmpeg\\bin 和 tools\\ffmpeg\\bin" : "Auto-detects PATH, C:\\ffmpeg\\bin, and tools\\ffmpeg\\bin.")}
          {field("FFPROBE_PATH", zh ? "FFprobe 路径（可选）" : "FFprobe Path (optional)", "text", zh ? "与 FFmpeg 使用同一套自动查找规则" : "Uses the same auto-detection rules.")}
          {field("PROXY_URL", zh ? "代理地址" : "Proxy URL")}
        </div>
      </div>
      <button className="primary-button settings-save" onClick={() => props.onSave(draft)}><Save size={16} /> {zh ? "保存设置" : "Save Settings"}</button>
    </section>
  );
}

function LogPanel(props: { lang: UiLang; logs: LogRow[] }) {
  const zh = props.lang === "zh";
  return (
    <div className="work-panel">
      <div className="section-title"><Activity size={18} /> {zh ? "任务日志" : "Task Logs"}</div>
      <div className="log-list">
        {props.logs.map((log) => (
          <div key={log.id} className={`log-row ${log.level}`}>
            <span>{new Date(log.created_at).toLocaleTimeString()}</span>
            <strong>{levelLabel(log.level, props.lang)}</strong>
            <p>{log.message}</p>
          </div>
        ))}
        {props.logs.length === 0 && <div className="empty-inline"><Activity size={24} /><strong>{zh ? "暂无日志" : "No logs yet"}</strong><p>{zh ? "执行采集、脚本、配音或渲染后会显示日志。" : "Run a job to see logs here."}</p></div>}
      </div>
    </div>
  );
}

function Inspector(props: { lang: UiLang; detail?: ProjectDetail; script?: VideoScript; job?: JobRow; logs: LogRow[] }) {
  const c = copy[props.lang];
  const zh = props.lang === "zh";
  return (
    <aside className="inspector">
      <div className="preview-panel">
        <div className="preview-frame">
          <div className="preview-grid" />
          <div className="preview-scope"><i /><i /><i /></div>
          <span className="preview-badge">{zh ? "视频预览 / Neo Signal" : "Preview / Neo Signal"}</span>
          <h2>{props.script?.title ?? c.previewTitle}</h2>
          <p>{props.script?.subtitle ?? c.previewDesc}</p>
          <div className="preview-meter"><b /><b /><b /><b /></div>
        </div>
      </div>
      <div className="inspector-section">
        <div className="panel-label">{c.timeline}</div>
        <div className="mini-timeline">
          {(props.script?.scenes ?? []).map((scene, index) => (
            <div key={scene.id} style={{ "--w": `${Math.max(12, scene.duration ?? 6) * 4}px` } as React.CSSProperties}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{sceneTypeLabel(scene.type, props.lang)}</strong>
            </div>
          ))}
          {props.script?.scenes?.length ? null : <p className="muted">{c.timelineEmpty}</p>}
        </div>
      </div>
      <div className="inspector-section">
        <div className="panel-label">{c.currentTask}</div>
        {props.job && (props.job.status === "running" || props.job.status === "pending") ? (
          <div className="job-card">
            <div className="job-head">
              <span>{jobTypeLabel(props.job.type, props.lang)}</span>
              <strong>{props.job.progress}%</strong>
            </div>
            <div className="progress"><span style={{ width: `${props.job.progress}%` }} /></div>
            <p>{jobStepLabel(props.job.step ?? props.job.status, props.lang)}</p>
          </div>
        ) : props.job?.status === "success" ? (
          <div className="job-done"><CheckCircle2 size={16} />{zh ? "任务完成" : "Job done"}</div>
        ) : props.job?.status === "failed" ? (
          <div className="job-failed"><AlertCircle size={16} />{props.job.error_message ?? (zh ? "任务失败" : "Job failed")}</div>
        ) : (
          <p className="muted">{c.queueIdle}</p>
        )}
      </div>
      <div className="inspector-section">
        <div className="panel-label">{c.exportParams}</div>
        <div className="kv"><span>{c.ratio}</span><strong>{props.detail?.ratio ?? "9:16"}</strong></div>
        <div className="kv"><span>{c.template}</span><strong>{templateLabel(props.detail?.templateId ?? "neo-signal", props.lang)}</strong></div>
        <div className="kv"><span>{c.status}</span><strong>{projectStatusLabel(props.detail?.status ?? "draft", props.lang)}</strong></div>
        {props.detail?.status === "exported" && props.detail?.finalVideoPath && (
          <div className="kv output-kv"><span>{zh ? "输出" : "Output"}</span><strong className="output-path-label">{props.detail.finalVideoPath.split(/[\\/]/).at(-1)}</strong></div>
        )}
      </div>
    </aside>
  );
}

function EmptyState(props: { icon: JSX.Element; title: string; children: string; action: string; onAction: () => void | Promise<void> }) {
  return <div className="empty-state">{props.icon}<h2>{props.title}</h2><p>{props.children}</p><button className="primary-button" onClick={props.onAction}>{props.action}</button></div>;
}

function label(item: { zh: string; en: string }, lang: UiLang) {
  return lang === "zh" ? item.zh : item.en;
}

function viewTitle(view: ViewId, lang: UiLang) {
  const item = navItems.find((nav) => nav.id === view);
  return item ? label(item, lang) : "TrendForge";
}

function formatJobDuration(job: JobRow | undefined, lang: UiLang): string | undefined {
  if (!job?.started_at) return undefined;
  const start = new Date(job.started_at).getTime();
  const end = job.finished_at ? new Date(job.finished_at).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const value = minutes > 0 ? `${minutes}分${String(rest).padStart(2, "0")}秒` : `${rest}秒`;
  if (job.status === "success") return lang === "zh" ? `渲染用时 ${value}` : `Render time ${value}`;
  return lang === "zh" ? `已用时 ${value}` : `Elapsed ${value}`;
}

function sourceLabel(id: string, lang: UiLang) {
  const zh: Record<string, string> = { manual: "手动输入", "hacker-news": "Hacker News", rss: "RSS", "product-hunt": "Product Hunt", reddit: "Reddit", "x-twitter": "X / Twitter" };
  const en: Record<string, string> = { manual: "Manual Input", "hacker-news": "Hacker News", rss: "RSS", "product-hunt": "Product Hunt", reddit: "Reddit", "x-twitter": "X / Twitter" };
  return (lang === "zh" ? zh : en)[id] ?? id;
}

function serviceLabel(labelText: string, lang: UiLang) {
  const map: Record<string, string> = {
    "Render Engine": "渲染引擎",
    "AI Model": "大模型",
    Voice: "配音",
    Storage: "本地存储",
    "Source Connectors": "Source Connectors",
    "DeepSeek Script Engine": "DeepSeek Script Engine",
    "Volcengine Doubao TTS": "Volcengine Doubao TTS",
    "Bilingual Subtitle Engine": "Bilingual Subtitle Engine",
    "HyperFrames HTML Video Renderer": "HyperFrames HTML Video Renderer",
    "FFmpeg Export": "FFmpeg Export",
    "Local Project Studio": "Local Project Studio"
  };
  return lang === "zh" ? map[labelText] ?? labelText : labelText;
}

function compactStatus(message: string, lang: UiLang) {
  if (lang === "zh") return message;
  const map: Record<string, string> = {
    本地合成可用: "Local render ready",
    内置预检已启用: "Preflight enabled",
    "DeepSeek 已连接": "DeepSeek connected",
    "可配置 DeepSeek": "DeepSeek configurable",
    豆包已连接: "Doubao connected",
    本地配音可用: "Local voice ready",
    已连接: "Connected",
    本地热点可用: "Local trends ready",
    可配置: "Configurable",
    内置就绪: "Built-in",
    在线: "Online",
    "配置 Key": "Add key",
    等待内置二进制: "Preparing binary"
  };
  if (message.startsWith("E:") || message.startsWith("C:")) return "Local storage";
  if (message.includes("TrendForge")) return "Local storage";
  if (message.includes("\\")) return "Local storage";
  if (message.includes("/")) return "Local storage";
  return map[message] ?? message;
}

function projectStatusLabel(status: string, lang: UiLang) {
  const zh: Record<string, string> = { draft: "草稿", collecting: "采集中", scripting: "脚本中", voicing: "配音中", subtitling: "字幕中", rendering: "渲染中", exported: "已导出", failed: "失败" };
  const en: Record<string, string> = { draft: "Draft", collecting: "Collecting", scripting: "Scripting", voicing: "Voicing", subtitling: "Subtitling", rendering: "Rendering", exported: "Exported", failed: "Failed" };
  return (lang === "zh" ? zh : en)[status] ?? status;
}

function sceneTypeLabel(type: string, lang: UiLang) {
  const zh: Record<string, string> = { cover: "封面", intro: "开场", item: "条目", analysis: "分析", outro: "收尾" };
  const en: Record<string, string> = { cover: "Cover", intro: "Intro", item: "Item", analysis: "Analysis", outro: "Outro" };
  return (lang === "zh" ? zh : en)[type] ?? type;
}

function jobTypeLabel(type: string, lang: UiLang) {
  const zh: Record<string, string> = { fetch_source: "内容采集", generate_script: "脚本生成", generate_tts: "配音生成", generate_subtitles: "字幕生成", generate_cover: "封面生成", render_video: "视频渲染", export_video: "视频导出", process_video: "视频处理" };
  const en: Record<string, string> = { fetch_source: "Fetch Source", generate_script: "Generate Script", generate_tts: "Generate Voice", generate_subtitles: "Generate Subtitles", generate_cover: "Generate Cover", render_video: "Render Video", export_video: "Export Video", process_video: "Process Video" };
  return (lang === "zh" ? zh : en)[type] ?? type;
}

function jobStepLabel(step: string, lang: UiLang) {
  if (lang === "en") return step;
  const map: Record<string, string> = { Done: "完成", Queued: "排队中", Starting: "启动中" };
  return map[step] ?? step;
}

function levelLabel(level: string, lang: UiLang) {
  const zh: Record<string, string> = { info: "信息", warn: "警告", error: "错误", debug: "调试" };
  return lang === "zh" ? zh[level] ?? level : level;
}

function templateLabel(templateId: string, lang: UiLang) {
  const zh: Record<string, string> = { "neo-signal": "Neo Signal 科技信号", "clean-product": "Clean Product 产品简报", "news-terminal": "News Terminal 新闻终端" };
  return lang === "zh" ? zh[templateId] ?? templateId : templateId;
}
