import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  gradient?: string;
  className?: string;
}

const StatCard = ({ title, value, subtitle, icon: Icon, gradient = "bg-gradient-primary", className = "" }: StatCardProps) => {
  return (
    <Card className={`${gradient} p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-xl border-white/20 ${className}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium opacity-90">{title}</h3>
        {Icon && <Icon className="h-5 w-5 opacity-80" />}
      </div>
      <div className="mt-2">
        <div className="text-4xl font-bold">{value}</div>
        {subtitle && <p className="text-sm opacity-80 mt-1">{subtitle}</p>}
      </div>
    </Card>
  );
};

export default StatCard;
