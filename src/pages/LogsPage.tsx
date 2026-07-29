import type { JobLog } from "../lib/types";
import { LogConsole } from "../components/LogConsole";

interface LogsPageProps {
  logs: JobLog[];
  onClear: () => void;
}

export function LogsPage({ logs, onClear }: LogsPageProps) {
  return (
    <div className="page logs-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">TERMINAL</span>
          <h1>日志终端</h1>
          <p>查看工具命令、运行输出和错误信息。离开此页面后日志仍会在后台继续记录。</p>
        </div>
      </div>
      <LogConsole logs={logs} onClear={onClear} />
    </div>
  );
}
