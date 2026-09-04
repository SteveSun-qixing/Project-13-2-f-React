import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { Card, Select, Button } from "antd";
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  AreaChartOutlined,
  CloseOutlined,
} from "@ant-design/icons";

export type ChartType = "bar" | "line" | "pie" | "area";

export interface ChartData {
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }[];
}

export interface ChartProps {
  id: string;
  type: ChartType;
  data: ChartData;
  position: { x: number; y: number };
  size: { width: number; height: number };
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onSizeChange: (id: string, size: { width: number; height: number }) => void;
  onTypeChange: (id: string, type: ChartType) => void;
  onDelete: (id: string) => void;
}

const CHART_COLORS = [
  "#1890ff",
  "#52c41a",
  "#faad14",
  "#f5222d",
  "#722ed1",
  "#13c2c2",
  "#eb2f96",
  "#fa8c16",
];

function generateSimpleChart(
  ctx: CanvasRenderingContext2D,
  type: ChartType,
  data: ChartData,
  width: number,
  height: number,
) {
  const padding = { top: 40, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#000000";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(data.title, width / 2, 20);

  const datasets = data.datasets;
  if (!datasets.length || !data.labels.length) return;

  const maxValue = Math.max(
    ...datasets.flatMap((d) => d.data),
    1,
  );
  const minValue = Math.min(
    ...datasets.flatMap((d) => d.data),
    0,
  );
  const valueRange = maxValue - minValue || 1;

  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const value = maxValue - (valueRange * i) / gridLines;
    ctx.fillStyle = "#666666";
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    ctx.fillText(value.toFixed(0), padding.left - 5, y + 3);
  }

  const barWidth = type === "pie" ? 0 : chartWidth / data.labels.length;
  const radius = Math.min(chartWidth, chartHeight) / 2.5;
  const centerX = width / 2;
  const centerY = (height + padding.top) / 2;

  datasets.forEach((dataset, datasetIndex) => {
    const color = dataset.backgroundColor
      ? (Array.isArray(dataset.backgroundColor)
          ? dataset.backgroundColor[0]
          : dataset.backgroundColor)
      : CHART_COLORS[datasetIndex % CHART_COLORS.length];

    ctx.fillStyle = color;
    ctx.strokeStyle = dataset.borderColor || color;
    ctx.lineWidth = 2;

    dataset.data.forEach((value, index) => {
      const normalizedValue = (value - minValue) / valueRange;
      const barHeight = normalizedValue * chartHeight;

      if (type === "bar") {
        const x = padding.left + index * barWidth + (datasetIndex * barWidth) / datasets.length;
        const barW = barWidth / datasets.length - 2;
        const y = padding.top + chartHeight - barHeight;
        ctx.fillRect(x, y, barW, barHeight);
        if (dataset.borderColor) {
          ctx.strokeRect(x, y, barW, barHeight);
        }
      } else if (type === "line" || type === "area") {
        const x = padding.left + (index + 0.5) * barWidth;
        const y = padding.top + chartHeight - barHeight;

        if (index === 0) {
          ctx.beginPath();
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        if (index === dataset.data.length - 1) {
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === "pie") {
        const sliceAngle = (Math.abs(value) / (datasets.flatMap((d) => d.data).reduce((a, b) => a + Math.abs(b), 0) || 1)) * Math.PI * 2;
        const startAngle = -Math.PI / 2;

        let currentAngle = startAngle;
        for (let i = 0; i < index; i++) {
          const v = dataset.data[i];
          currentAngle += (Math.abs(v) / (datasets.flatMap((d) => d.data).reduce((a, b) => a + Math.abs(b), 0) || 1)) * Math.PI * 2;
        }

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();

        if (dataset.borderColor) {
          ctx.stroke();
        }

        const midAngle = currentAngle + sliceAngle / 2;
        const labelRadius = radius * 1.3;
        const labelX = centerX + Math.cos(midAngle) * labelRadius;
        const labelY = centerY + Math.sin(midAngle) * labelRadius;

        ctx.fillStyle = "#000000";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(value.toFixed(0), labelX, labelY);
      }
    });

    if ((type === "line" || type === "area") && dataset.data.length > 0) {
      ctx.beginPath();
      dataset.data.forEach((value, index) => {
        const normalizedValue = (value - minValue) / valueRange;
        const barHeight = normalizedValue * chartHeight;
        const x = padding.left + (index + 0.5) * barWidth;
        const y = padding.top + chartHeight - barHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      if (type === "area") {
        const lastX = padding.left + (dataset.data.length - 0.5) * barWidth;
        ctx.lineTo(lastX, padding.top + chartHeight);
        const firstX = padding.left + 0.5 * barWidth;
        ctx.lineTo(firstX, padding.top + chartHeight);
        ctx.closePath();
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.stroke();
    }
  });

  ctx.fillStyle = "#666666";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  data.labels.forEach((label, index) => {
    const x = padding.left + (index + 0.5) * barWidth;
    const y = height - 10;
    ctx.fillText(label, x, y);
  });
}

export const Chart = memo<ChartProps>(function Chart({
  id,
  type,
  data,
  position,
  size,
  onPositionChange,
  onTypeChange,
  onDelete,
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.scale(dpr, dpr);

    generateSimpleChart(ctx, type, data, size.width, size.height);
  }, [type, data, size]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    setIsDragging(true);
  }, [position]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      onPositionChange(id, { x: newX, y: newY });
    },
    [isDragging, dragOffset, id, onPositionChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="sheet-chart"
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Card
        className="sheet-chart__card"
        size="small"
        title={
          <div className="sheet-chart__header">
            <span>{data.title}</span>
            <Select
              size="small"
              value={type}
              onChange={(value) => onTypeChange(id, value)}
              onClick={(e) => e.stopPropagation()}
              options={[
                { value: "bar", label: <BarChartOutlined /> },
                { value: "line", label: <LineChartOutlined /> },
                { value: "pie", label: <PieChartOutlined /> },
                { value: "area", label: <AreaChartOutlined /> },
              ]}
            />
          </div>
        }
        extra={
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => onDelete(id)}
          />
        }
      >
        <canvas ref={canvasRef} className="sheet-chart__canvas" />
      </Card>
    </div>
  );
});

export default Chart;
