import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(fileURLToPath(import.meta.url), "..", "..", "..");

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("薯片办公工程契约基线", () => {
  const manifest = readProjectFile("manifest.yaml");
  const packageJson = JSON.parse(readProjectFile("package.json")) as Record<string, unknown>;

  it("manifest 身份与入口正确", () => {
    expect(manifest).toContain("id: com.chips.office");
    expect(manifest).toContain("name: 薯片办公");
    expect(manifest).toContain("type: app");
    expect(manifest).toContain("entry: dist/index.html");
  });

  it("manifest 声明专用 primary 层级能力（区别于万能查看器 fallback）", () => {
    const capabilityLines = manifest
      .split("\n")
      .filter((line) => line.trim().startsWith("- resource-handler:") || line.trim().startsWith("- file-handler:"));
    expect(capabilityLines.length).toBeGreaterThanOrEqual(10);
    for (const line of capabilityLines) {
      expect(line.includes("@fallback")).toBe(false);
    }
    expect(manifest).toContain("resource-handler:edit:application/pdf");
    expect(manifest).toContain("resource-handler:edit:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(manifest).toContain("resource-handler:view:application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(manifest).toContain("file-handler:.docx");
    expect(manifest).toContain("file-handler:.csv");
  });

  it("manifest 权限覆盖万能文件链路与办公引擎链路", () => {
    for (const permission of ["resource.read", "file.read", "file.write", "platform.read", "office.read", "office.write", "command.read", "command.write", "command.invoke"]) {
      expect(manifest).toContain(`- ${permission}`);
    }
  });

  it("package.json 使用 GenOffice 原版技术栈版本", () => {
    const deps = packageJson.dependencies as Record<string, string>;
    expect(deps["react"]).toBe("^19.2.4");
    expect(deps["antd"]).toBe("6.5.4");
    expect(deps["@chips/ui"]).toBe("0.1.0");
    expect(deps["@univerjs/preset-sheets-core"]).toBe("^0.25.1");
    expect(deps["@tiptap/core"]).toBe("^3.28.0");
    expect(deps["konva"]).toBe("^9.3.20");
    expect(deps["pdfjs-dist"]).toBe("^6.2.108");
    expect(deps["pdf-lib"]).toBe("^1.17.1");
  });

  it("移植代码不残留 AI 命名空间导入", () => {
    const output = execSync(
      "grep -rl '@genoffice/ai-provider\\|@genoffice/agent-core\\|@genoffice/ai-search' src vendor --include='*.ts' --include='*.tsx' || true",
      { cwd: projectRoot, encoding: "utf8" },
    );
    expect(output.trim()).toBe("");
  });

  it("index.html 携带插件身份与 CSP", () => {
    const html = readProjectFile("index.html");
    expect(html).toContain('data-chips-app="com.chips.office"');
    expect(html).toContain("Content-Security-Policy");
  });
});
