// components/ICRLShapes.tsx
// Placeholder SVG shapes for ICRL system
// Replace with real brand shapes when available

export function ShapeGreen({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#2A9D8F" />
    </svg>
  );
}

export function ShapeOrange({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="80" height="80" rx="8" fill="#F4A261" />
    </svg>
  );
}

export function ShapeBlue({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,5 95,95 5,95" fill="#4361EE" />
    </svg>
  );
}

export function ShapeRed({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,5 95,50 50,95 5,50" fill="#E63946" />
    </svg>
  );
}
