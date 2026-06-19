import LiquidGlassReact from 'liquid-glass-react';
import { LiquidGlass } from '@khvicha/react-liquid-glass';
import '@khvicha/react-liquid-glass/style.css';
import { useUI } from '../context/UIContext';

/**
 * 容器：按界面复杂度渲染。
 *  - 兼容 / 普通：普通卡片
 *  - 复杂：@khvicha/react-liquid-glass（普通文档流 div，不会偏移）
 *  - 极致：liquid-glass-react（更强的液态玻璃；它是绝对居中浮层，用不可见占位副本保持原位）
 *
 *  className:         外层布局类（如外边距），各模式都生效
 *  plainClass:        普通模式下的卡片样式（背景/边框/圆角/内边距）
 *  glassContentClass: 玻璃模式下内容容器的样式（内边距/对齐，不要带背景）
 */
export default function GlassPanel({
  children,
  className = '',
  plainClass = '',
  glassContentClass = '',
  cornerRadius = 16,
}) {
  const { complexity } = useUI();

  // 兼容 / 普通
  if (complexity !== 'complex' && complexity !== 'extreme') {
    return <div className={`${className} ${plainClass}`.trim()}>{children}</div>;
  }

  // 复杂：@khvicha/react-liquid-glass —— 正常文档流，保持原位
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

  // 极致：liquid-glass-react —— 用占位副本撑出原始位置/尺寸，玻璃层绝对居中覆盖
  return (
    <div className={`relative ${className}`.trim()}>
      <div className={`invisible ${glassContentClass}`.trim()} aria-hidden="true">{children}</div>
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
        <div className={glassContentClass}>{children}</div>
      </LiquidGlassReact>
    </div>
  );
}
