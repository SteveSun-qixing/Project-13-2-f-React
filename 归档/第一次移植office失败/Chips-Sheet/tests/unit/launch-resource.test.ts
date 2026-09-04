import { describe, expect, it } from "vitest";
import type { PlatformLaunchContext } from "chips-sdk";
import {
  isLikelyLocalPath,
  isProbablyRemoteSource,
  resolveLaunchSheetTarget,
} from "../../src/utils/launch-resource";

function makeLaunchContext(launchParams: Record<string, unknown>): PlatformLaunchContext {
  return { launchParams } as unknown as PlatformLaunchContext;
}

describe("启动参数中的表格文件目标解析", () => {
  it("resourceOpen.filePath 优先级最高", () => {
    const target = resolveLaunchSheetTarget(
      makeLaunchContext({
        targetPath: "/tmp/fallback.xlsx",
        resourceOpen: {
          intent: "open",
          resourceId: "res-1",
          filePath: "/Users/demo/报表.xlsx",
          fileName: "报表.xlsx",
        },
      }),
    );
    expect(target).not.toBeNull();
    expect(target?.filePath).toBe("/Users/demo/报表.xlsx");
    expect(target?.sourceId).toBe("/Users/demo/报表.xlsx");
    expect(target?.fileName).toBe("报表.xlsx");
    expect(target?.format).toBe("xlsx");
  });

  it("无 filePath 时回退 launchParams.targetPath", () => {
    const target = resolveLaunchSheetTarget(
      makeLaunchContext({
        targetPath: "/tmp/data.csv",
        resourceOpen: { intent: "open", resourceId: "res-2" },
      }),
    );
    expect(target).not.toBeNull();
    expect(target?.sourceId).toBe("/tmp/data.csv");
    expect(target?.format).toBe("csv");
    expect(target?.fileName).toBe("data.csv");
  });

  it("再无 targetPath 时回退 resourceOpen.resourceId", () => {
    const target = resolveLaunchSheetTarget(
      makeLaunchContext({
        resourceOpen: { intent: "open", resourceId: "resource-3", fileName: "清单.xlsx" },
      }),
    );
    expect(target).not.toBeNull();
    expect(target?.sourceId).toBe("resource-3");
    expect(target?.filePath).toBeUndefined();
    expect(target?.fileName).toBe("清单.xlsx");
  });

  it("Host 托管资源 URI 即使带扩展名仍保留为 resourceId", () => {
    const target = resolveLaunchSheetTarget(
      makeLaunchContext({
        resourceOpen: {
          intent: "view",
          resourceId: "chips-render://card-root/assets/清单.xlsx",
        },
      }),
    );
    expect(target).not.toBeNull();
    expect(target?.sourceId).toBe("chips-render://card-root/assets/清单.xlsx");
    expect(target?.filePath).toBeUndefined();
    expect(target?.format).toBe("xlsx");
  });

  it("file:// URI 归一化为本地路径", () => {
    const target = resolveLaunchSheetTarget(
      makeLaunchContext({
        resourceOpen: {
          intent: "open",
          filePath: "file:///Users/demo/%E8%A1%A8%E6%A0%BC.xlsm",
        },
      }),
    );
    expect(target).not.toBeNull();
    expect(target?.sourceId).toBe("/Users/demo/表格.xlsm");
    expect(target?.format).toBe("xlsm");
  });

  it("mimeType 可以在无扩展名时确定格式", () => {
    const target = resolveLaunchSheetTarget(
      makeLaunchContext({
        resourceOpen: {
          intent: "open",
          resourceId: "res-csv-4",
          mimeType: "text/csv",
        },
      }),
    );
    expect(target?.format).toBe("csv");
  });

  it("无目标或格式不受支持时返回 null（停留起始页）", () => {
    expect(resolveLaunchSheetTarget(makeLaunchContext({}))).toBeNull();
    expect(
      resolveLaunchSheetTarget(
        makeLaunchContext({ resourceOpen: { intent: "open", resourceId: "res-5" } }),
      ),
    ).toBeNull();
    expect(
      resolveLaunchSheetTarget(
        makeLaunchContext({
          resourceOpen: { intent: "open", resourceId: "res-6", filePath: "/tmp/doc.pdf" },
        }),
      ),
    ).toBeNull();
  });
});

describe("来源类型判定", () => {
  it("识别 http(s) 远程来源", () => {
    expect(isProbablyRemoteSource("https://example.com/a.xlsx")).toBe(true);
    expect(isProbablyRemoteSource("http://192.168.1.2:8080/a.csv")).toBe(true);
    expect(isProbablyRemoteSource("/local/a.xlsx")).toBe(false);
  });

  it("识别本地路径", () => {
    expect(isLikelyLocalPath("/Users/demo/a.xlsx")).toBe(true);
    expect(isLikelyLocalPath("C:\\Users\\demo\\a.xlsx")).toBe(true);
    expect(isLikelyLocalPath("file:///Users/demo/a.xlsx")).toBe(true);
    expect(isLikelyLocalPath("a.xlsx")).toBe(true);
    expect(isLikelyLocalPath("https://example.com/a.xlsx")).toBe(false);
    expect(isLikelyLocalPath("")).toBe(false);
  });

  it("Host 托管 URI 即使带扩展名也不应当走本地 file.read", () => {
    expect(isLikelyLocalPath("chips-render://card-root/assets/表格.xlsx")).toBe(false);
  });
});
