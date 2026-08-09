import fs from "node:fs";
import path from "node:path";

export function writeStampedReport(reportDir, prefix, report) {
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const reportPath = path.join(reportDir, `${prefix}-${stamp}.json`);
  const latestPath = path.join(reportDir, `${prefix}-latest.json`);

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));

  return {
    reportPath,
    latestPath
  };
}
