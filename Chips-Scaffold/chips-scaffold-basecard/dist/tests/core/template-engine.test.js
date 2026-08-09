"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_os_1 = __importDefault(require("node:os"));
const path = __importStar(require("node:path"));
const node_fs_1 = require("node:fs");
const template_engine_1 = require("../../src/core/template-engine");
const FORBIDDEN_PROJECT_DIRS = [
    "需求文档",
    "技术文档",
    "技术手册",
    "开发计划",
];
async function removeDirIfExists(dir) {
    try {
        await node_fs_1.promises.rm(dir, { recursive: true, force: true });
    }
    catch {
        // 忽略清理错误
    }
}
(0, vitest_1.describe)("template-engine", () => {
    (0, vitest_1.it)("lists available templates", async () => {
        const templates = await (0, template_engine_1.listAvailableTemplates)();
        const ids = templates.map((t) => t.id);
        (0, vitest_1.expect)(ids).toContain("card-standard");
    });
    (0, vitest_1.it)("renders card-standard template to target directory", async () => {
        const tempRoot = await node_fs_1.promises.mkdtemp(path.join(node_os_1.default.tmpdir(), "chips-basecard-scaffold-test-"));
        const targetDir = path.join(tempRoot, "card-standard-project");
        try {
            const options = {
                projectName: "card-standard-project",
                targetDir,
                templateId: "card-standard",
                pluginId: "com.example.card-standard",
                cardType: "base.text",
                displayName: "Standard Basecard Plugin",
                version: "0.1.0",
                authorName: "Scaffold",
                authorEmail: "dev@example.com",
            };
            const result = await (0, template_engine_1.renderTemplateToTarget)(options);
            (0, vitest_1.expect)(result.projectDir).toBe(targetDir);
            (0, vitest_1.expect)(result.templateId).toBe("card-standard");
            (0, vitest_1.expect)(result.filesCreated).toBeGreaterThan(0);
            const manifest = await node_fs_1.promises.readFile(path.join(targetDir, "manifest.yaml"), "utf8");
            const pkg = JSON.parse(await node_fs_1.promises.readFile(path.join(targetDir, "package.json"), "utf8"));
            (0, vitest_1.expect)(manifest).toMatch(/type:\s+card/);
            (0, vitest_1.expect)(manifest).toMatch(/runtime:\n  targets:\n    desktop:\n      supported:\s+true/);
            (0, vitest_1.expect)(manifest).toMatch(/web:\n      supported:\s+false/);
            (0, vitest_1.expect)(manifest).toMatch(/mobile:\n      supported:\s+false/);
            (0, vitest_1.expect)(manifest).toMatch(/headless:\n      supported:\s+true/);
            (0, vitest_1.expect)(manifest).toMatch(/capabilities:\n  cardTypes:\n    - base\.text/);
            (0, vitest_1.expect)(manifest).not.toMatch(/chips-scaffold-basecard/);
            (0, vitest_1.expect)(manifest).not.toMatch(/ui:\s*\n\s*surface:/);
            (0, vitest_1.expect)(manifest).not.toMatch(/theme\.read|i18n\.read/);
            await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, ".eslintrc.cjs"))).resolves.toBeTruthy();
            await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, "vitest.config.mts"))).resolves.toBeTruthy();
            await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, "src", "lib", "messages.ts"))).resolves.toBeTruthy();
            await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, "tests", "unit", "schema.test.ts"))).resolves.toBeTruthy();
            await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, "src", "shared", "i18n.ts"))).rejects.toMatchObject({
                code: "ENOENT",
            });
            await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, "i18n", "zh-CN.json"))).rejects.toMatchObject({
                code: "ENOENT",
            });
            await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, "i18n", "en-US.json"))).rejects.toMatchObject({
                code: "ENOENT",
            });
            (0, vitest_1.expect)(pkg.dependencies.react).toBe("^18.2.0");
            (0, vitest_1.expect)(pkg.dependencies["react-dom"]).toBe("^18.2.0");
            (0, vitest_1.expect)(pkg.dependencies["@chips/component-library"]).toBeUndefined();
            (0, vitest_1.expect)(pkg.dependencies.antd).toBe("6.5.4");
            (0, vitest_1.expect)(pkg.dependencies["@ant-design/icons"]).toBe("6.3.2");
            (0, vitest_1.expect)(pkg.dependencies.dayjs).toBe("1.11.21");
            (0, vitest_1.expect)(pkg.dependencies["@chips/ui"]).toBe("0.1.0");
            (0, vitest_1.expect)(pkg.devDependencies["@types/react"]).toBe("^18.2.66");
            (0, vitest_1.expect)(pkg.devDependencies.eslint).toBe("^8.57.1");
            (0, vitest_1.expect)(pkg.devDependencies["@typescript-eslint/parser"]).toBe("^7.18.0");
            (0, vitest_1.expect)(pkg.devDependencies["chips-sdk"]).toBe("^0.1.0");
            for (const scriptName of [
                "lint",
                "typecheck",
                "test",
                "build",
                "validate",
                "package",
                "verify",
            ]) {
                (0, vitest_1.expect)(typeof pkg.scripts[scriptName]).toBe("string");
            }
            for (const command of [
                "npm run lint",
                "npm run typecheck",
                "npm test",
                "npm run build",
                "npm run validate",
                "npm run package",
            ]) {
                (0, vitest_1.expect)(pkg.scripts.verify).toContain(command);
            }
            const readme = await node_fs_1.promises.readFile(path.join(targetDir, "README.md"), "utf8");
            const chipsConfig = await node_fs_1.promises.readFile(path.join(targetDir, "chips.config.mjs"), "utf8");
            const vitestConfig = await node_fs_1.promises.readFile(path.join(targetDir, "vitest.config.mts"), "utf8");
            const indexTs = await node_fs_1.promises.readFile(path.join(targetDir, "src", "index.ts"), "utf8");
            (0, vitest_1.expect)(readme).toMatch(/Standard Basecard Plugin/);
            (0, vitest_1.expect)(readme).toMatch(/basecardDefinition/);
            (0, vitest_1.expect)(readme).toMatch(/@chips\/ui/);
            (0, vitest_1.expect)(readme).toMatch(/\bantd\b/);
            (0, vitest_1.expect)(readme).not.toMatch(/@chips\/component-library/);
            (0, vitest_1.expect)(readme).not.toMatch(/chips-scaffold-basecard/);
            (0, vitest_1.expect)(readme).not.toMatch(/\bchips dev\b/);
            (0, vitest_1.expect)(chipsConfig).toMatch(/chipsdev/);
            (0, vitest_1.expect)(chipsConfig).not.toMatch(/\bchips dev\b|最小可用结构/);
            (0, vitest_1.expect)(vitestConfig).toMatch(/react\/jsx-runtime/);
            (0, vitest_1.expect)(vitestConfig).toMatch(/react-dom\/client/);
            (0, vitest_1.expect)(vitestConfig).toMatch(/dedupe:\s*\["react", "react-dom"\]/);
            (0, vitest_1.expect)(vitestConfig).toMatch(/setupFiles:\s*\["tests\/setup\.ts"\]/);
            (0, vitest_1.expect)(indexTs).toMatch(/export const basecardDefinition/);
            (0, vitest_1.expect)(indexTs).toMatch(/export function renderBasecardView/);
            (0, vitest_1.expect)(indexTs).toMatch(/export function renderBasecardEditor/);
            (0, vitest_1.expect)(indexTs).toMatch(/cardType:\s*"base\.text"/);
            (0, vitest_1.expect)(indexTs).toMatch(/pluginId:\s*"com\.example\.card-standard"/);
            (0, vitest_1.expect)(indexTs).toMatch(/openResource\?:/);
            (0, vitest_1.expect)(indexTs).toMatch(/importArchiveBundle\?:/);
            (0, vitest_1.expect)(indexTs).toMatch(/convertTiffToPng\?:/);
            (0, vitest_1.expect)(indexTs).toMatch(/collectResourcePaths/);
            (0, vitest_1.expect)(indexTs).toMatch(/previewPointerEvents:\s*"native"/);
            (0, vitest_1.expect)(indexTs).not.toMatch(/window\.chips|from\s+["']node:fs["']|from\s+["']fs["']/);
            await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, "template.json"))).rejects.toMatchObject({
                code: "ENOENT",
            });
            const renderView = await node_fs_1.promises.readFile(path.join(targetDir, "src", "render", "view.tsx"), "utf8");
            (0, vitest_1.expect)(renderView).not.toMatch(/@chips\/component-library/);
            (0, vitest_1.expect)(renderView).toMatch(/resolveResourceUrl/);
            (0, vitest_1.expect)(renderView).toMatch(/releaseResourceUrl/);
            (0, vitest_1.expect)(renderView).toMatch(/openResource/);
            (0, vitest_1.expect)(renderView).toMatch(/formatMessage/);
            (0, vitest_1.expect)(renderView).toMatch(/Typography/);
            (0, vitest_1.expect)(renderView).not.toMatch(/chips-basecard__surface/);
            (0, vitest_1.expect)(renderView).not.toMatch(/box-shadow/);
            (0, vitest_1.expect)(renderView).not.toMatch(/radial-gradient/);
            (0, vitest_1.expect)(renderView).not.toMatch(/>[^<{]*[\u4e00-\u9fff][^<{]*</);
            const editorPanel = await node_fs_1.promises.readFile(path.join(targetDir, "src", "editor", "panel.tsx"), "utf8");
            (0, vitest_1.expect)(editorPanel).not.toMatch(/ChipsForm|ChipsTextField|ChipsTextArea|ChipsErrorState|ChipsBox|ChipsStack|ChipsButton|ChipsText/);
            (0, vitest_1.expect)(editorPanel).not.toMatch(/@chips\/component-library/);
            (0, vitest_1.expect)(editorPanel).toMatch(/ConfigProvider/);
            (0, vitest_1.expect)(editorPanel).toMatch(/appleTheme/);
            (0, vitest_1.expect)(editorPanel).toMatch(/antd\/locale\/zh_CN/);
            (0, vitest_1.expect)(editorPanel).toMatch(/<Input/);
            (0, vitest_1.expect)(editorPanel).toMatch(/Input\.TextArea/);
            (0, vitest_1.expect)(editorPanel).toMatch(/Button/);
            (0, vitest_1.expect)(editorPanel).toMatch(/formatMessage/);
            (0, vitest_1.expect)(editorPanel).toMatch(/importResource/);
            (0, vitest_1.expect)(editorPanel).toMatch(/deleteResource/);
            (0, vitest_1.expect)(editorPanel).toMatch(/resource_path/);
            (0, vitest_1.expect)(editorPanel).not.toMatch(/<input/);
            (0, vitest_1.expect)(editorPanel).not.toMatch(/<textarea/);
            (0, vitest_1.expect)(editorPanel).not.toMatch(/box-shadow/);
            (0, vitest_1.expect)(editorPanel).not.toMatch(/radial-gradient/);
            (0, vitest_1.expect)(editorPanel).not.toMatch(/>[^<{]*[\u4e00-\u9fff][^<{]*</);
            const messagesTs = await node_fs_1.promises.readFile(path.join(targetDir, "src", "lib", "messages.ts"), "utf8");
            (0, vitest_1.expect)(messagesTs).toMatch(/export function formatMessage/);
            (0, vitest_1.expect)(messagesTs).toMatch(/basecard\.field\.title\.label/);
            (0, vitest_1.expect)(messagesTs).toMatch(/basecard\.view\.ariaLabel/);
            const schemaTs = await node_fs_1.promises.readFile(path.join(targetDir, "src", "schema", "card-config.ts"), "utf8");
            (0, vitest_1.expect)(schemaTs).toMatch(/resource_path\?:\s*string/);
            (0, vitest_1.expect)(schemaTs).toMatch(/isCardRootResourcePath/);
            (0, vitest_1.expect)(schemaTs).toMatch(/collectBasecardResourcePaths/);
            const defaultConfig = await node_fs_1.promises.readFile(path.join(targetDir, "templates", "default-card-config.yaml"), "utf8");
            (0, vitest_1.expect)(defaultConfig).toMatch(/resource_path:\s*""/);
            const parameters = await node_fs_1.promises.readFile(path.join(targetDir, "templates", "parameters.md"), "utf8");
            (0, vitest_1.expect)(parameters).toMatch(/resource_path/);
            const renderViewTest = await node_fs_1.promises.readFile(path.join(targetDir, "tests", "unit", "render-view.test.tsx"), "utf8");
            const editorPanelTest = await node_fs_1.promises.readFile(path.join(targetDir, "tests", "unit", "editor-panel.test.tsx"), "utf8");
            const integrationTest = await node_fs_1.promises.readFile(path.join(targetDir, "tests", "integration", "card-flow.test.ts"), "utf8");
            (0, vitest_1.expect)(renderViewTest).toMatch(/resolveResourceUrl/);
            (0, vitest_1.expect)(renderViewTest).toMatch(/releaseResourceUrl/);
            (0, vitest_1.expect)(renderViewTest).toMatch(/openResource/);
            (0, vitest_1.expect)(editorPanelTest).toMatch(/importResource/);
            (0, vitest_1.expect)(editorPanelTest).toMatch(/deleteResource/);
            (0, vitest_1.expect)(editorPanelTest).toMatch(/data-chips-basecard-field="title"/);
            (0, vitest_1.expect)(integrationTest).toMatch(/cleans editor container styles after unmount/);
            const generatedTextFiles = [
                "manifest.yaml",
                "README.md",
                "chips.config.mjs",
                path.join("src", "index.ts"),
                path.join("src", "render", "view.tsx"),
                path.join("src", "editor", "panel.tsx"),
                path.join("templates", "parameters.md"),
            ];
            for (const relativePath of generatedTextFiles) {
                const source = await node_fs_1.promises.readFile(path.join(targetDir, relativePath), "utf8");
                (0, vitest_1.expect)(source).not.toMatch(/\{\{\s*[A-Z0-9_]+\s*\}\}/);
                (0, vitest_1.expect)(source).not.toMatch(/\bchips dev\b/);
                (0, vitest_1.expect)(source).not.toMatch(/chips-scaffold-basecard/);
                (0, vitest_1.expect)(source).not.toMatch(/\bTODO\b|\bFIXME\b/i);
            }
            for (const dirName of FORBIDDEN_PROJECT_DIRS) {
                await (0, vitest_1.expect)(node_fs_1.promises.stat(path.join(targetDir, dirName))).rejects.toMatchObject({
                    code: "ENOENT",
                });
            }
        }
        finally {
            await removeDirIfExists(tempRoot);
        }
    });
});
