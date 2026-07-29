import {
  Archive,
  Ban,
  CheckCircle2,
  CircleDashed,
  FileArchive,
  ShieldCheck,
  X,
  XCircle
} from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { useMemo, useState } from "react";
import { Toggle } from "../components/Field";
import type {
  DiagnosticExportRequest,
  DiagnosticExportResult,
  JobLog,
  JobState
} from "../lib/types";

interface TasksPageProps {
  jobs: JobState[];
  logs: JobLog[];
  onCancel: (jobId: string) => void;
  onExport: (request: DiagnosticExportRequest) => Promise<DiagnosticExportResult>;
}

export function TasksPage({ jobs, logs, onCancel, onExport }: TasksPageProps) {
  const [selectedJob, setSelectedJob] = useState<JobState | null>(null);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeDependencyPaths, setIncludeDependencyPaths] = useState(false);
  const [redactPersonalData, setRedactPersonalData] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const selectedLogs = useMemo(
    () => (selectedJob ? logs.filter((log) => log.jobId === selectedJob.jobId) : []),
    [logs, selectedJob]
  );

  const openExport = (job: JobState) => {
    setSelectedJob(job);
    setIncludeLogs(true);
    setIncludeDependencyPaths(false);
    setRedactPersonalData(true);
    setExportedPath(null);
    setExportError(null);
  };

  const closeExport = () => {
    if (!exporting) setSelectedJob(null);
  };

  const exportDiagnostics = async () => {
    if (!selectedJob) return;
    try {
      const chosenPath = await save({
        defaultPath: `MAD-Toolbox-Diagnostics-${selectedJob.tool}-${selectedJob.jobId.slice(0, 8)}.zip`,
        filters: [{ name: "ZIP 诊断包", extensions: ["zip"] }]
      });
      if (!chosenPath) return;
      const outputPath = chosenPath.toLowerCase().endsWith(".zip")
        ? chosenPath
        : `${chosenPath}.zip`;
      setExporting(true);
      setExportedPath(null);
      setExportError(null);
      const result = await onExport({
        job: selectedJob,
        logs: includeLogs ? selectedLogs : [],
        outputPath,
        includeLogs,
        includeDependencyPaths,
        redactPersonalData
      });
      setExportedPath(result.path);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">JOB QUEUE</span>
          <h1>任务中心</h1>
          <p>查看任务状态、取消运行中的任务，或导出单个任务的诊断 ZIP。</p>
        </div>
      </div>
      <div className="task-list">
        {jobs.length === 0 ? (
          <div className="empty-state">还没有执行过任务。</div>
        ) : (
          jobs.map((job) => (
            <div className="task-row" key={job.jobId}>
              <span className={`task-state ${job.state}`}>
                {job.state === "running" ? (
                  <CircleDashed size={18} className="spin" />
                ) : job.state === "completed" ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <XCircle size={18} />
                )}
              </span>
              <span className="task-copy">
                <strong>{job.tool}</strong>
                <small>{job.message}</small>
              </span>
              <code>{job.jobId.slice(0, 8)}</code>
              <span className="task-actions">
                <button className="secondary-button" type="button" onClick={() => openExport(job)}>
                  <Archive size={14} />
                  导出诊断
                </button>
                {job.state === "running" && (
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => onCancel(job.jobId)}
                  >
                    <Ban size={14} />
                    取消
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
      {selectedJob && (
        <div className="diagnostic-backdrop" role="presentation" onMouseDown={closeExport}>
          <section
            className="diagnostic-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diagnostic-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <span className="diagnostic-icon"><FileArchive size={20} /></span>
              <span>
                <strong id="diagnostic-title">导出任务诊断包</strong>
                <small>{selectedJob.tool} · {selectedJob.jobId.slice(0, 8)}</small>
              </span>
              <button
                className="icon-button"
                type="button"
                aria-label="关闭"
                disabled={exporting}
                onClick={closeExport}
              >
                <X size={16} />
              </button>
            </header>

            <div className="diagnostic-options">
              <Toggle
                checked={includeLogs}
                onChange={setIncludeLogs}
                label={`包含此任务日志（当前 ${selectedLogs.length} 条）`}
                hint="运行中的任务会导出点击时的日志快照。"
              />
              <Toggle
                checked={includeDependencyPaths}
                onChange={setIncludeDependencyPaths}
                label="包含依赖程序路径"
                hint="用于定位内置版与系统版依赖冲突，默认不包含。"
              />
              <Toggle
                checked={redactPersonalData}
                onChange={setRedactPersonalData}
                label="脱敏本地路径和 URL"
                hint="用 $HOME 替换用户目录并隐藏 URL；登录凭据始终脱敏。"
              />
            </div>

            <div className="diagnostic-privacy">
              <ShieldCheck size={17} />
              <span>
                <strong>不包含涉密内容，也不会自动提交</strong>
                <small>诊断功能不会读取系统凭据管理器或设置模板；Cookie、Token、密码和代理认证始终会被隐藏。</small>
              </span>
            </div>

            {exportedPath && (
              <div className="diagnostic-success">
                <CheckCircle2 size={16} />
                <span>
                  <strong>诊断包已导出</strong>
                  <small title={exportedPath}>{exportedPath}</small>
                </span>
              </div>
            )}
            {exportError && (
              <div className="diagnostic-error">
                <XCircle size={16} />
                <span>
                  <strong>导出失败</strong>
                  <small>{exportError}</small>
                </span>
              </div>
            )}

            <footer>
              <button className="secondary-button" type="button" disabled={exporting} onClick={closeExport}>
                {exportedPath ? "完成" : "取消"}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={exporting}
                onClick={() => void exportDiagnostics()}
              >
                <FileArchive size={14} />
                {exporting ? "正在打包…" : exportedPath ? "重新导出" : "选择位置并导出"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
