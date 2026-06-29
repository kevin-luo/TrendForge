import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AudioLines,
  BookOpen,
  Bot,
  Brain,
  Captions,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Cog,
  Cpu,
  Database,
  Download,
  FileText,
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
  Radio,
  RefreshCw,
  Rocket,
  Save,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Wand2,
  Wrench,
  X,
  Zap
} from "lucide-react";
import type { CreatorStyleAgent, Language, MatrixContentType, MatrixPlatform, Ratio, SourceType, SubtitleCue, VideoScript } from "@trendforge/core";
import type { MotionTemplateManifest } from "@trendforge/motion-core";
import { api } from "./api";
import type { ExportProfileChoice, ExportSubmissionSettings, JobRow, LogRow, MotionTemplateRegistry, ProjectDetail, RenderQualityReport, SourceInfo, SystemStatusMap } from "./types";

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

// Simplified nav: the home composer is the product. Advanced editing stays in
// the tools workspace so the home flow stays focused.
const navItems: Array<{ id: ViewId; icon: typeof Gauge; zh: string; en: string }> = [
  { id: "studio", icon: Home, zh: "首页", en: "Home" },
  { id: "history", icon: History, zh: "历史项目", en: "History" },
  { id: "settings", icon: Cog, zh: "设置", en: "Settings" }
];

const copy = {
  zh: {
    brandSub: "本地 AI 视频工作台",
    newProject: "新建视频项目",
    recentProjects: "历史项目",
    viewAll: "查看全部",
    ready: "系统就绪",
    refresh: "刷新",
    studioEyebrow: "一行输入，一次生成，一条结果",
    commandDeck: "Prompt to Promo",
    systemOverview: "系统状态",
    previewTitle: "Live preview",
    previewDesc: "脚本就绪后，画面在这里展开",
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
    noOutput: "final.mp4 会在导出后显示在这里",
    renderDone: "渲染完成！",
  },
  en: {
    brandSub: "Local AI Video Workstation",
    newProject: "New Project",
    recentProjects: "Recent Projects",
    viewAll: "View all",
    ready: "System ready",
    refresh: "Refresh",
    studioEyebrow: "One input. One action. One result.",
    commandDeck: "Prompt to Promo",
    systemOverview: "System Status",
    previewTitle: "Live preview",
    previewDesc: "The stage opens once the script is ready",
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
    noOutput: "final.mp4 appears here after export",
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
  const [motionRegistry, setMotionRegistry] = useState<MotionTemplateRegistry>();
  const [renderQuality, setRenderQuality] = useState<RenderQualityReport | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("content");
  const [homeStatusExpanded, setHomeStatusExpanded] = useState(false);
  const [job, setJob] = useState<JobRow>();
  const [message, setMessage] = useState<string>(copy.zh.ready);
  const { toasts, push } = useToast();

  const c = copy[lang];

  async function refresh(nextSelectedId = selectedId) {
    const [projectRows, sourceRows, statusRows, settingRows, registryRows] = await Promise.all([
      api.projects(),
      api.sources(),
      api.status(),
      api.settings(),
      api.motionTemplates()
    ]);
    setProjects(projectRows as ProjectDetail[]);
    setSources(sourceRows);
    setStatus(statusRows);
    setSettings(settingRows);
    setMotionRegistry(registryRows);
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
    let active = true;
    if (!detail?.id) {
      setRenderQuality(null);
      return () => {
        active = false;
      };
    }
    setRenderQuality(null);
    void api.renderQuality(detail.id).then((report) => {
      if (active) setRenderQuality(report);
    }).catch((error) => {
      if (active) setRenderQuality(null);
      if (error instanceof Error) {
        setMessage(error.message);
      }
    });
    return () => {
      active = false;
    };
  }, [detail?.id, detail?.updatedAt]);

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
    const project = await createAndSelectProject(lang === "zh" ? "今日 AI 产品信号" : "Today AI Product Signals", "9:16");
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


  async function extractCreatorStyle(options: { name?: string; niche?: string; language: Language; sampleText: string }) {
    let project = detail;
    if (!project) {
      project = await api.createProject(lang === "zh" ? "创作者风格样本" : "Creator style sample", "9:16");
      setSelectedId(project.id);
    }
    const result = await api.extractCreatorStyle(project.id, options);
    setDetail(await api.project(project.id));
    setLogs(await api.logs(project.id));
    push("success", lang === "zh" ? "创作者风格 agent 已生成" : "Creator style agent generated");
    return result.agent;
  }

  async function generatePromoVideo(options: {
    prompt: string;
    source: SourceType;
    contentType: MatrixContentType | "auto";
    persona?: string;
    platform: MatrixPlatform;
    ratio: Ratio;
    language: Language;
    date?: string;
    topCount?: number;
    rssUrl?: string;
    renderCandidates?: number;
    styleName?: string;
    styleNiche?: string;
    styleSampleText?: string;
    styleAgent?: CreatorStyleAgent;
  }) {
    try {
      const projectTitle = titleFromPrompt(options.prompt, lang);
      const project = await createAndSelectProject(projectTitle, options.ratio);
      push("info", lang === "zh" ? "正在生成宣传视频…" : "Generating promo video…");
      const next = await api.generatePromoVideo(project.id, options);
      setJob(next);
      const nextMessage = lang === "zh" ? "宣传视频任务已启动" : "Promo video job started";
      setMessage(nextMessage);
      push("info", nextMessage);
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

  async function createAndSelectProject(title: string, ratio: Ratio) {
    const project = await api.createProject(title, ratio);
    setSelectedId(project.id);
    setView("studio");
    setActiveTab("content");
    setJob(undefined);
    setDetail(await api.project(project.id));
    setLogs(await api.logs(project.id));
    return project;
  }

  const currentRatio = (detail?.ratio ?? "9:16") as Ratio;
  const script = detail?.script;
  const visibleStatus = useMemo(() => {
    const values = Object.values(status);
    if (view !== "studio") return values;
    const priority = ["html-film-renderer", "ffmpeg-export", "deepseek-script-engine"];
    const prioritized = priority.flatMap((id) => {
      const item = values.find((entry) => entry.id === id);
      return item ? [item] : [];
    });
    const rest = values.filter((entry) => !priority.includes(entry.id));
    const merged = [...prioritized, ...rest];
    return homeStatusExpanded ? merged : merged.slice(0, 4);
  }, [homeStatusExpanded, status, view]);
  const hiddenStatusCount = view === "studio" ? Math.max(0, Object.values(status).length - visibleStatus.length) : 0;
  const cues = useMemo(() => {
    const row = detail?.subtitles?.find((item) => item.format === "srt");
    return row?.cues_json ? (JSON.parse(row.cues_json) as SubtitleCue[]) : [];
  }, [detail?.subtitles]);

  const outputPath = detail?.status === "exported" ? detail?.finalVideoPath : undefined;

  return (
    <div className={`app-shell ${view === "studio" ? "home-shell" : ""}`}>
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
            <button className="ghost-button" onClick={() => setView("settings")}>
              <Cog size={16} />
              {lang === "zh" ? "设置" : "Settings"}
            </button>
            <div className="status-pill">{message}</div>
          </div>
        </header>

        <section className="dashboard-strip" aria-label={c.systemOverview}>
          {visibleStatus.map((item) => (
            <div key={item.id} className={`system-cell ${item.status}`}>
              <span>{serviceLabel(item.label, lang)}</span>
              <strong>{compactStatus(item.message, lang)}</strong>
            </div>
          ))}
          {view === "studio" && Object.values(status).length > visibleStatus.length && (
            <button
              type="button"
              className="system-cell system-toggle"
              aria-expanded={homeStatusExpanded}
              onClick={() => setHomeStatusExpanded((value) => !value)}
            >
              <span>{homeStatusExpanded ? (lang === "zh" ? "收起状态" : "Collapse") : (lang === "zh" ? "更多状态" : "More status")}</span>
              <strong>{homeStatusExpanded ? "−" : `+${hiddenStatusCount}`}</strong>
            </button>
          )}
        </section>

        {view === "studio" && (
          <HomeStudio
            lang={lang}
            detail={detail}
            registry={motionRegistry}
            sources={sources}
            status={status}
            job={job}
            renderQuality={renderQuality}
            onGenerate={generatePromoVideo}
            onExtractStyle={extractCreatorStyle}
            onOpenTools={openTools}
            onOpenSettings={() => setView("settings")}
            onOpenFolder={async (path) => { try { await api.openFolder(path); } catch { /* ignore */ } }}
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
              {activeTab === "template" && <TemplatePanel lang={lang} registry={motionRegistry} detail={detail} onSelect={selectTemplate} />}
              {activeTab === "export" && (
                <ExportPanel
                  lang={lang}
                  ratio={currentRatio}
                  job={job}
                  outputPath={outputPath}
                  qualityReport={renderQuality}
                  onRender={(settings) => detail ? runJob(() => api.render(detail.id, settings), c.renderStarted) : push("error", lang === "zh" ? "请先新建项目" : "Create a project first")}
                  onOpenFolder={async (p) => { try { await api.openFolder(p); } catch { /* ignore */ } }}
                />
              )}
              {activeTab === "logs" && <LogPanel lang={lang} logs={logs} />}
            </div>
          </section>
        )}

        {view === "history" && <HistoryPage lang={lang} projects={projects} selectedId={selectedId} onSelect={selectProject} />}
        {view === "templates" && <TemplateLibraryPage lang={lang} registry={motionRegistry} detail={detail} onSelect={selectTemplate} />}
        {view === "settings" && <SettingsPage lang={lang} settings={settings} onSave={saveSettings} />}
        {view === "guide" && <GuidePage lang={lang} onStart={() => { setView("studio"); createProject(); }} onOpenTools={openTools} />}
      </main>

      {view === "tools" && <Inspector lang={lang} detail={detail} script={script} job={job} logs={logs} />}

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
  registry?: MotionTemplateRegistry;
  sources: SourceInfo[];
  status: SystemStatusMap;
  job?: JobRow;
  renderQuality: RenderQualityReport | null;
  onGenerate: (options: {
    prompt: string;
    source: SourceType;
    contentType: MatrixContentType | "auto";
    persona?: string;
    platform: MatrixPlatform;
    ratio: Ratio;
    language: Language;
    date?: string;
    topCount?: number;
    rssUrl?: string;
    renderCandidates?: number;
    styleName?: string;
    styleNiche?: string;
    styleSampleText?: string;
    styleAgent?: CreatorStyleAgent;
  }) => Promise<void>;
  onExtractStyle: (options: { name?: string; niche?: string; language: Language; sampleText: string }) => Promise<CreatorStyleAgent>;
  onOpenTools: (tab: TabId) => void;
  onOpenSettings: () => void;
  onOpenFolder: (path: string) => Promise<void>;
  onRender: (settings: ExportSubmissionSettings) => void | Promise<void>;
  onPreview: () => void;
}) {
  const zh = props.lang === "zh";
  const [ratio, setRatio] = useState<Ratio>("9:16");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  const script = props.detail?.script;
  const hasScript = Boolean(script);
  const running = props.job?.status === "running" || props.job?.status === "pending";
  const busy = isGenerating || running;
  const outputPath = props.detail?.status === "exported" ? props.detail.finalVideoPath : undefined;
  const outputFileUrl = props.detail?.status === "exported" && props.detail?.id ? api.exportVideoUrl(props.detail.id) : undefined;
  const outputFileName = outputPath ? fileNameFromPath(outputPath) : undefined;
  const projectStatus = projectStatusLabel(props.detail?.status ?? "draft", props.lang);
  const jobProgress = props.job?.progress ?? 0;
  const renderCoverage = props.renderQuality?.sceneSpecs.imageCoverage ?? 0;
  const renderImageScenes = props.renderQuality?.sceneSpecs.imageSceneCount ?? 0;
  const renderSceneCount = props.renderQuality?.sceneSpecs.sceneCount ?? 0;
  const clampedTextCount = props.renderQuality?.textFitSummary?.clampedTextCount ?? 0;

  // Live preview === export (same makeFilmHtml). Reload the iframe when a job finishes.
  useEffect(() => {
    if (props.job?.status === "success") setPreviewNonce((value) => value + 1);
  }, [props.job?.status]);
  const previewSrc = props.detail ? `/api/projects/${props.detail.id}/preview?v=${previewNonce}` : undefined;

  const ratios: Ratio[] = ["9:16", "16:9", "1:1", "4:5"];
  const samples = zh
    ? [
        "为我的 AI 简历工具做一条 30 秒竖屏宣传片，突出一键生成和海量模板",
        "介绍一款主打专注的极简待办 App，清新治愈风格",
        "给一家精品手冲咖啡店做开业宣传，温暖质感"
      ]
    : [
        "A 30s vertical promo for my AI resume tool — one-click generation, rich templates",
        "Introduce a minimalist focus-first to-do app, calm and clean",
        "Opening promo for a specialty pour-over coffee shop, warm and cozy"
      ];

  async function handleGenerate() {
    if (!prompt.trim() || busy) return;
    setIsGenerating(true);
    try {
      await props.onGenerate({
        prompt: prompt.trim(),
        source: "manual",
        contentType: "auto",
        platform: "douyin",
        ratio,
        language: zh ? "zh" : "en",
        topCount: 5
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePrimaryAction() {
    if (busy) return;
    if (hasScript) {
      await props.onRender({ ratio, fps: 30, format: "mp4", burnSubtitles: false });
      return;
    }
    await handleGenerate();
  }

  const showPreview = hasScript && !busy && Boolean(previewSrc);
  const primaryLabel = busy ? (zh ? "处理中" : "Working") : hasScript ? (zh ? "渲染并导出" : "Render & export") : (zh ? "生成视频" : "Generate video");
  const primaryIcon = busy ? <span className="spinner" /> : hasScript ? <Download size={16} /> : <Zap size={16} />;

  return (
    <section className="promo-studio">
      <section className="promo-left forge-command">
        <header className="promo-hero">
          <span className="promo-kicker"><Sparkles size={14} /> TrendForge</span>
          <h1>{props.lang === "zh" ? "Prompt to Promo" : "Prompt to Promo"}</h1>
          <p>{zh ? "单一 prompt 驱动脚本、预览和导出，首页只保留最关键的操作。" : "One prompt drives script, preview, and export from a single control surface."}</p>
        </header>

        <div className="composer">
          <div className="composer-head">
            <span>{zh ? "单一 prompt" : "Single prompt"}</span>
            <span className="composer-shortcut">{zh ? "⌘ / Ctrl + Enter 直接执行" : "⌘ / Ctrl + Enter to run"}</span>
          </div>
          <textarea
            className="composer-input"
            rows={3}
            value={prompt}
            maxLength={500}
            placeholder={zh ? "例如：为我的 AI 简历工具做一条 30 秒竖屏宣传片，突出一键生成和海量模板…" : "e.g. A 30s vertical promo for my AI resume tool, highlight one-click generation…"}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void handlePrimaryAction(); }}
          />
          <div className="composer-bar">
            <div className="ratio-chips">
              {ratios.map((r) => (
                <button key={r} type="button" className={ratio === r ? "active" : ""} onClick={() => setRatio(r)}>{r}</button>
              ))}
            </div>
            <button className="send-btn" disabled={busy || (!hasScript && !prompt.trim())} onClick={() => void handlePrimaryAction()}>
              {busy ? <><span className="spinner" /> {jobProgress}%</> : <>{primaryIcon} {primaryLabel}</>}
            </button>
          </div>
          <p className="composer-footnote">
            {busy
              ? (props.job?.step ?? (zh ? "处理中" : "Working"))
              : hasScript
                ? (zh ? "已有脚本，主按钮直接进入渲染导出。" : "Script ready. The main button jumps straight into render and export.")
                : (zh ? "输入一句话后开始生成，比例先定，结果会写入右侧舞台。" : "Type one prompt to start. Set the ratio, then watch the stage on the right.")
            }
          </p>
        </div>

        {!hasScript && !busy && (
          <div className="composer-samples">
            <span>{zh ? "Seed prompts" : "Seed prompts"}</span>
            {samples.map((s) => <button key={s} type="button" onClick={() => setPrompt(s)}>{s}</button>)}
          </div>
        )}

      </section>

      <aside className="promo-right forge-results">
        <div className={`film-stage ratio-${ratio.replace(":", "-")} ${busy ? "is-busy" : ""} ${showPreview ? "is-live" : ""}`}>
          <div className="stage-head">
            <span>{zh ? "Live render stage" : "Live render stage"}</span>
            <button className="stage-action" type="button" onClick={() => setPreviewNonce((value) => value + 1)}>
              <RefreshCw size={14} />
              {zh ? "刷新" : "Refresh"}
            </button>
          </div>
          {showPreview && previewSrc ? (
            <iframe key={previewNonce} title="preview" src={previewSrc} />
          ) : busy ? (
            <div className="stage-state">
              <span className="spinner big" />
              <strong>{props.job?.step ?? (zh ? "生成中…" : "Generating…")}</strong>
              <p>{zh ? "扫描线会跟着进度向前推。" : "The scan line tracks render progress."}</p>
              <div className="stage-bar"><span style={{ width: `${jobProgress}%` }} /></div>
            </div>
          ) : (
            <div className="stage-state">
              <Clapperboard size={34} />
              <strong>{props.detail ? (zh ? "脚本已进入舞台" : "Script ready on stage") : (zh ? "等一行输入" : "Waiting for prompt")}</strong>
              <p>{props.detail ? (zh ? "预览、渲染、导出都在这一块。" : "Preview, render, and export live here.") : (zh ? "写一句话，点「生成视频」" : "Type a prompt, then generate.")}</p>
            </div>
          )}
          <div className="stage-radar" />
        </div>
      </aside>

      <section className="promo-sidecar forge-sidecar">
        <article className="result-card">
          <div className="panel-label">{zh ? "项目状态" : "Project status"}</div>
          <div className="result-title-row">
            <strong>{props.detail?.title ?? (zh ? "等待第一条 prompt" : "Waiting for the first prompt")}</strong>
            <span className={`result-badge ${running ? "running" : hasScript ? "ready" : "idle"}`}>{running ? (zh ? "运行中" : "Running") : hasScript ? (zh ? "可导出" : "Ready") : (zh ? "待输入" : "Idle")}</span>
          </div>
          <p className="result-copy">{running ? (props.job?.step ?? (zh ? "任务推进中" : "Job running")) : hasScript ? (zh ? "脚本和预览已接通，主按钮会直接进入导出。" : "Script and preview are wired. The main button jumps into export.") : (zh ? "先写一句 prompt，再选比例。" : "Write one prompt, then choose a ratio.")}</p>
          <div className="result-stat-grid">
            <div><span>{zh ? "画幅" : "Ratio"}</span><strong>{ratio}</strong></div>
            <div><span>{zh ? "模板" : "Template"}</span><strong>{templateLabel(props.detail?.templateId ?? "neo-signal", props.lang)}</strong></div>
            <div><span>{zh ? "任务" : "Job"}</span><strong>{running ? `${jobProgress}%` : projectStatus}</strong></div>
            <div><span>{zh ? "脚本场景" : "Script scenes"}</span><strong>{script?.scenes?.length ?? 0}</strong></div>
          </div>
          {running && <div className="result-progress"><span style={{ width: `${jobProgress}%` }} /></div>}
        </article>

        <article className="result-card">
          <div className="panel-label">{zh ? "图片覆盖" : "Image coverage"}</div>
          {props.renderQuality ? (
            <>
              <div className="result-highlight">
                <strong>{formatPercent(renderCoverage)}</strong>
                <span>{zh ? `覆盖 ${renderImageScenes}/${renderSceneCount} 个场景` : `${renderImageScenes}/${renderSceneCount} scenes covered`}</span>
              </div>
              <div className="result-summary-list">
                <div><span>{zh ? "主题" : "Theme"}</span><strong>{props.renderQuality.themeId}</strong></div>
                <div><span>{zh ? "文本压缩" : "Text clamps"}</span><strong>{clampedTextCount}</strong></div>
              </div>
            </>
          ) : (
            <div className="result-empty">
              <ShieldCheck size={16} />
              <div>
                <strong>{zh ? "图片覆盖等待首轮渲染" : "Image coverage appears after the first render"}</strong>
                <p>{zh ? "跑完一次渲染后，这里会显示图片覆盖、场景命中和质量信号。" : "Run one render and this card fills with image coverage, scene hits, and quality signals."}</p>
              </div>
            </div>
          )}
        </article>

        <article className="result-card">
          <div className="panel-label">{zh ? "质量摘要" : "Quality summary"}</div>
          {props.renderQuality ? (
            <div className="result-summary-list">
              <div><span>{zh ? "导出 profile" : "Export profile"}</span><strong>{props.renderQuality.renderProfile} / {props.renderQuality.encodeProfile}</strong></div>
              <div><span>{zh ? "画幅" : "Ratio"}</span><strong>{props.renderQuality.ratio}</strong></div>
              <div><span>{zh ? "模板分布" : "Template mix"}</span><strong>{formatCountSummary(props.renderQuality.sceneSpecs.templateCounts)}</strong></div>
              <div><span>{zh ? "视觉分布" : "Visual mix"}</span><strong>{formatCountSummary(props.renderQuality.sceneSpecs.visualTypeCounts)}</strong></div>
            </div>
          ) : (
            <div className="result-empty">
              <Gauge size={16} />
              <div>
                <strong>{zh ? "质量摘要等待导出" : "Quality summary appears after export"}</strong>
                <p>{zh ? "这里会显示导出 profile、模板分布和视觉分布。" : "This card shows export profile, template mix, and visual mix."}</p>
              </div>
            </div>
          )}
        </article>

        <article className="result-card result-card-export">
          <div className="panel-label">{zh ? "导出路径" : "Export path"}</div>
          {outputPath && outputFileUrl && outputFileName ? (
            <>
              <div className="output-file-info">
                <strong>{outputFileName}</strong>
                <p className="mono-path">{outputPath}</p>
              </div>
              <div className="result-actions">
                <a className="utility-link" href={outputFileUrl} download={outputFileName}>
                  <Download size={14} /> {zh ? "下载" : "Download"}
                </a>
                <button className="utility-link" onClick={() => props.onOpenFolder(outputPath)}>
                  <FolderOpen size={14} /> {zh ? "打开文件夹" : "Open folder"}
                </button>
                <button className="utility-link" onClick={props.onPreview}>
                  <Play size={14} /> {zh ? "打开预览" : "Open preview"}
                </button>
              </div>
            </>
          ) : (
            <div className="result-empty">
              <Download size={16} />
              <div>
                <strong>{zh ? "导出完成后这里出现下载入口" : "Download and folder actions appear after export"}</strong>
                <p>{zh ? "成片写入磁盘后，这里会显示文件名、导出路径和动作入口。" : "Once the file lands on disk, this card shows the filename, export path, and action buttons."}</p>
              </div>
            </div>
          )}
        </article>
      </section>
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
  const title = detail?.script?.title ?? (zh ? "自媒体宣传视频" : "Creator promo video");
  const cardTitle = shortCardTitle(title, zh ? 18 : 34);
  const subtitle = detail?.script?.subtitle ?? (zh ? "选题、分镜、字幕、发布包" : "Topic, storyboard, subtitles, publish pack");
  const date = new Date(detail?.updatedAt ?? Date.now()).toLocaleString();
  if (!detail?.script) return [];
  const duration = detail.script.scenes.reduce((sum, scene) => sum + (scene.duration ?? 6), 0);
  const durationLabel = zh ? `${Math.round(duration)} 秒` : `${Math.round(duration)}s`;
  return [
    { id: "a", title: cardTitle, subtitle: zh ? "快讯版 · 强开场" : "Quick cut · strong hook", duration: durationLabel, time: detail.ratio, created: date, tags: zh ? ["快讯版", "双语字幕", "可发布"] : ["Quick", "Bilingual", "Ready"] },
    { id: "b", title: zh ? `${cardTitle} · 标准版` : `${cardTitle} · Standard`, subtitle, duration: zh ? `${Math.round(duration * 1.12)} 秒` : `${Math.round(duration * 1.12)}s`, time: detail.ratio, created: date, tags: zh ? ["标准版", "脚本可编", "封面包"] : ["Standard", "Editable", "Cover pack"] },
    { id: "c", title: zh ? `${cardTitle} · 深度版` : `${cardTitle} · Deep`, subtitle: zh ? "更完整的解释和平台文案" : "Deeper explanation and copy", duration: zh ? `${Math.round(duration * 1.35)} 秒` : `${Math.round(duration * 1.35)}s`, time: detail.ratio === "9:16" ? "16:9" : detail.ratio, created: date, tags: zh ? ["深度版", "发布文案", "剪映备注"] : ["Deep", "Copy", "Jianying note"] }
  ];
}

function shortCardTitle(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function titleFromPrompt(prompt: string, lang: UiLang): string {
  const first = prompt.split(/[\n。.!?？]/).map((part) => part.trim()).find(Boolean);
  return first ? first.slice(0, 32) : lang === "zh" ? "自媒体宣传视频" : "Creator promo video";
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).at(-1) ?? path;
}

function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sourceIcon(id: string) {
  if (id === "manual") return <PencilLine size={15} />;
  if (id === "rss") return <Radio size={15} />;
  if (id === "product-hunt") return <PackageOpen size={15} />;
  if (id === "hacker-news") return <Clapperboard size={15} />;
  return <Database size={15} />;
}

function contentTypeLabel(id: MatrixContentType | "auto", lang: UiLang) {
  const zh: Record<MatrixContentType | "auto", string> = {
    auto: "自动判断",
    tool_list: "工具榜单",
    news_explain: "新闻解读",
    science_explain: "知识科普",
    history_story: "历史故事",
    opinion_comment: "观点评论"
  };
  const en: Record<MatrixContentType | "auto", string> = {
    auto: "Auto",
    tool_list: "Tool list",
    news_explain: "News explain",
    science_explain: "Science explain",
    history_story: "History story",
    opinion_comment: "Opinion"
  };
  return (lang === "zh" ? zh : en)[id];
}

function platformLabel(id: MatrixPlatform, lang: UiLang) {
  const zh: Record<MatrixPlatform, string> = {
    douyin: "抖音",
    xiaohongshu: "小红书",
    wechat_channels: "视频号",
    bilibili: "B 站",
    youtube: "YouTube",
    youtube_shorts: "Shorts"
  };
  const en: Record<MatrixPlatform, string> = {
    douyin: "Douyin",
    xiaohongshu: "Xiaohongshu",
    wechat_channels: "Channels",
    bilibili: "Bilibili",
    youtube: "YouTube",
    youtube_shorts: "Shorts"
  };
  return (lang === "zh" ? zh : en)[id];
}

function jobStageItems(job: JobRow | undefined, lang: UiLang) {
  const zh = lang === "zh";
  const labels = zh ? ["输入", "风格", "分析", "分镜", "渲染", "导出"] : ["Input", "Style", "Analyze", "Storyboard", "Render", "Export"];
  const progress = job?.progress ?? 0;
  return labels.map((label, index) => {
    const threshold = [8, 28, 38, 58, 68, 96][index] ?? 0;
    const nextThreshold = [28, 38, 58, 68, 96, 101][index] ?? 101;
    return { label, done: progress >= threshold, active: progress >= threshold && progress < nextThreshold };
  });
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

function TemplatePanel(props: { lang: UiLang; registry?: MotionTemplateRegistry; detail?: ProjectDetail; onSelect: (templateId: string) => Promise<void> }) {
  return <TemplateChooser lang={props.lang} registry={props.registry} activeId={props.detail?.templateId ?? "neo-signal"} onSelect={props.onSelect} compact />;
}

function ExportPanel(props: {
  lang: UiLang;
  ratio: Ratio;
  job?: JobRow;
  outputPath?: string;
  qualityReport?: RenderQualityReport | null;
  onRender: (settings: ExportSubmissionSettings) => void | Promise<void>;
  onOpenFolder: (path: string) => Promise<void>;
}) {
  const zh = props.lang === "zh";
  const [ratio, setRatio] = useState<Ratio>(props.ratio);
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [renderProfile, setRenderProfile] = useState<ExportProfileChoice>("auto");
  const isRunning = props.job?.status === "running" || props.job?.status === "pending";
  const durationLabel = formatJobDuration(props.job, props.lang);
  const renderProfileLabel = exportProfileLabel(renderProfile, props.lang);
  const renderProfileNote = exportProfileNote(renderProfile, props.lang);
  const renderSettings: ExportSubmissionSettings = {
    ratio,
    fps,
    format,
    burnSubtitles,
    ...(renderProfile === "auto" ? {} : { renderProfile })
  };

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

      <div className="output-profile-note">
        <div className="panel-label">{zh ? "质量 profile" : "Quality profile"}</div>
        <strong>{renderProfileLabel}</strong>
        <p>{renderProfileNote}</p>
      </div>

      {props.qualityReport ? (
        <div className="quality-report-card">
          <div className="panel-label">{zh ? "质量摘要" : "Quality summary"}</div>
          <div className="quality-report-grid">
            <div className="quality-report-item">
              <span>{zh ? "实际导出" : "Actual export"}</span>
              <strong>{`${props.qualityReport.renderProfile} / ${props.qualityReport.encodeProfile}`}</strong>
            </div>
            <div className="quality-report-item">
              <span>{zh ? "主题" : "Theme"}</span>
              <strong>{props.qualityReport.themeId}</strong>
            </div>
            <div className="quality-report-item">
              <span>{zh ? "图片覆盖" : "Image coverage"}</span>
              <strong>{formatPercent(props.qualityReport.sceneSpecs.imageCoverage)} · {props.qualityReport.sceneSpecs.imageSceneCount}/{props.qualityReport.sceneSpecs.sceneCount}</strong>
            </div>
            <div className="quality-report-item">
              <span>{zh ? "text-fit 压缩" : "Text-fit clamps"}</span>
              <strong>{props.qualityReport.textFitSummary?.clampedTextCount ?? 0}</strong>
            </div>
          </div>
          <div className="quality-report-block">
            <span>{zh ? "模板分布" : "Template distribution"}</span>
            <p>{formatCountSummary(props.qualityReport.sceneSpecs.templateCounts)}</p>
          </div>
          <div className="quality-report-block">
            <span>{zh ? "视觉分布" : "Visual distribution"}</span>
            <p>{formatCountSummary(props.qualityReport.sceneSpecs.visualTypeCounts)}</p>
          </div>
        </div>
      ) : (
        <div className="quality-report-empty">
          <ShieldCheck size={16} />
          <div>
            <strong>{zh ? "质量报告稍后显示" : "Quality report will appear here"}</strong>
            <p>{zh ? "完成一次渲染后，这里会显示实际导出 profile、模板分布、图片覆盖和 text-fit 统计。" : "Render once to see actual export profiles, template distribution, image coverage, and text-fit stats."}</p>
          </div>
        </div>
      )}

      <div className="form-grid">
        <label>{zh ? "画幅比例" : "Ratio"}<select value={ratio} onChange={(event) => setRatio(event.target.value as Ratio)}><option value="9:16">9:16 竖屏 1080×1920</option><option value="16:9">16:9 横屏 1920×1080</option><option value="1:1">1:1 方形 1080×1080</option><option value="4:5">4:5 社媒 1080×1350</option></select></label>
        <label>{zh ? "帧率" : "FPS"}<select value={fps} onChange={(event) => setFps(Number(event.target.value) as 24 | 30 | 60)}><option value={24}>24 fps</option><option value={30}>30 fps（推荐）</option><option value={60}>60 fps</option></select></label>
        <label>{zh ? "格式" : "Format"}<select value={format} onChange={(event) => setFormat(event.target.value as "mp4" | "webm")}><option value="mp4">MP4（H.264）</option><option value="webm">WebM（VP9）</option></select></label>
        <label>{zh ? "质量 profile" : "Quality profile"}<select value={renderProfile} onChange={(event) => setRenderProfile(event.target.value as ExportProfileChoice)}><option value="auto">{zh ? "自动" : "Auto"}</option><option value="standard">{zh ? "标准" : "Standard"}</option><option value="high">{zh ? "高质量" : "High quality"}</option></select></label>
        <label className="check-field"><input type="checkbox" checked={burnSubtitles} onChange={(event) => setBurnSubtitles(event.target.checked)} /> {zh ? "烧录字幕到视频" : "Burn subtitles into video"}</label>
      </div>

      <button className={`primary-button render-button ${isRunning ? "loading" : ""}`} disabled={isRunning} onClick={() => props.onRender(renderSettings)}>
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

function formatCountSummary(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  if (entries.length === 0) return "0";
  return entries
    .slice(0, 3)
    .map(([key, count]) => `${key} × ${count}`)
    .join(" · ");
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function TemplateLibraryPage(props: { lang: UiLang; registry?: MotionTemplateRegistry; detail?: ProjectDetail; onSelect: (templateId: string) => Promise<void> }) {
  return (
    <section className="view-panel">
      <TemplateChooser lang={props.lang} registry={props.registry} activeId={props.detail?.templateId ?? "neo-signal"} onSelect={props.onSelect} />
    </section>
  );
}

type TemplateChooserCard = Pick<MotionTemplateManifest, "id" | "name" | "description" | "category" | "tags" | "bestFor">;

function TemplateChooser(props: { lang: UiLang; registry?: MotionTemplateRegistry; activeId: string; onSelect: (templateId: string) => Promise<void>; compact?: boolean }) {
  const zh = props.lang === "zh";
  const templates: TemplateChooserCard[] = props.registry?.templates ?? [
    {
      id: "neo-signal",
      name: zh ? "Neo Signal / 科技信号" : "Neo Signal",
      description: zh ? "深色视频工作台风格，适合 AI 工具榜单和热点解读。" : "Dark workstation style for AI tools and trend analysis.",
      category: "studio",
      tags: ["dark", "signal", "trend"],
      bestFor: zh ? ["AI 工具榜单", "热点解读"] : ["AI tool ranking", "trend analysis"]
    },
    {
      id: "clean-product",
      name: zh ? "Clean Product / 产品简报" : "Clean Product",
      description: zh ? "明快产品说明风，适合软件发布和功能盘点。" : "Clean product brief style.",
      category: "studio",
      tags: ["clean", "product", "launch"],
      bestFor: zh ? ["软件发布", "功能盘点"] : ["software launch", "feature recap"]
    },
    {
      id: "news-terminal",
      name: zh ? "News Terminal / 新闻终端" : "News Terminal",
      description: zh ? "信息终端风，适合资讯快报和多条热点。" : "Terminal-news style for fast updates.",
      category: "studio",
      tags: ["terminal", "news", "fast"],
      bestFor: zh ? ["资讯快报", "多条热点"] : ["news flash", "multi-item updates"]
    }
  ];
  const designSystems = props.registry?.designSystems ?? [];
  return (
    <div className="work-panel full-panel">
      <div className="section-title"><Layers size={18} /> {zh ? "模板库" : "Template Library"}</div>
      <div className={props.compact ? "template-picker compact-picker" : "template-picker"}>
        {templates.map((template) => (
          <button key={template.id} className={`template-card ${props.activeId === template.id ? "selected" : ""}`} onClick={() => props.onSelect(template.id)}>
            <div className="template-thumbnail"><Monitor size={28} /><span>{template.id}</span></div>
            <strong>{template.name}</strong>
            <p>{template.description}</p>
            <div className="template-meta-row">
              <span>{template.category}</span>
              <span>{template.tags.slice(0, 3).join(" · ")}</span>
            </div>
            <div className="template-bestfor">
              {template.bestFor.slice(0, props.compact ? 2 : 3).map((item) => <span key={item}>{item}</span>)}
            </div>
            <em>{props.activeId === template.id ? (zh ? "当前模板" : "Active") : (zh ? "选择模板" : "Select")}</em>
          </button>
        ))}
      </div>
      <div className="design-system-section">
        <div className="panel-toolbar">
          <div className="section-title"><ShieldCheck size={18} /> {zh ? "open-design 主题" : "open-design Themes"}</div>
          <span className="contract-pill">{zh ? "DESIGN.md 合约" : "DESIGN.md contract"}</span>
        </div>
        <div className="design-system-grid">
          {designSystems.map((system) => (
            <article key={system.slug} className="design-system-card">
              <div className="design-system-head">
                <div>
                  <strong>{system.name}</strong>
                  <span>{system.themeId}</span>
                </div>
                <span className="origin-pill">{system.origin.project}</span>
              </div>
              <p className="mono-path">{system.designDocPath}</p>
              <div className="design-meta-line">
                <span>{zh ? "适合" : "Best for"}: {system.bestFor.slice(0, 3).join(" · ")}</span>
                <span>{zh ? "标签" : "Tags"}: {system.styleTags.slice(0, 4).join(" · ")}</span>
              </div>
              <div className="quality-summary">
                <strong>{zh ? "质量审查" : "Quality review"}</strong>
                <ul>
                  {system.qualityRules.slice(0, props.compact ? 2 : 3).map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
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
        <div className="section-title"><Image size={18} /> {zh ? "本地程序化视频引擎" : "Programmatic Video Engine"}</div>
        <p className="settings-note">{zh ? "TrendForge 自己生成画面、动效、字幕、安全区、封面和最终 MP4。当前重点是低成本矩阵批量、可控风格、可编辑工程和稳定发布包。" : "TrendForge generates visuals, motion, captions, safe areas, covers, and final MP4 locally. The focus is low-cost batch production, controllable style, editable project data, and stable publishing packages."}</p>
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

function exportProfileLabel(profile: ExportProfileChoice, lang: UiLang) {
  const zh: Record<ExportProfileChoice, string> = {
    auto: "自动",
    standard: "标准",
    high: "高质量"
  };
  const en: Record<ExportProfileChoice, string> = {
    auto: "Auto",
    standard: "Standard",
    high: "High quality"
  };
  return (lang === "zh" ? zh : en)[profile];
}

function exportProfileNote(profile: ExportProfileChoice, lang: UiLang) {
  const zh: Record<ExportProfileChoice, string> = {
    auto: "由服务端按 DPR 和画幅自动选择 profile。",
    standard: "标准编码，适合快速预览和日常导出。",
    high: "更低压缩、更细画面，适合最终发布版本。"
  };
  const en: Record<ExportProfileChoice, string> = {
    auto: "The server selects a profile from DPR and frame size.",
    standard: "Standard encoding for fast previews and everyday exports.",
    high: "Lower compression and cleaner detail for final publishing."
  };
  return (lang === "zh" ? zh : en)[profile];
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
    "DeepSeek Script Engine": "DeepSeek",
    "Volcengine Doubao TTS": "豆包 TTS",
    "Programmatic Video Engine": "程序化视频引擎",
    "Bilingual Subtitle Engine": "Bilingual Subtitle Engine",
    "Remotion Multi-scene Renderer": "Remotion 历史适配器",
    "FFmpeg Export": "FFmpeg",
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
    "配置图片 Key": "Add image key",
    内置就绪: "Built-in",
    在线: "Online",
    "配置 Key": "Add key",
    等待内置二进制: "Preparing binary",
    就绪: "Ready"
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
  const zh: Record<string, string> = { fetch_source: "内容采集", generate_script: "脚本生成", generate_tts: "配音生成", generate_subtitles: "字幕生成", generate_cover: "封面生成", render_video: "视频渲染", export_video: "视频导出", process_video: "视频处理", product_hunt_video: "Product Hunt 视频生成", promo_video: "宣传视频生成", matrix_video: "矩阵视频生成", motion_render: "MotionGraph 渲染" };
  const en: Record<string, string> = { fetch_source: "Fetch Source", generate_script: "Generate Script", generate_tts: "Generate Voice", generate_subtitles: "Generate Subtitles", generate_cover: "Generate Cover", render_video: "Render Video", export_video: "Export Video", process_video: "Process Video", product_hunt_video: "Product Hunt Video", promo_video: "Promo Video", matrix_video: "Matrix Video", motion_render: "MotionGraph Render" };
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
