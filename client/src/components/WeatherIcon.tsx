import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudFog,
  CloudLightning,
  type LucideProps,
} from 'lucide-react';

const MAP: Record<string, React.ComponentType<LucideProps>> = {
  sun: Sun,
  cloud: Cloud,
  'cloud-sun': CloudSun,
  rain: CloudRain,
  drizzle: CloudDrizzle,
  snow: CloudSnow,
  fog: CloudFog,
  storm: CloudLightning,
};

export function WeatherIcon({ icon, ...props }: { icon: string } & LucideProps) {
  const Cmp = MAP[icon] || Cloud;
  return <Cmp {...props} />;
}
