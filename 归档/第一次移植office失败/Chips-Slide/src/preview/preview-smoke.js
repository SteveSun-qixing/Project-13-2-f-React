#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const reportPath = path.resolve("reports/preview/app-preview-smoke.json");

function fail(message) {
  console.error(`[preview-smoke] ${message}`);
  process.exitCode = 1;
}

function assertReportCheck(checks, name) {
  const check = checks.find((entry) => entry.name === name);
  if (!check) {
    fail(`缺少检查项：${name}`);
    return;
  }
  if (check.status !== "passed") {
    fail(`检查项未通过：${name}（${check.status}）`);
  }
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (error) {
  fail(`无法读取预览报告：${error instanceof Error ? error.message : String(error)}`);
}

if (report) {
  if (report.kind !== "chipsdev.preview") {
    fail("报告 kind 不是 chipsdev.preview");
  }
  if (report.previewPlan?.mode !== "mock" || report.previewPlan?.target !== "app") {
    fail("预览计划必须使用 mock/app");
  }
  if (report.previewPlan?.reportOnly !== true) {
    fail("预览 smoke 当前必须保持报告级边界");
  }

  const checks = Array.isArray(report.checks) ? report.checks : [];
  for (const requiredCheck of [
    "project.config",
    "manifest",
    "manifest.runtimeTargets",
    "manifest.surface",
    "manifest.entryAsset",
    "host.mock",
  ]) {
    assertReportCheck(checks, requiredCheck);
  }

  if (report.summary?.status === "failed" || report.summary?.blockingCheckCount > 0) {
    fail("预览报告存在阻断检查");
  }
}
