import {
  Check,
  Copy,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JobLog } from "../lib/types";

interface LogConsoleProps {
  logs: JobLog[];
  onClear: () => void;
}

type LogSeverity = "command" | "error" | "warning" | "success" | "progress" | "info";

function logSeverity(log: JobLog): LogSeverity {
  const line = log.line.trim();
  if (log.stream === "system" && line.startsWith("$")) return "command";
  if (
    /\b(error|failed|failure|fatal|exception|traceback)\b|执行失败|转换失败|无法|拒绝|invalid argument|nothing was written|could not/i.test(
      line
    )
  ) {
    return "error";
  }
  if (/\b(warn(?:ing)?|deprecated)\b|警告|注意：|注意:|丢帧/i.test(line)) return "warning";
  if (
    /\b(success(?:ful(?:ly)?)?|completed|finished)\b|成功|已完成|下载完成|登录成功/i.test(line)
  ) {
    return "success";
  }
  if (
    /^frame=\s*|(?:^|\s)(?:time|speed|fps)=|^\[download\]\s+\d|下载中|正在处理/i.test(line)
  ) {
    return "progress";
  }
  return "info";
}

export function LogConsole({ logs, onClear }: LogConsoleProps) {
  const [paused, setPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const endRef = useRef<HTMLDivElement>(null);
  const visibleLogs = useMemo(
    () => (paused && pausedAt !== null ? logs.slice(0, pausedAt) : logs),
    [logs, paused, pausedAt]
  );

  useEffect(() => {
    if (!paused) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, paused]);

  const copyLogs = async () => {
    const content = logs
      .map((line) => `${line.timestamp} [${line.tool}/${line.stream}] ${line.line}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  const togglePaused = () => {
    setPaused((current) => {
      if (!current) setPausedAt(logs.length);
      else setPausedAt(null);
      return !current;
    });
  };

  return (
    <section className={`log-console standalone ${maximized ? "maximized" : ""}`}>
      <header className="console-header">
        <span className="console-title">
          日志控制台
          <span className="log-count">{logs.length}</span>
        </span>
        <div className="console-actions">
          {copyState !== "idle" && (
            <span className={`copy-feedback ${copyState}`} role="status">
              {copyState === "copied" ? "已复制" : "复制失败"}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setMaximized((current) => !current);
            }}
            title={maximized ? "退出最大化" : "最大化日志控制台"}
          >
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button type="button" onClick={togglePaused} title={paused ? "继续滚动" : "暂停滚动"}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            className={copyState === "copied" ? "copy-success" : copyState === "failed" ? "copy-failed" : ""}
            onClick={() => void copyLogs()}
            title={copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制日志"}
            aria-label={copyState === "copied" ? "日志已复制" : "复制日志"}
          >
            {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button type="button" onClick={onClear} title="清空">
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      <div className="console-body">
        {visibleLogs.length === 0 ? (
          <div className="console-empty">任务输出会显示在这里。</div>
        ) : (
          visibleLogs.map((log, index) => (
            <div
              className={`log-line ${log.stream} severity-${logSeverity(log)}`}
              key={`${log.jobId}-${index}`}
            >
              <span className="log-time">{log.timestamp}</span>
              <span className="log-tool">{log.tool}</span>
              <span>{log.line}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}
