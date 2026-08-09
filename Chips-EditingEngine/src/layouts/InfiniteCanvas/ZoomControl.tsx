import React, { useState, useMemo } from 'react';
import { Select } from 'antd';
import './ZoomControl.css';

interface ZoomControlProps {
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomTo: (zoom: number) => void;
    onReset: () => void;
    onFit: () => void;
}

/**
 * 缩放控制器组件
 * 提供缩放控制功能，点击更多按钮展开选项
 */
export function ZoomControl({
    zoom,
    minZoom = 0.1,
    maxZoom = 5,
    onZoomIn,
    onZoomOut,
    onZoomTo,
    onReset,
    onFit,
}: ZoomControlProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const zoomPercent = Math.round(zoom * 100);

    const zoomPresets = [25, 50, 75, 100, 125, 150, 200, 300];

    const zoomOptions = useMemo(() => {
        const options = zoomPresets.map((preset) => ({
            label: `${preset}%`,
            value: String(preset),
        }));
        if (!zoomPresets.includes(zoomPercent)) {
            options.push({ label: `${zoomPercent}%`, value: String(zoomPercent) });
            options.sort((a, b) => Number(a.value) - Number(b.value));
        }
        return options;
    }, [zoomPercent]);

    const canZoomIn = zoom < maxZoom;
    const canZoomOut = zoom > minZoom;

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        onZoomTo(value / 100);
    };

    const handlePresetSelect = (value: string) => {
        onZoomTo(Number(value) / 100);
    };

    return (
        <div
            className={`zoom-control ${isExpanded ? 'zoom-control--expanded' : ''}`}
            onMouseLeave={() => setIsExpanded(false)}
        >
            {/* 基础控件：缩小按钮 */}
            <button
                type="button"
                className="zoom-control__button"
                disabled={!canZoomOut}
                title="缩小"
                onClick={onZoomOut}
            >
                −
            </button>

            {/* 基础控件：缩放滑块 */}
            <div className="zoom-control__slider-container">
                <input
                    type="range"
                    className="zoom-control__slider-input"
                    min={minZoom * 100}
                    max={maxZoom * 100}
                    step={5}
                    value={zoomPercent}
                    onChange={handleSliderChange}
                />
            </div>

            {/* 基础控件：放大按钮 */}
            <button
                type="button"
                className="zoom-control__button"
                disabled={!canZoomIn}
                title="放大"
                onClick={onZoomIn}
            >
                +
            </button>

            {/* 更多按钮 */}
            <button
                type="button"
                className={`zoom-control__button zoom-control__more ${isExpanded ? 'zoom-control__more--active' : ''}`}
                title="更多"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                ⋯
            </button>

            {/* 展开内容 */}
            {isExpanded && (
                <div className="zoom-control__expanded-content">
                    {/* 缩放百分比选择 */}
                    <div className="zoom-control__value">
                        <Select
                            className="zoom-control__select"
                            size="small"
                            options={zoomOptions}
                            value={String(zoomPercent)}
                            onChange={handlePresetSelect}
                        />
                    </div>

                    {/* 重置按钮 */}
                    <button
                        type="button"
                        className="zoom-control__button zoom-control__button--text"
                        title="重置缩放"
                        onClick={onReset}
                    >
                        重置
                    </button>

                    {/* 适应内容按钮 */}
                    <button
                        type="button"
                        className="zoom-control__button zoom-control__button--text"
                        title="适应视图"
                        onClick={onFit}
                    >
                        适应
                    </button>
                </div>
            )}
        </div>
    );
}
