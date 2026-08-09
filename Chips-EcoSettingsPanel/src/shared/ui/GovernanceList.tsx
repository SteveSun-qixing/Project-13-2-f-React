import React from "react";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";

interface GovernanceListColumn {
  id: string;
  label: string;
  width: string;
  align?: "start" | "end";
}

interface GovernanceListProps {
  ariaLabel: string;
  columns: GovernanceListColumn[];
  children: React.ReactNode;
}

interface GovernanceListRowProps {
  children: React.ReactNode;
}

interface GovernanceListCellProps {
  label: string;
  align?: "start" | "end";
  children: React.ReactNode;
}

interface GovernanceRowData {
  id: string;
  cells: Array<{
    columnId: string;
    label: string;
    align?: "start" | "end";
    content: React.ReactNode;
  }>;
}

function isGovernanceRow(element: React.ReactNode): element is React.ReactElement<GovernanceListRowProps> {
  return React.isValidElement(element) && element.type === GovernanceListRow;
}

function isGovernanceCell(element: React.ReactNode): element is React.ReactElement<GovernanceListCellProps> {
  return React.isValidElement(element) && element.type === GovernanceListCell;
}

function resolveFrColumnWidth(columns: GovernanceListColumn[], column: GovernanceListColumn): string | undefined {
  const width = column.width.trim();
  if (width === "auto") {
    return undefined;
  }

  const match = width.match(/^minmax\(0,\s*([\d.]+)fr\)$/);
  if (!match) {
    return width;
  }

  const totalFr = columns.reduce((total, candidate) => {
    const candidateMatch = candidate.width.trim().match(/^minmax\(0,\s*([\d.]+)fr\)$/);
    return total + (candidateMatch ? Number(candidateMatch[1]) : 0);
  }, 0);

  if (totalFr <= 0) {
    return undefined;
  }

  return `${(Number(match[1]) / totalFr) * 100}%`;
}

export function GovernanceList({ ariaLabel, columns, children }: GovernanceListProps): React.ReactElement {
  const rows = React.useMemo<GovernanceRowData[]>(() => {
    return React.Children.toArray(children).map((rowElement, rowIndex) => {
      const rowChildren = isGovernanceRow(rowElement) ? rowElement.props.children : rowElement;
      const cells = React.Children.toArray(rowChildren);
      const row: GovernanceRowData = {
        id: React.isValidElement(rowElement) && rowElement.key !== null ? String(rowElement.key) : String(rowIndex),
        cells: [],
      };

      columns.forEach((column, columnIndex) => {
        const cell = cells[columnIndex];
        const label = isGovernanceCell(cell) ? cell.props.label : column.label;
        const align = isGovernanceCell(cell) ? cell.props.align ?? column.align : column.align;
        const content = isGovernanceCell(cell) ? cell.props.children : cell;
        row.cells.push({
          columnId: column.id,
          label,
          align,
          content,
        });
      });

      return row;
    });
  }, [children, columns]);

  const tableColumns = React.useMemo<ColumnsType<GovernanceRowData>>(() => {
    return columns.map((column) => ({
      key: column.id,
      title: <span className="settings-governance-header-label">{column.label}</span>,
      align: column.align === "end" ? "right" : "left",
      width: resolveFrColumnWidth(columns, column),
      render: (_: unknown, row) => {
        const cell = row.cells.find((candidate) => candidate.columnId === column.id);
        const align = cell?.align ?? column.align;
        return (
          <div
            className={`settings-governance-cell-content${align === "end" ? " settings-governance-cell-content--end" : ""}`}
            data-label={cell?.label ?? column.label}
          >
            {cell?.content}
          </div>
        );
      },
    }));
  }, [columns]);

  return (
    <Table<GovernanceRowData>
      className="settings-governance-list"
      aria-label={ariaLabel}
      rowKey="id"
      columns={tableColumns}
      dataSource={rows}
      pagination={false}
      size="middle"
    />
  );
}

export function GovernanceListRow({ children }: GovernanceListRowProps): React.ReactElement {
  return <>{children}</>;
}

export function GovernanceListCell({ label, align = "start", children }: GovernanceListCellProps): React.ReactElement {
  void label;
  void align;
  return <>{children}</>;
}
