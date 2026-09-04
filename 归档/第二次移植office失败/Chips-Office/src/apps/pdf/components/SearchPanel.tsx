import { useCallback, useEffect, useRef, useState } from "react";
import { Input, Space, Button, Spin, Typography, Badge } from "antd";
import {
  SearchOutlined,
  CloseOutlined,
  UpOutlined,
  DownOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import { usePdf } from "../hooks/usePdf";

const { Text } = Typography;

export function SearchPanel() {
  const {
    showSearch,
    searchQuery,
    searchResults,
    searchCurrentIndex,
    isSearching,
    setSearchQuery,
    nextSearchResult,
    prevSearchResult,
    clearSearch,
    toggleSearch,
    goToPage,
  } = usePdf();

  const inputRef = useRef<any>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        void setSearchQuery(value);
      }, 300);
    },
    [setSearchQuery],
  );

  const handleClear = useCallback(() => {
    setLocalQuery("");
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  const handleNext = useCallback(() => {
    nextSearchResult();
  }, [nextSearchResult]);

  const handlePrev = useCallback(() => {
    prevSearchResult();
  }, [prevSearchResult]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrev();
        } else {
          handleNext();
        }
      }

      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleNext, handlePrev, handleClear],
  );

  const totalMatches = searchResults.reduce(
    (sum, result) => sum + result.matches.length,
    0,
  );

  if (!showSearch) {
    return null;
  }

  return (
    <div
      className="pdf-search-panel"
      style={{
        position: "fixed",
        top: 56,
        right: 16,
        width: 320,
        backgroundColor: "#fff",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid #f0f0f0",
          backgroundColor: "#fafafa",
        }}
      >
        <Text strong style={{ fontSize: 14 }}>
          搜索文档
        </Text>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={toggleSearch}
          aria-label="关闭搜索面板"
        />
      </div>

      <div style={{ padding: 12 }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            ref={inputRef}
            placeholder="在文档中搜索..."
            prefix={<SearchOutlined style={{ color: "#999" }} />}
            value={localQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            allowClear={false}
            aria-label="搜索输入"
          />
          {localQuery && (
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              title="清除搜索"
            />
          )}
        </Space.Compact>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Space size="small">
            <Button
              icon={<UpOutlined />}
              size="small"
              onClick={handlePrev}
              disabled={totalMatches === 0}
              title="上一个匹配项 (Shift+Enter)"
            />
            <Button
              icon={<DownOutlined />}
              size="small"
              onClick={handleNext}
              disabled={totalMatches === 0}
              title="下一个匹配项 (Enter)"
            />
          </Space>

          {isSearching ? (
            <Spin size="small" />
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {localQuery ? (
                totalMatches > 0 ? (
                  <>
                    <Badge
                      count={searchCurrentIndex + 1}
                      style={{ backgroundColor: "#1677ff" }}
                      showZero
                    />{" "}
                    / {totalMatches} 个匹配
                  </>
                ) : searchQuery ? (
                  "无匹配结果"
                ) : null
              ) : null}
            </Text>
          )}
        </div>
      </div>

      {searchResults.length > 1 && (
        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            borderTop: "1px solid #f0f0f0",
          }}
        >
          {searchResults.map((result, pageIndex) => (
            <div
              key={pageIndex}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor:
                  pageIndex === searchCurrentIndex ? "#e6f4ff" : "transparent",
                borderLeft:
                  pageIndex === searchCurrentIndex
                    ? "3px solid #1677ff"
                    : "3px solid transparent",
              }}
              onClick={() => {
                goToPage(result.pageIndex + 1);
              }}
            >
              <Text style={{ fontSize: 12 }}>
                第 {result.pageIndex + 1} 页
              </Text>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                ({result.matches.length} 处匹配)
              </Text>
              {result.matches.slice(0, 2).map((match, matchIndex) => (
                <div
                  key={matchIndex}
                  style={{
                    fontSize: 11,
                    color: "#666",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  ...{match.text}...
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
