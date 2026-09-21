#!/usr/bin/env python3
"""迁移波三段生命周期通道（preflight/migrate-manifest/closure/set-status）单元测试。

W3-P1-3 波1 落地验收件（勘查稿 #137 第七节裁定：方案 C 四通道 + 归一化文法 + 两红线机检 + 镜像自检 + 回执即闸）。
纪律：
- 只测本目录 `重构台账.py` 的新增通道面；既有 16 通道回归走 --help/verify 双漂移闸，不在本文件范围；
- 一切会触库的判据用 /tmp 临时副本/合成库（sqlite SCHEMA 重建），绝不触碰真库 `重构大计划/重构台账.db`；
- 写通道（set-status）用例只打 /tmp 合成库，操作留痕 OP_LOG 重定向 /tmp；
- 运行：python3 -m unittest test_重构台账迁移通道 -v（或 python3 test_重构台账迁移通道.py）。
"""

import contextlib
import hashlib
import importlib.util
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location("lt_under_test", os.path.join(_HERE, "重构台账.py"))
lt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lt)

_REAL_02 = os.path.join(lt.BASE, "02-仓库映射与新工作区.md")


def _sha1(data):
    return hashlib.sha1(data).hexdigest()


def _mk_db(path):
    conn = lt.connect(write=True)
    try:
        conn.executescript(lt.SCHEMA)
        conn.commit()
    finally:
        conn.close()


def _exec(sql, params=()):
    conn = lt.connect(write=True)
    try:
        conn.execute(sql, params)
        conn.commit()
    finally:
        conn.close()


def _q(sql, params=()):
    conn = lt.connect()
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


class _SandboxMixin(unittest.TestCase):
    """把模块全局 DB/ROOT/BASE/NEW_WS/OP_LOG 重定向到 /tmp 沙箱，tearDown 全量还原。"""

    def setUp(self):
        self.saved = {k: getattr(lt, k) for k in ("DB", "ROOT", "BASE", "NEW_WS", "OP_LOG")}
        self.sb = tempfile.mkdtemp(prefix="w141_sb_")
        self.root = os.path.join(self.sb, "root")
        self.base = os.path.join(self.root, "重构大计划")
        self.ws = os.path.join(self.root, "chips-ecosystem")
        os.makedirs(self.base)
        os.makedirs(self.ws)
        shutil.copy(_REAL_02, os.path.join(self.base, "02-仓库映射与新工作区.md"))
        lt.ROOT = self.root
        lt.BASE = self.base
        lt.NEW_WS = self.ws
        lt.DB = os.path.join(self.base, "重构台账.db")
        lt.OP_LOG = os.path.join(self.sb, "op.log")
        _mk_db(lt.DB)

    def tearDown(self):
        for k, v in self.saved.items():
            setattr(lt, k, v)
        shutil.rmtree(self.sb, ignore_errors=True)

    def add_file(self, repo, rel, disp=None, target="", status="已裁决", owner="ledger-x", sha=""):
        _exec("INSERT INTO files(repo_id, rel_path, disposition, target_path, status, owner, sha1)"
              " VALUES(?,?,?,?,?,?,?)", (repo, rel, disp, target, status, owner, sha))
        return _q("SELECT id FROM files WHERE repo_id=? AND rel_path=?", (repo, rel))[0][0]

    def assert_exit(self, code, fn, *a):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as cm:
                fn(*a)
        self.assertEqual(cm.exception.code, code)

    def run_capture(self, fn, *a):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            fn(*a)  # 不应 SystemExit
        return out.getvalue()


class TestNormalizeGrammar(unittest.TestCase):
    """归一化文法（勘查稿 §3.1 通道①-3 / 裁定③）：锚点分离、前缀/括注/句读剥离、server 别名、通配归目录。"""

    def test_anchor_split(self):
        canon, anchor, kind = lt.normalize_target("chips-ecosystem/plugins/basecards/src/x.ts#Foo")
        self.assertEqual((canon, anchor, kind), ("chips-ecosystem/plugins/basecards/src/x.ts", "Foo", "path"))

    def test_plan_prefix_wave_and_paren_stripped(self):
        canon, _a, kind = lt.normalize_target("计划归属：chips-ecosystem/packages/host（W4 迁移波搬运）")
        self.assertEqual((canon, kind), ("chips-ecosystem/packages/host", "path"))
        canon, _a, kind = lt.normalize_target("W6 chips-ecosystem/plugins/apps/notes/src/a.tsx")
        self.assertEqual((canon, kind), ("chips-ecosystem/plugins/apps/notes/src/a.tsx", "path"))

    def test_server_alias_w6(self):
        canon, _a, kind = lt.normalize_target("server/community/src/main.rs")
        self.assertEqual((canon, kind), ("chips-ecosystem/server/community/src/main.rs", "path"))

    def test_glob_collapse_to_dir(self):
        canon, _a, kind = lt.normalize_target("chips-ecosystem/plugins/apps/*")
        self.assertEqual((canon, kind), ("chips-ecosystem/plugins/apps", "path"))

    def test_sentence_cut_on_punctuation(self):
        canon, _a, kind = lt.normalize_target("chips-ecosystem/packages/sdk/index.ts；按新接口重写导出面")
        self.assertEqual(canon, "chips-ecosystem/packages/sdk/index.ts")
        self.assertEqual(kind, "path")

    def test_virtual_writings(self):
        for raw in ("只读参考：旧版-产品设计库/xx.md", "不搬运", "就近归档"):
            _c, _a, kind = lt.normalize_target(raw)
            self.assertEqual(kind, "virtual", raw)

    def test_empty(self):
        self.assertEqual(lt.normalize_target(""), ("", "", "empty"))
        self.assertEqual(lt.normalize_target(None), ("", "", "empty"))

    def test_unparsed_pure_paren_note(self):
        canon, anchor, kind = lt.normalize_target("（仅W5备注，无落点）")
        self.assertEqual((canon, anchor, kind), ("", "", "unparsed"))


class TestCredentialPatterns(unittest.TestCase):
    """凭据红线模式集（勘查稿 §3.3①）：basename 命中面与显式排除面。"""

    def test_hits(self):
        for p in (".env", "cfg/prod/.env", "keys/server.pem", "tls/private.key",
                  "id_rsa", "deploy/id_rsa.bak", "secrets.prod.json"):
            self.assertTrue(lt.is_credential_path(p), p)

    def test_exclusions(self):
        for p in (".env.example", "cfg/.env.example", ".envrc", "src/main.ts", "vault.secrets.json"):
            self.assertFalse(lt.is_credential_path(p), p)

    def test_map_self_check_green_on_real_02(self):
        """裁定③镜像自检：常量↔02 表在权威事实源上必须零分叉（腐化即在 CI 变红）。"""
        self.assertEqual(lt.map_prefixes_self_check(_REAL_02), [])

    def test_map_self_check_fork_red(self):
        """两处分叉即红：改 02 副本的前缀/删一行，自检必须各自报 REPO-MAP-DRIFT。"""
        with open(_REAL_02, "r", encoding="utf-8") as f:
            text = f.read()
        sb = tempfile.mkdtemp(prefix="w141_02_")
        try:
            fork = os.path.join(sb, "02-fork.md")
            with open(fork, "w", encoding="utf-8") as f:
                f.write(text.replace("`packages/ui`", "`packages/uix`"))
            issues = lt.map_prefixes_self_check(fork)
            self.assertTrue(any("REPO-MAP-DRIFT" in i and "Chips-Ui" in i for i in issues), issues)
            drop = "\n".join(l for l in text.splitlines() if "PersonalServer" not in l)
            fork2 = os.path.join(sb, "02-drop.md")
            with open(fork2, "w", encoding="utf-8") as f:
                f.write(drop)
            issues2 = lt.map_prefixes_self_check(fork2)
            self.assertTrue(any("Chips-PersonalServer" in i for i in issues2), issues2)
        finally:
            shutil.rmtree(sb, ignore_errors=True)


class TestPreflight(_SandboxMixin):

    def _receipt(self, repos, name):
        rp = os.path.join(self.sb, name)
        ns = argparse_ns(repo=repos, json=True, receipt=rp)
        out = io.StringIO()
        code = 0
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            try:
                lt.preflight(ns)
            except SystemExit as e:
                code = e.code
        with open(rp, "r", encoding="utf-8") as f:
            data = json.load(f)
        return code, data

    def test_green_repo_zero_red_with_receipt(self):
        """双零成立 + 快照一致 + 映射一致 + 凭据废弃命中 → 0 红、CRED-ROTATION 签收位在回执。"""
        repo = "Chips-Notes"
        os.makedirs(os.path.join(self.root, repo, "src"))
        body = b"export const a = 1;"
        with open(os.path.join(self.root, repo, "src", "a.ts"), "wb") as f:
            f.write(body)
        self.add_file(repo, "src/a.ts", "迁移", "chips-ecosystem/plugins/apps/notes/src/a.ts", sha=_sha1(body))
        self.add_file(repo, "prod/.env", "废弃", "")
        code, data = self._receipt([repo], "r1.json")
        self.assertEqual(code, 0, data["issues"])
        self.assertEqual(data["red"], 0)
        self.assertEqual([i["code"] for i in data["cred_rotation_ack"]], ["CRED-ROTATION"])
        self.assertTrue(data["cred_rotation_ack"][0]["requires_ack"])
        self.assertEqual(data["checks"]["map_self_check"], "绿")

    def test_reds_pending_empty_target_drift_mismatch(self):
        repo = "Chips-Notes"
        os.makedirs(os.path.join(self.root, repo, "src"))
        with open(os.path.join(self.root, repo, "src", "b.ts"), "wb") as f:
            f.write(b"new-content")
        self.add_file(repo, "src/b.ts", "迁移", "chips-ecosystem/plugins/apps/notes/src/b.ts", sha=_sha1(b"old"))
        self.add_file(repo, "src/c.ts", "迁移", "", status="待评估")
        self.add_file(repo, "src/d.ts", "重写", "chips-ecosystem/packages/host/src/d.ts")
        code, data = self._receipt([repo], "r2.json")
        self.assertEqual(code, lt.EXIT_VERIFY)
        codes = {i["code"] for i in data["issues"]}
        self.assertIn("PENDING-NOT-ZERO", codes)   # 待评估非零
        self.assertIn("EXPAND-EMPTY-TARGET", codes)  # 空 target
        self.assertIn("SNAPSHOT-DRIFT", codes)     # 源仓违规改动
        self.assertIn("MAP-MISMATCH", codes)       # 落点跨仓（notes 仓指到 host）

    def test_unregistered_repo_maps_to_warn_not_red(self):
        repo = "Chips-LegacyOnly"
        os.makedirs(os.path.join(self.root, repo))
        self.add_file(repo, "x.ts", "迁移", "chips-ecosystem/whatever/x.ts")
        code, data = self._receipt([repo], "r3.json")
        self.assertEqual(code, 0, data["issues"])
        wcodes = {i["code"] for i in data["warnings"]}
        self.assertIn("MAP-UNREGISTERED", wcodes)
        self.assertTrue(wcodes <= {"MAP-UNREGISTERED", "NEVER-INGEST-IGNORE", "NEVER-INGEST-GIT",
                                   "SNAPSHOT-DEL"}, wcodes)

    def test_unparsed_listed_not_red(self):
        repo = "Chips-Notes"
        os.makedirs(os.path.join(self.root, repo))
        self.add_file(repo, "u.ts", "重写", "（仅备注）")
        code, data = self._receipt([repo], "r4.json")
        self.assertEqual(code, 0)
        self.assertEqual(len(data["unparsed"]), 1)

    def test_credential_violation_red(self):
        repo = "Chips-Notes"
        os.makedirs(os.path.join(self.root, repo))
        self.add_file(repo, "deploy/.env", "迁移", "chips-ecosystem/plugins/apps/notes/deploy/.env")
        code, data = self._receipt([repo], "r5.json")
        self.assertEqual(code, lt.EXIT_VERIFY)
        self.assertIn("CRED-LEDGER", {i["code"] for i in data["issues"]})

    def test_never_ingest_repo_refused(self):
        for d in lt.NEVER_INGEST_DIRS:
            self.assert_exit(lt.EXIT_NOOP, lt.preflight,
                             argparse_ns(repo=[d], json=False, receipt=""))


class TestMigrateManifest(_SandboxMixin):

    def test_export_counts_and_conflicts(self):
        repo = "Chips-BoxLayoutPlugin"
        t1 = "chips-ecosystem/plugins/layouts/src/box.ts"
        fid1 = self.add_file(repo, "src/box.ts", "迁移", t1 + "#BoxLayout")
        self.add_file(repo, "src/box2.ts", "重写", t1)
        _exec("INSERT INTO symbols(file_id, kind, name, line, exported, status, disposition, target)"
              " VALUES(?,'fn','BoxLayout',3,1,'已裁决','迁移',?)", (fid1, t1 + "#BoxLayout"))
        out = os.path.join(self.sb, "mf")
        os.makedirs(os.path.join(self.ws, "plugins"))  # 目标区存在但 box.ts 不存在 → 无 DEST-COLLIDE
        self.run_capture(lt.migrate_manifest,
                         argparse_ns(repo=repo, class_="expand", out=out, check_dest=True))
        tsv = os.path.join(out, "manifest-%s.tsv" % repo)
        with open(tsv, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
        self.assertIn("rows=2", lines[0])            # 行数=DB 命中自检行
        self.assertEqual(len(lines), 4)              # 头 + 列名 + 2 数据行
        jpath = os.path.join(out, "manifest-%s.json" % repo)
        with open(jpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertTrue(data["db_count_matches"])
        self.assertEqual(data["anchor_total"], 1)    # 符号 #锚点计数
        self.assertEqual(data["row_count"], 2)
        zones = os.listdir(os.path.join(out, "by-zone"))
        self.assertTrue(any(z.startswith("zone-chips-ecosystem_plugins_layouts") for z in zones), zones)
        self.assertTrue(any("MULTI-SOURCE" in i for i in data["check_dest"]["issues"]),
                        data["check_dest"])

    def test_never_ingest_repo_refused(self):
        for d in lt.NEVER_INGEST_DIRS:
            self.assert_exit(lt.EXIT_NOOP, lt.migrate_manifest,
                             argparse_ns(repo=d, class_="expand", out=None, check_dest=False))


class TestClosure(_SandboxMixin):

    def _closure(self, strict, repos=None, matrix=None):
        ns = argparse_ns(repo=repos, matrix=matrix, json=True, strict=strict)
        out = io.StringIO()
        code = 0
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            try:
                lt.closure(ns)
            except SystemExit as e:
                code = e.code
        payload = out.getvalue().strip()
        data = json.loads(payload) if payload.startswith("{") else None
        return code, data

    def _matrix_md(self, rows):
        mp = os.path.join(self.sb, "旧功能覆盖矩阵-fake.md")
        body = ["## 一、裁决计数总览", "| 仓库 | 废弃 | 重写 | 迁移 | 保留设计 | 归档 | 合计 |",
                "| --- | --- | --- | --- | --- | --- | --- |"]
        body += ["| %s | %d | %d | %d | %d | %d | %d |" % r for r in rows]
        with open(mp, "w", encoding="utf-8") as f:
            f.write("\n".join(body) + "\n")
        return "%s" % mp

    def test_landing_and_strict_status(self):
        repo = "Chips-Notes"
        ct = "chips-ecosystem/plugins/apps/notes/src/a.ts"
        os.makedirs(os.path.join(self.ws, "plugins/apps/notes/src"))
        with open(os.path.join(self.ws, ct.replace("chips-ecosystem/", "")), "w") as f:
            f.write("x")
        self.add_file(repo, "src/a.ts", "迁移", ct, status="已完成")
        self.add_file(repo, "src/b.ts", "重写", "chips-ecosystem/plugins/apps/notes/src/b.ts", status="进行中")
        matrix = self._matrix_md([(repo, 0, 1, 1, 0, 0, 2)])
        code, data = self._closure(strict=False, matrix=matrix)
        self.assertEqual(code, 0)  # 非 strict：落点未实落/未到已验证只 WARN
        self.assertEqual(data["landing"]["landed"], 1)
        self.assertEqual(data["landing"]["planned_missing"], 1)
        code, data = self._closure(strict=True, matrix=matrix)
        self.assertEqual(code, lt.EXIT_VERIFY)
        codes = {i["code"] for i in data["issues"]}
        self.assertIn("LANDING-MISSING", codes)
        self.assertIn("STATUS-NOT-VERIFIED", codes)

    def test_rewrite_named_task_exempt(self):
        repo = "Chips-Notes"
        self.add_file(repo, "src/e.ts", "重写",
                      "chips-ecosystem/plugins/apps/notes/src/e.ts（点名任务 task-w5 生成）", status="已验证")
        code, data = self._closure(strict=True, matrix=self._matrix_md([]))
        self.assertEqual(data["landing"]["exempt"], 1)
        self.assertNotIn("LANDING-MISSING", {i["code"] for i in data["issues"]})

    def test_matrix_count_mismatch_red(self):
        repo = "Chips-Notes"
        self.add_file(repo, "src/a.ts", "迁移", "chips-ecosystem/plugins/apps/notes/src/a.ts")
        matrix = self._matrix_md([(repo, 0, 0, 9, 0, 0, 9)])  # 声明迁移 9 ≠ DB 1
        code, data = self._closure(strict=False, matrix=matrix)
        self.assertEqual(code, lt.EXIT_VERIFY)
        self.assertIn("MATRIX-COUNT", {i["code"] for i in data["issues"]})

    def test_residual_scan_red(self):
        repo = "Chips-Notes"
        self.add_file(repo, "src/a.ts", "废弃")
        os.makedirs(os.path.join(self.ws, "packages"))
        os.makedirs(os.path.join(self.ws, "weird-dir"), exist_ok=True)
        with open(os.path.join(self.ws, "packages", ".env"), "w") as f:
            f.write("SECRET=1")
        # 契约 §3.1(c)(ii)：repo_id/rel_path 同名尾部命中即红；裸 rel_path 相等（新仓自有的通用根文件）不算。
        dup_dir = os.path.join(self.ws, "packages", "legacy", "Chips-Notes", "src")
        os.makedirs(dup_dir)
        with open(os.path.join(dup_dir, "a.ts"), "w") as f:
            f.write("stale")
        own_dir = os.path.join(self.ws, "packages", "own", "src")
        os.makedirs(own_dir)
        with open(os.path.join(own_dir, "a.ts"), "w") as f:
            f.write("legit new-workspace file sharing bare rel name")
        code, data = self._closure(strict=False, matrix=self._matrix_md([]))
        codes = {i["code"] for i in data["issues"]}
        self.assertIn("RESIDUAL-CRED", codes)
        self.assertIn("RESIDUAL-TOPDIR", codes)
        self.assertIn("RESIDUAL-DUP", codes)
        dups = [i for i in data["issues"] if i["code"] == "RESIDUAL-DUP"]
        self.assertEqual(len(dups), 1)  # 只点同名尾部正例，不带 repo 尾的裸同名不误报
        self.assertIn("Chips-Notes/src/a.ts", dups[0]["detail"])
        self.assertEqual(code, lt.EXIT_VERIFY)

    def test_matrix_second_table_not_merged(self):
        """§一 含文件级+符号级双表（服务端两仓形态）：只勾稽首表，符号表数字不得串表计红。"""
        repo = "Chips-Notes"
        self.add_file(repo, "src/a.ts", "迁移", "chips-ecosystem/plugins/apps/notes/src/a.ts")
        mp = os.path.join(self.sb, "旧功能覆盖矩阵-two.md")
        with open(mp, "w", encoding="utf-8") as f:
            f.write("## 一、真实计数\n\n### 文件级裁决\n\n")
            f.write("| 仓库 | 迁移 | 重写 | 保留设计 | 废弃 | 归档 | 合计 |\n")
            f.write("|---|---|---|---|---|---|---|\n")
            f.write("| %s | 1 | 0 | 0 | 0 | 0 | 1 |\n\n" % repo)
            f.write("### 符号级裁决\n\n| 仓库 | 符号已裁决 | 其中迁移 | 其中重写 | 残余 |\n")
            f.write("|---|---|---|---|---|\n")
            f.write("| %s | 344 | 327 | 17 | 0 |\n" % repo)
        code, data = self._closure(strict=False, matrix=mp)
        self.assertEqual(code, 0, data["issues"])  # 327/17 若串表会假红
        self.assertEqual({i for i in data["issues"] if i["code"] == "MATRIX-COUNT"}, set())


class TestSetStatus(_SandboxMixin):
    """set-status 唯一最小写通道：写用例只打沙箱合成库；正/反例；越权整批拒绝必须红且零写入。"""

    def _idfile(self, ids):
        p = os.path.join(self.sb, "ids.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write("".join("%d\n" % i for i in ids))
        return p

    def _seed(self):
        a = self.add_file("Chips-Notes", "src/a.ts", "迁移",
                          "chips-ecosystem/plugins/apps/notes/src/a.ts", owner="exec-a")
        b = self.add_file("Chips-Notes", "src/b.ts", "迁移",
                          "chips-ecosystem/plugins/apps/notes/src/b.ts", owner="exec-a")
        c = self.add_file("Chips-Notes", "src/c.ts", "迁移",
                          "chips-ecosystem/plugins/apps/notes/src/c.ts", owner="exec-b")
        return a, b, c

    def test_positive_writes_status_notes_only(self):
        a, b, c = self._seed()
        before = _q("SELECT disposition, target_path FROM files WHERE id=?", (a,))[0]
        self.run_capture(lt.set_status, argparse_ns(
            owner="exec-a", id_file=self._idfile([a, b]), status="已验证", evidence="包级测试通过"))
        rows = {r[0]: r for r in _q("SELECT id, status, notes, disposition, target_path FROM files")}
        self.assertEqual(rows[a][1], "已验证")
        self.assertIn("执行回写 已验证：包级测试通过", rows[a][2])
        self.assertEqual((rows[a][3], rows[a][4]), before)  # disposition/target 零触碰
        self.assertEqual(rows[c][1], "已裁决")              # 他人行不动
        with open(lt.OP_LOG, "r", encoding="utf-8") as f:
            self.assertIn("cmd=set-status", f.read())

    def test_notes_append_preserves_history(self):
        a, _b, _c = self._seed()
        _exec("UPDATE files SET notes=? WHERE id=?", ("原裁决理由", a))
        self.run_capture(lt.set_status, argparse_ns(
            owner="exec-a", id_file=self._idfile([a]), status="已完成", evidence=""))
        notes = _q("SELECT notes FROM files WHERE id=?", (a,))[0][0]
        self.assertEqual(notes, "原裁决理由；执行回写 已完成")

    def test_mixed_batch_rejected_wholly(self):
        a, _b, c = self._seed()
        self.assert_exit(lt.EXIT_NOOP, lt.set_status, argparse_ns(
            owner="exec-a", id_file=self._idfile([a, c]), status="已验证", evidence=""))
        rows = {r[0]: r for r in _q("SELECT id, status, notes FROM files")}
        self.assertEqual((rows[a][1], rows[a][2]), ("已裁决", None))  # 本主行也零写入（整批拒绝）
        self.assertEqual((rows[c][1], rows[c][2]), ("已裁决", None))

    def test_all_foreign_rejected(self):
        _a, _b, c = self._seed()
        self.assert_exit(lt.EXIT_NOOP, lt.set_status, argparse_ns(
            owner="exec-z", id_file=self._idfile([c]), status="进行中", evidence=""))

    def test_missing_ids_noop(self):
        self.assert_exit(lt.EXIT_NOOP, lt.set_status, argparse_ns(
            owner="exec-a", id_file=self._idfile([9991, 9992]), status="进行中", evidence=""))

    def test_empty_owner_refused(self):
        a, _b, _c = self._seed()
        self.assert_exit(lt.EXIT_NOOP, lt.set_status, argparse_ns(
            owner="  ", id_file=self._idfile([a]), status="进行中", evidence=""))

    def test_illegal_status_refused(self):
        a, _b, _c = self._seed()
        self.assert_exit(lt.EXIT_NOOP, lt.set_status, argparse_ns(
            owner="exec-a", id_file=self._idfile([a]), status="已裁决", evidence=""))


def argparse_ns(**kw):
    """轻量 Namespace（对齐 argparse 属性访问）。"""
    class _NS:
        pass
    ns = _NS()
    for k, v in kw.items():
        setattr(ns, k, v)
    return ns


if __name__ == "__main__":
    unittest.main(verbosity=2)
