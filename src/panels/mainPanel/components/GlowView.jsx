import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { STYLE_KEYS, STYLE_PRESETS } from "../glow/presets.js";
import { GlowEngine } from "../glow/engine.js";

import "./GlowView.css";

const DEFAULT_CONFIG = {
  style: "shine",
  strength: 40,
  radius: 20,
  threshold: 20,
  saturation: 0,
  brightnessBias: 0,
  colorEnabled: false,
  colorAmount: 0,
  colorHex: "#ffd27a",
  chromaticEnabled: false,
  chromatic: 0,
};

// 画质选项 → 最大处理尺寸
const QUALITY_OPTIONS = [
  { key: "low", label: "低", dim: 500 },
  { key: "medium", label: "中", dim: 900 },
  { key: "high", label: "高", dim: 1100 },
];

export const GlowView = ({ uploadedInputImage, isBusy, onApplyGlow, onCaptureLayerForGlow }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [quality, setQuality] = useState("high");
  const [glowImage, setGlowImage] = useState(null); // { dataUrl, bounds, docId }

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const imageRef = useRef(null);
  const rafRef = useRef(null);
  const panStartRef = useRef(null);
  const dragRef = useRef(false);
  const downsampledRef = useRef(null);
  const throttleRef = useRef(null);

  // 初始化引擎
  useEffect(() => {
    engineRef.current = new GlowEngine();
    return () => {
      if (engineRef.current) engineRef.current.cleanup();
    };
  }, []);

  // 捕获图层的通用函数
  const doCapture = useCallback(async () => {
    if (!onCaptureLayerForGlow || isBusy) return;
    const result = await onCaptureLayerForGlow();
    if (result?.dataUrl) {
      setGlowImage(result);
    }
  }, [onCaptureLayerForGlow, isBusy]);

  // 进入辉光面板时：优先用 uploadedInputImage，否则自动捕获
  useEffect(() => {
    if (uploadedInputImage?.dataUrl) {
      setGlowImage({
        dataUrl: uploadedInputImage.dataUrl,
        bounds: uploadedInputImage.bounds || null,
        docId: uploadedInputImage.docId || null,
      });
    } else {
      doCapture();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载图像
  useEffect(() => {
    if (!glowImage?.dataUrl) {
      imageRef.current = null;
      downsampledRef.current = null;
      setImageLoaded(false);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const offscreen = document.createElement("canvas");
      offscreen.width = img.width;
      offscreen.height = img.height;
      const offCtx = offscreen.getContext("2d");
      offCtx.drawImage(img, 0, 0);
      imageRef.current = offCtx.getImageData(0, 0, img.width, img.height);
      downsampledRef.current = null;
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error("GlowView: failed to load image");
    };
    img.src = glowImage.dataUrl;

    return () => { cancelled = true; };
  }, [glowImage?.dataUrl]);

  // 获取当前画质对应的降采样尺寸
  const getQualityDim = useCallback(() => {
    const opt = QUALITY_OPTIONS.find((o) => o.key === quality);
    return opt ? opt.dim : 1100;
  }, [quality]);

  // 降采样缓存：图像或画质变化时重新计算
  useEffect(() => {
    if (!imageRef.current) {
      downsampledRef.current = null;
      return;
    }
    const maxDim = getQualityDim();
    downsampledRef.current = GlowEngine.downsampleImage(imageRef.current, maxDim);
  }, [imageLoaded, quality, getQualityDim]);

  // 渲染函数
  const doRender = useCallback((downsampled, cfg) => {
    if (!downsampled || !canvasRef.current || !engineRef.current) return;
    try {
      const result = engineRef.current.process(downsampled, cfg);
      const canvas = canvasRef.current;
      if (canvas && result) {
        canvas.width = result.width;
        canvas.height = result.height;
        const ctx = canvas.getContext("2d");
        ctx.putImageData(result, 0, 0);
      }
    } catch (e) {
      console.error("Glow render error:", e);
    }
  }, []);

  // 渲染预览
  useEffect(() => {
    if (!imageLoaded || !downsampledRef.current || !canvasRef.current) return;

    const cfg = config;
    const isDrag = dragRef.current;

    setIsProcessing(true);

    if (isDrag) {
      // 拖动时限流：最多每 80ms 渲染一次
      if (throttleRef.current) return;
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
        doRender(downsampledRef.current, cfg);
        setIsProcessing(false);
      }, 80);
    } else {
      // 非拖动时用 raf
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        doRender(downsampledRef.current, cfg);
        setIsProcessing(false);
      });
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [imageLoaded, config, doRender]);

  // 配置更新
  const updateConfig = useCallback((key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 预设切换
  const handleStyleChange = useCallback((e) => {
    setConfig((prev) => ({ ...prev, style: e.target.value }));
  }, []);

  // 滑块拖动标记
  const handleSliderStart = useCallback(() => { dragRef.current = true; }, []);
  const handleSliderEnd = useCallback(() => {
    dragRef.current = false;
    // 清除限流定时器并立即触发高质量渲染
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
      throttleRef.current = null;
    }
    setConfig((prev) => ({ ...prev }));
  }, []);

  // 应用辉光
  const handleApply = useCallback(async () => {
    if (!imageRef.current || !onApplyGlow) return;
    setIsProcessing(true);
    try {
      const result = engineRef.current.process(imageRef.current, config);
      const dataUrl = GlowEngine.imageDataToDataUrl(result);
      await onApplyGlow(dataUrl, glowImage?.bounds, glowImage?.docId);
    } catch (e) {
      console.error("Glow apply error:", e);
    }
    setIsProcessing(false);
  }, [config, onApplyGlow, glowImage?.bounds, glowImage?.docId]);

  // 限制平移范围：放大时可拖动（图片边缘不超出容器），缩小时居中锁定
  const clampPan = useCallback((x, y, scale) => {
    if (scale <= 1) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return { x, y };
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = canvas.width * scale;
    const ih = canvas.height * scale;
    const margin = 40;
    const minX = -(iw - margin);
    const maxX = cw - margin;
    const minY = -(ih - margin);
    const maxY = ch - margin;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  }, []);

  // 鼠标滚轮缩放（缩放后自动居中或限制范围）
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setView((prev) => {
      const newScale = Math.max(0.35, Math.min(8, prev.scale * delta));
      const clamped = clampPan(prev.x, prev.y, newScale);
      return { ...prev, scale: newScale, x: clamped.x, y: clamped.y };
    });
  }, [clampPan]);

  // 鼠标拖动平移（仅放大时允许）
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0 || view.scale <= 1) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - view.x, y: e.clientY - view.y };
  }, [view.x, view.y, view.scale]);

  const handleMouseMove = useCallback((e) => {
    const start = panStartRef.current;
    if (!start) return;
    const rawX = e.clientX - start.x;
    const rawY = e.clientY - start.y;
    setView((prev) => {
      if (prev.scale <= 1) return { ...prev, x: 0, y: 0 };
      const clamped = clampPan(rawX, rawY, prev.scale);
      return { ...prev, x: clamped.x, y: clamped.y };
    });
  }, [clampPan]);

  const handleMouseUp = useCallback(() => {
    panStartRef.current = null;
    setIsPanning(false);
  }, []);

  const hasImage = !!glowImage;
  const canApply = hasImage && imageLoaded && !isBusy && !isProcessing;

  return (
    <div className="aya-glow">
      {/* 预览区域 */}
      <div
        ref={containerRef}
        className={"aya-glow__preview-area" + (isPanning ? " aya-glow__preview-area--dragging" : "") + (view.scale > 1 ? " aya-glow__preview-area--zoomed" : "")}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {hasImage ? (
          <canvas
            ref={canvasRef}
            className="aya-glow__canvas"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          />
        ) : (
          <div className="aya-glow__empty">
            <Sparkles size={28} strokeWidth={1.6} className="opacity-50" />
            <div>请先上传或捕获图像</div>
            {onCaptureLayerForGlow && (
              <button type="button" className="btn btn-xs btn-outline mt-1" onClick={doCapture} disabled={isBusy}>
                获取当前图层
              </button>
            )}
          </div>
        )}
        {isProcessing && (
          <div className="aya-glow__processing-indicator">
            <span className="loading loading-spinner loading-sm" />
          </div>
        )}
      </div>

      {/* 画质选择 & 重新获取 */}
      <div className="aya-glow__quality-row">
        <div className="aya-glow__quality-btns">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={"btn btn-xs " + (quality === opt.key ? "btn-primary" : "btn-ghost")}
              onClick={() => setQuality(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {onCaptureLayerForGlow && (
          <button type="button" className="btn btn-xs btn-ghost" onClick={doCapture} disabled={isBusy} title="重新获取当前图层">
            ↻
          </button>
        )}
      </div>

      {/* 参数控件 */}
      <div className="aya-glow__controls">
        <div className="aya-glow__row">
          <label>风格</label>
          <select className="select select-sm aya-glow__select" value={config.style} onChange={handleStyleChange} disabled={isBusy}>
            {STYLE_KEYS.map((key) => (
              <option key={key} value={key}>{STYLE_PRESETS[key].label}</option>
            ))}
          </select>
        </div>

        <SliderRow label="强度" value={config.strength} min={0} max={100} onChange={(v) => updateConfig("strength", v)} onStart={handleSliderStart} onEnd={handleSliderEnd} disabled={isBusy} />
        <SliderRow label="半径" value={config.radius} min={1} max={500} onChange={(v) => updateConfig("radius", v)} onStart={handleSliderStart} onEnd={handleSliderEnd} disabled={isBusy} />
        <SliderRow label="阈值" value={config.threshold} min={0} max={100} onChange={(v) => updateConfig("threshold", v)} onStart={handleSliderStart} onEnd={handleSliderEnd} disabled={isBusy} />

        <button type="button" className="aya-glow__advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}>
          <ChevronDown size={12} strokeWidth={2} style={{ transform: advancedOpen ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.18s" }} />
          高级参数
        </button>

        {advancedOpen && (
          <div className="aya-glow__advanced">
            <SliderRow label="曝光" value={config.brightnessBias} min={-100} max={100} onChange={(v) => updateConfig("brightnessBias", v)} onStart={handleSliderStart} onEnd={handleSliderEnd} disabled={isBusy} />
            <SliderRow label="饱和度" value={config.saturation} min={-100} max={100} onChange={(v) => updateConfig("saturation", v)} onStart={handleSliderStart} onEnd={handleSliderEnd} disabled={isBusy} />

            <div className="aya-glow__toggle-row">
              <label className="aya-toggle-line">
                <input className="toggle toggle-primary toggle-sm" type="checkbox" checked={config.colorEnabled} onChange={(e) => updateConfig("colorEnabled", e.target.checked)} disabled={isBusy} />
                <span className="text-sm">高光颜色</span>
              </label>
            </div>
            {config.colorEnabled && (
              <div className="aya-glow__color-row">
                <input type="color" className="aya-glow__color-input" value={config.colorHex} onChange={(e) => updateConfig("colorHex", e.target.value)} disabled={isBusy} />
                <SliderRow label="颜色强度" value={config.colorAmount} min={0} max={100} onChange={(v) => updateConfig("colorAmount", v)} onStart={handleSliderStart} onEnd={handleSliderEnd} disabled={isBusy} compact />
              </div>
            )}

            <div className="aya-glow__toggle-row">
              <label className="aya-toggle-line">
                <input className="toggle toggle-primary toggle-sm" type="checkbox" checked={config.chromaticEnabled} onChange={(e) => updateConfig("chromaticEnabled", e.target.checked)} disabled={isBusy} />
                <span className="text-sm">色散</span>
              </label>
            </div>
            {config.chromaticEnabled && (
              <SliderRow label="色散强度" value={config.chromatic} min={0} max={100} onChange={(v) => updateConfig("chromatic", v)} onStart={handleSliderStart} onEnd={handleSliderEnd} disabled={isBusy} />
            )}
          </div>
        )}

        <div className="aya-glow__actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleApply} disabled={!canApply}>
            {isProcessing ? <span className="loading loading-spinner loading-xs" /> : "应用到图层"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SliderRow = ({ label, value, min, max, onChange, onStart, onEnd, disabled, compact }) => (
  <div className="aya-glow__row" style={compact ? { marginLeft: 0 } : undefined}>
    <label>{label}</label>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} onMouseDown={onStart} onMouseUp={onEnd} onTouchStart={onStart} onTouchEnd={onEnd} disabled={disabled} />
    <span className="value-badge">{value}</span>
  </div>
);
