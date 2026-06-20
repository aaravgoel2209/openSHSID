import { useRef, useState, useLayoutEffect } from 'react';
import LiquidGlassReact from 'liquid-glass-react';
import { LiquidGlass } from '@khvicha/react-liquid-glass';
import '@khvicha/react-liquid-glass/style.css';
import { useUI } from '../context/UIContext';

/**
 * 容器：按界面复杂度渲染。
 *  - 兼容 / 普通：普通卡片
 *  - 复杂：@khvicha/react-liquid-glass（普通文档流 div，自动占满宽度）
 *  - 极致：liquid-glass-react —— 它内部是 inline-flex（按内容收缩），且强制 translate(-50%,-50%)
 *          居中浮动。用不可见占位副本撑出原位/尺寸，并把测得的容器宽度赋给内容，
 *          让玻璃铺满整宽且不偏移。
 */
export default function GlassPanel({
  children,
  className = '',
  plainClass = '',
  glassContentClass = '',
  cornerRadius = 16,
}) {
  const { complexity } = useUI();
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // 极致模式：useLayoutEffect 确保在浏览器首次绘制前测量容器尺寸，
  // 再挂载 LiquidGlassReact，从而让库在 mount 时 measure 到正确的 SVG 滤镜尺寸。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [complexity]);

  // 兼容 / 普通
  if (complexity !== 'complex' && complexity !== 'extreme') {
    return <div className={`${className} ${plainClass}`.trim()}>{children}</div>;
  }

  // 复杂：@khvicha/react-liquid-glass —— 正常文档流，保持原位与宽度
  if (complexity === 'complex') {
    return (
      <LiquidGlass
        className={className}
        contentClassName={glassContentClass}
        borderRadius={cornerRadius}
        blur={3}
        tint="rgba(255, 255, 255, 0.12)"
        displacementScale={60}
        enableShadow
      >
        {children}
      </LiquidGlass>
    );
  }

  // 极致：占位副本撑出原位/高度，玻璃等 width 确定后再挂载——
  // 库在 mount 时用 getBoundingClientRect 记录 SVG 滤镜尺寸且之后不再更新，
  // 必须在 width 已知时才挂载，否则滤镜会固定在零尺寸上。
  return (
    <div ref={ref} className={`relative ${className}`.trim()}>
      <div className={`invisible ${glassContentClass}`.trim()} aria-hidden="true">{children}</div>
      {size.width > 0 && size.height > 0 && (
        <LiquidGlassReact
          style={{ position: 'absolute', top: '50%', left: '50%' }}
          cornerRadius={cornerRadius}
          padding="0px"
          displacementScale={120}
          blurAmount={0.5}
          saturation={170}
          aberrationIntensity={4}
          elasticity={0.4}
          mode="prominent"
        >
          <div className={glassContentClass} style={{ width: size.width, height: size.height }}>{children}</div>
        </LiquidGlassReact>
      )}
    </div>
  );
}
