PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, path TEXT NOT NULL,
  status TEXT DEFAULT '待写', owner TEXT, updated_at TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sid TEXT UNIQUE NOT NULL, title TEXT NOT NULL, scope TEXT,
  agent TEXT, status TEXT DEFAULT '派单中',
  findings_file TEXT, summary TEXT, started_at TEXT, finished_at TEXT
);
CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sid TEXT, section TEXT, severity TEXT, title TEXT NOT NULL,
  detail TEXT, evidence TEXT, location TEXT,
  status TEXT DEFAULT '待处置', created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS archive_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src TEXT NOT NULL, dst TEXT NOT NULL, reason TEXT,
  status TEXT DEFAULT '待执行', executed_at TEXT, note TEXT
);
INSERT OR IGNORE INTO sections (id,title,path,status) VALUES
 ('S00','梳理总览与结论','00-梳理总览与结论.md','待写'),
 ('S01','任务进度与波次梳理','01-任务进度与波次梳理.md','待写'),
 ('S02','代码质量实测报告','02-代码质量实测报告.md','待写'),
 ('S03','测试与门禁可信度审计','03-测试与门禁可信度审计.md','待写'),
 ('S04','文档与文件夹整理盘点与方案','04-文档与文件夹整理盘点与方案.md','待写'),
 ('S05','工单与挂账盘点','05-工单与挂账盘点.md','待写'),
 ('S06','已完成任务符合性核验','06-已完成任务符合性核验.md','待写'),
 ('S07','设计功能效果符合性核验','07-设计功能效果符合性核验.md','待写'),
 ('S08','数据库与台账一致性审计','08-数据库与台账一致性审计.md','新建'),
 ('S09','架构红线与禁止项合规审计','09-架构红线与禁止项合规审计.md','新建'),
 ('S10','执行治理与子智能体质量审计','10-执行治理与子智能体质量审计.md','新建'),
 ('S11','归档整理执行记录','11-归档整理执行记录.md','新建'),
 ('S12','风险与用户待裁项','12-风险与用户待裁项.md','新建');
