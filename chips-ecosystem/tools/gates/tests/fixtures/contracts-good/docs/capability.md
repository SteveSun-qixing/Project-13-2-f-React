# 能力契约规范（夹具）

## 六、权限映射（R19 全表）

### 6.2 内置能力与权限总表（R19，canonical）

| 能力 ID | 所需权限 ID |
|---|---|
| `file:read` | `filesystem:read` |
| `file:copy` | `filesystem:read` + `filesystem:write` |
| `window:setTitle` | `window:control` |
| `cli:task-get` | 无（空权限数组；按 owner 归属校验） |

本表的 4 项计数只统计 Bridge 内置能力。

---

**文档结束**
