import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: number;
  trend: number;
  icon: React.ReactNode;
  className?: string;
  description?: string;
  color?: string;
}

export function MetricCard({ 
  title, 
  value, 
  trend, 
  icon, 
  className,
  description,
  color = "blue" 
}: MetricCardProps) {
  const trendColor = trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500';
  const trendSign = trend > 0 ? '+' : '';
  const gradientColors = {
    blue: "from-blue-500/10 to-blue-500/5",
    green: "from-green-500/10 to-green-500/5",
    purple: "from-purple-500/10 to-purple-500/5",
    orange: "from-orange-500/10 to-orange-500/5"
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className={cn(
        "w-full overflow-hidden bg-gradient-to-br",
        gradientColors[color as keyof typeof gradientColors],
        className
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-2xl",
                  `text-${color}-500`
                )}>
                  {icon}
                </span>
                <p className="text-sm font-medium text-muted-foreground">
                  {title}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-3xl font-bold">{value}%</p>
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-medium", trendColor)}>
                    {trendSign}{trend}%
                  </span>
                  {description && (
                    <span className="text-xs text-muted-foreground">
                      {description}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
