import type { CSSProperties, ReactNode } from "react";

type ShapeProps = { className?: string; style?: CSSProperties };

function SvgBase({
  className,
  style,
  viewBox,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <svg className={className} style={style} viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {children}
    </svg>
  );
}

export function ShapeGreen({ className, style }: ShapeProps) {
  return (
    <SvgBase className={className} style={style} viewBox="0 0 104 104">
      <rect x="6" y="6.5" width="90" height="91" stroke="#0F3B46" strokeWidth="12" />
      <rect x="50" y="20.5" width="3" height="15" fill="#0F3B46" />
      <rect x="50" y="69.5" width="3" height="15" fill="#0F3B46" />
      <rect x="19.5" y="54" width="3" height="15" transform="rotate(-90 19.5 54)" fill="#0F3B46" />
      <rect x="67.5" y="54" width="3" height="15" transform="rotate(-90 67.5 54)" fill="#0F3B46" />
      <rect x="24.5371" y="69.7991" width="1" height="15" transform="rotate(-120 24.5371 69.7991)" fill="#0F3B46" />
      <rect x="65.9727" y="45.2991" width="1" height="15" transform="rotate(-120 65.9727 45.2991)" fill="#0F3B46" />
      <rect x="36.7988" y="80.9629" width="1" height="15" transform="rotate(-150 36.7988 80.9629)" fill="#0F3B46" />
      <rect x="60.2988" y="38.5276" width="1" height="15" transform="rotate(-150 60.2988 38.5276)" fill="#0F3B46" />
      <rect x="67.7988" y="79.4629" width="1" height="15" transform="rotate(150 67.7988 79.4629)" fill="#0F3B46" />
      <rect x="44.2988" y="37.0276" width="1" height="15" transform="rotate(150 44.2988 37.0276)" fill="#0F3B46" />
      <rect x="78.9629" y="67.2009" width="1" height="15" transform="rotate(120 78.9629 67.2009)" fill="#0F3B46" />
      <rect x="37.5273" y="42.7009" width="1" height="15" transform="rotate(120 37.5273 42.7009)" fill="#0F3B46" />
    </SvgBase>
  );
}

export function ShapeOrange({ className, style }: ShapeProps) {
  return (
    <SvgBase className={className} style={style} viewBox="200 0 104 104">
      <circle cx="251" cy="52" r="21" fill="#0F3B46" />
      <rect x="249" width="5" height="24" fill="#0F3B46" />
      <rect x="249" y="80" width="5" height="24" fill="#0F3B46" />
      <rect x="200" y="54" width="4" height="24" transform="rotate(-90 200 54)" fill="#0F3B46" />
      <rect x="278" y="54" width="4" height="24" transform="rotate(-90 278 54)" fill="#0F3B46" />
      <rect x="208.155" y="80.0079" width="1.61905" height="24.2857" transform="rotate(-120 208.155 80.0079)" fill="#0F3B46" />
      <rect x="275.241" y="40.3413" width="1.61905" height="24.2857" transform="rotate(-120 275.241 40.3413)" fill="#0F3B46" />
      <rect x="228.008" y="98.0826" width="1.61905" height="24.2857" transform="rotate(-150 228.008 98.0826)" fill="#0F3B46" />
      <rect x="266.056" y="29.3779" width="1.61905" height="24.2857" transform="rotate(-150 266.056 29.3779)" fill="#0F3B46" />
      <rect x="278.198" y="95.6541" width="1.61905" height="24.2857" transform="rotate(150 278.198 95.6541)" fill="#0F3B46" />
      <rect x="240.151" y="26.9493" width="1.61905" height="24.2857" transform="rotate(150 240.151 26.9493)" fill="#0F3B46" />
      <rect x="296.273" y="75.8014" width="1.61905" height="24.2857" transform="rotate(120 296.273 75.8014)" fill="#0F3B46" />
      <rect x="229.188" y="36.1348" width="1.61905" height="24.2857" transform="rotate(120 229.188 36.1348)" fill="#0F3B46" />
    </SvgBase>
  );
}

export function ShapeBlue({ className, style }: ShapeProps) {
  return (
    <SvgBase className={className} style={style} viewBox="400 0 104 104">
      <circle cx="451" cy="52" r="46.5" stroke="#0F3B46" strokeWidth="9" />
      <path d="M451 18L481.311 70.5H420.689L451 18Z" fill="#0F3B46" />
    </SvgBase>
  );
}

export function ShapeRed({ className, style }: ShapeProps) {
  return (
    <SvgBase className={className} style={style} viewBox="612 0 112 104">
      <path d="M704.436 86.5H619.564L662 12.999L704.436 86.5Z" stroke="#0F3B46" strokeWidth="13" />
      <rect x="648" y="52" width="28" height="28" fill="#0F3B46" />
    </SvgBase>
  );
}

export default function aCRLShapes({ className = "h-12 w-auto", style }: ShapeProps) {
  return (
    <SvgBase className={className} style={style} viewBox="0 0 724 104">
      <rect x="6" y="6.5" width="90" height="91" stroke="#0F3B46" strokeWidth="12" />
      <rect x="50" y="20.5" width="3" height="15" fill="#0F3B46" />
      <rect x="50" y="69.5" width="3" height="15" fill="#0F3B46" />
      <rect x="19.5" y="54" width="3" height="15" transform="rotate(-90 19.5 54)" fill="#0F3B46" />
      <rect x="67.5" y="54" width="3" height="15" transform="rotate(-90 67.5 54)" fill="#0F3B46" />
      <rect x="24.5371" y="69.7991" width="1" height="15" transform="rotate(-120 24.5371 69.7991)" fill="#0F3B46" />
      <rect x="65.9727" y="45.2991" width="1" height="15" transform="rotate(-120 65.9727 45.2991)" fill="#0F3B46" />
      <rect x="36.7988" y="80.9629" width="1" height="15" transform="rotate(-150 36.7988 80.9629)" fill="#0F3B46" />
      <rect x="60.2988" y="38.5276" width="1" height="15" transform="rotate(-150 60.2988 38.5276)" fill="#0F3B46" />
      <rect x="67.7988" y="79.4629" width="1" height="15" transform="rotate(150 67.7988 79.4629)" fill="#0F3B46" />
      <rect x="44.2988" y="37.0276" width="1" height="15" transform="rotate(150 44.2988 37.0276)" fill="#0F3B46" />
      <rect x="78.9629" y="67.2009" width="1" height="15" transform="rotate(120 78.9629 67.2009)" fill="#0F3B46" />
      <rect x="37.5273" y="42.7009" width="1" height="15" transform="rotate(120 37.5273 42.7009)" fill="#0F3B46" />

      <circle cx="251" cy="52" r="21" fill="#0F3B46" />
      <rect x="249" width="5" height="24" fill="#0F3B46" />
      <rect x="249" y="80" width="5" height="24" fill="#0F3B46" />
      <rect x="200" y="54" width="4" height="24" transform="rotate(-90 200 54)" fill="#0F3B46" />
      <rect x="278" y="54" width="4" height="24" transform="rotate(-90 278 54)" fill="#0F3B46" />
      <rect x="208.155" y="80.0079" width="1.61905" height="24.2857" transform="rotate(-120 208.155 80.0079)" fill="#0F3B46" />
      <rect x="275.241" y="40.3413" width="1.61905" height="24.2857" transform="rotate(-120 275.241 40.3413)" fill="#0F3B46" />
      <rect x="228.008" y="98.0826" width="1.61905" height="24.2857" transform="rotate(-150 228.008 98.0826)" fill="#0F3B46" />
      <rect x="266.056" y="29.3779" width="1.61905" height="24.2857" transform="rotate(-150 266.056 29.3779)" fill="#0F3B46" />
      <rect x="278.198" y="95.6541" width="1.61905" height="24.2857" transform="rotate(150 278.198 95.6541)" fill="#0F3B46" />
      <rect x="240.151" y="26.9493" width="1.61905" height="24.2857" transform="rotate(150 240.151 26.9493)" fill="#0F3B46" />
      <rect x="296.273" y="75.8014" width="1.61905" height="24.2857" transform="rotate(120 296.273 75.8014)" fill="#0F3B46" />
      <rect x="229.188" y="36.1348" width="1.61905" height="24.2857" transform="rotate(120 229.188 36.1348)" fill="#0F3B46" />

      <circle cx="451" cy="52" r="46.5" stroke="#0F3B46" strokeWidth="9" />
      <path d="M451 18L481.311 70.5H420.689L451 18Z" fill="#0F3B46" />

      <path d="M704.436 86.5H619.564L662 12.999L704.436 86.5Z" stroke="#0F3B46" strokeWidth="13" />
      <rect x="648" y="52" width="28" height="28" fill="#0F3B46" />
    </SvgBase>
  );
}
