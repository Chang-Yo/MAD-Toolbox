//! 调度决策（架构文档 §4.4）：单一有序队列，自顶向下扫描，池满则跳过。
//! 纯函数——枢纽循环只调用，不自带判断；容量以字面量注入，num_cpus 解析在外。

use super::types::Pool;

#[derive(Debug, Clone)]
pub struct QueuedView {
    pub id: String,
    pub pool: Pool,
}

#[derive(Debug, Clone, Copy)]
pub struct PoolCaps {
    pub download: usize,
    pub local: usize,
}

impl PoolCaps {
    pub fn cap(&self, pool: Pool) -> usize {
        match pool {
            Pool::Download => self.download,
            Pool::Local => self.local,
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct PoolUsage {
    pub download: usize,
    pub local: usize,
}

impl PoolUsage {
    pub fn get(&self, pool: Pool) -> usize {
        match pool {
            Pool::Download => self.download,
            Pool::Local => self.local,
        }
    }

    pub fn add(&mut self, pool: Pool) {
        match pool {
            Pool::Download => self.download += 1,
            Pool::Local => self.local += 1,
        }
    }
}

/// 池定义（暴露给前端一次性拉取，占用数由前端从任务事件推导——不新增实时同步接口，§8）。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PoolDefinition {
    pub pool: Pool,
    pub capacity: usize,
}

pub fn definitions(caps: PoolCaps) -> Vec<PoolDefinition> {
    vec![
        PoolDefinition {
            pool: Pool::Download,
            capacity: caps.download,
        },
        PoolDefinition {
            pool: Pool::Local,
            capacity: caps.local,
        },
    ]
}

/// 任一槽位空出时调用：从队首起，返回所有"所属池有空位"的任务（保持队列顺序）。
pub fn select_dispatch(queue: &[QueuedView], caps: PoolCaps, usage: PoolUsage) -> Vec<String> {
    let mut usage = usage;
    let mut picked = Vec::new();
    for item in queue {
        if usage.get(item.pool) < caps.cap(item.pool) {
            usage.add(item.pool);
            picked.push(item.id.clone());
        }
    }
    picked
}
