//! 进程执行基座（架构文档 §9）：带进程树击杀能力的 spawn。
//!
//! 旧代码的缺陷：`child.kill()` 只杀直接子进程，BBDown/yt-dlp 拉起的 ffmpeg 孙进程
//! 在 Windows 上存活残留。本模块用 Job Object 修正：
//! - 子进程 spawn 后立即挂入 Job（`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`）；
//! - 显式击杀 = `TerminateJobObject`（整树）；
//! - Job 句柄 drop（含 app 崩溃时的句柄回收）→ 随关即杀，崩溃清理免费获得。
//! 已知局限：挂入 Job 前的微秒窗口内 spawn 的孙进程会逃逸——BBDown/ffmpeg 的
//! spawn 时序在实践中不可达此窗口。
//! 否决 `taskkill /T /F`：PID 复用竞态、无崩溃清理、遗漏已脱离的子进程。
//!
//! unix 侧对应物为进程组：`process_group(0)` + `kill(-pgid, SIGKILL)`。

pub mod decode;

use std::ffi::OsStr;
use std::io;
use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdout, Command};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
mod job {
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    /// Job Object 句柄。持有即拥有：drop 关闭句柄，触发 KILL_ON_JOB_CLOSE 整树击杀。
    pub struct JobHandle(HANDLE);

    // Job 句柄本身线程安全（内核对象），裸指针字段导致的 !Send 是误报
    unsafe impl Send for JobHandle {}
    unsafe impl Sync for JobHandle {}

    impl JobHandle {
        pub fn new() -> std::io::Result<Self> {
            unsafe {
                let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if job.is_null() {
                    return Err(std::io::Error::last_os_error());
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let ok = SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const core::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                if ok == 0 {
                    let err = std::io::Error::last_os_error();
                    CloseHandle(job);
                    return Err(err);
                }
                Ok(JobHandle(job))
            }
        }

        pub fn assign(&self, process: HANDLE) -> std::io::Result<()> {
            unsafe {
                if AssignProcessToJobObject(self.0, process) == 0 {
                    return Err(std::io::Error::last_os_error());
                }
            }
            Ok(())
        }

        pub fn terminate(&self) {
            unsafe {
                TerminateJobObject(self.0, 1);
            }
        }
    }

    impl Drop for JobHandle {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}

/// 树击杀柄：与子进程所有权分离，可克隆——枢纽持柄、runner 任务持子进程。
/// Windows 上最后一个克隆 drop 时关闭 Job 句柄（KILL_ON_JOB_CLOSE 兜底击杀）。
#[derive(Clone)]
pub struct TreeKiller {
    #[cfg(windows)]
    job: std::sync::Arc<job::JobHandle>,
    #[cfg(unix)]
    pid: Option<i32>,
}

impl TreeKiller {
    /// 击杀整个进程树。立即返回，不等待退出——调用方随后 `wait()` 观察退出确认
    /// （对应状态机的 canceling → canceled，§4.3）。
    pub fn kill_tree(&self) {
        #[cfg(windows)]
        self.job.terminate();
        #[cfg(unix)]
        if let Some(pid) = self.pid {
            unsafe {
                libc::kill(-pid, libc::SIGKILL);
            }
        }
    }
}

/// 挂入 Job Object（Windows）/进程组（unix）的子进程。
pub struct TreeChild {
    child: Child,
    killer: TreeKiller,
}

/// 全局代理下发给子进程：yt-dlp/musicdl 的 Python 网络栈与 BBDown 的 .NET 栈
/// （macOS 上不读系统代理）都认这三个环境变量；表单里显式填写的代理
/// （如 yt-dlp `--proxy`、musicdl 的 requests overrides）优先级更高，不受影响。
pub fn apply_proxy_env(cmd: &mut Command, proxy: Option<&str>) {
    let Some(proxy) = proxy.map(str::trim).filter(|p| !p.is_empty()) else {
        return;
    };
    cmd.env("HTTP_PROXY", proxy);
    cmd.env("HTTPS_PROXY", proxy);
    cmd.env("ALL_PROXY", proxy);
}

/// spawn 一个纳入树管辖的子进程：stdio 管道化、stdin 关闭、无控制台窗口。
/// `env_path`：注入的 PATH（复用现有 command_path() 的增广逻辑）。
/// `proxy`：全局代理（设置页），经环境变量下发。
pub fn spawn_tree(
    program: &Path,
    argv: &[String],
    cwd: Option<&Path>,
    env_path: Option<&OsStr>,
    proxy: Option<&str>,
) -> io::Result<TreeChild> {
    let mut cmd = Command::new(program);
    cmd.args(argv)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    if let Some(path) = env_path {
        cmd.env("PATH", path);
    }
    apply_proxy_env(&mut cmd, proxy);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    #[cfg(unix)]
    cmd.process_group(0);

    #[cfg(windows)]
    {
        let job = job::JobHandle::new()?;
        let child = cmd.spawn()?;
        if let Some(handle) = child.raw_handle() {
            // 失败（如宿主环境禁止嵌套 Job）不致命：退化为旧行为（只杀直接子进程）
            let _ = job.assign(handle as _);
        }
        let killer = TreeKiller {
            job: std::sync::Arc::new(job),
        };
        Ok(TreeChild { child, killer })
    }
    #[cfg(unix)]
    {
        let child = cmd.spawn()?;
        let killer = TreeKiller {
            pid: child.id().map(|p| p as i32),
        };
        Ok(TreeChild { child, killer })
    }
}

impl TreeChild {
    pub fn take_stdout(&mut self) -> Option<ChildStdout> {
        self.child.stdout.take()
    }

    pub fn take_stderr(&mut self) -> Option<ChildStderr> {
        self.child.stderr.take()
    }

    pub async fn wait(&mut self) -> io::Result<std::process::ExitStatus> {
        self.child.wait().await
    }

    /// 取得可克隆的树击杀柄（枢纽持柄，runner 持子进程）。
    pub fn killer(&self) -> TreeKiller {
        self.killer.clone()
    }
}

/// 供查询通路（§4.1）复用：隐藏控制台窗口（Windows），unix 无操作。
pub fn hide_window(cmd: &mut Command) {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let _ = cmd;
}

/// 逐行读取子进程输出：按 `\n` 切分、剥 `\r`、解码（UTF-8→GBK→lossy）、
/// 流结束时无换行的尾行同样上报。
pub async fn stream_lines<R: AsyncRead + Unpin>(reader: R, mut on_line: impl FnMut(String)) {
    let mut reader = BufReader::new(reader);
    let mut buf: Vec<u8> = Vec::new();
    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                while matches!(buf.last(), Some(b'\n') | Some(b'\r')) {
                    buf.pop();
                }
                on_line(decode::decode_line(&buf));
            }
        }
    }
}
