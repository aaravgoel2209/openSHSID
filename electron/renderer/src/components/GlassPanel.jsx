import { LiquidGlass } from '@khvicha/react-liquid-glass';
import '@khvicha/react-liquid-glass/style.css';
import { useUI } from '../context/useUI';

export default function GlassPanel({
  children,
  className = '',
  plainClass = '',
  glassContentClass = '',
  cornerRadius = 16,
}) {
  const { complexity } = useUI();

  if (complexity === 'simple' || complexity === 'normal') {
    return <div className={`${className} ${plainClass}`.trim()}>{children}</div>;
  }

  const isExtreme = complexity === 'extreme';

  return (
    <LiquidGlass
      className={className}
      contentClassName={glassContentClass}
      borderRadius={cornerRadius}
      blur={isExtreme ? 5 : 3}
      tint={isExtreme ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.12)'}
      displacementScale={isExtreme ? 100 : 60}
      saturation={isExtreme ? 170 : undefined}
      enableShadow
    >
      {children}
    </LiquidGlass>
  );
}
