import { Badge } from "@/components/ui/badge";
import { Smile, Frown, Meh, Loader2 } from "lucide-react";

interface SentimentBadgeProps {
  sentiment: string | null;
  isAnalyzing?: boolean;
}

const SentimentBadge = ({ sentiment, isAnalyzing }: SentimentBadgeProps) => {
  if (isAnalyzing) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyzing...
      </Badge>
    );
  }

  if (!sentiment) return null;

  const getSentimentConfig = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case "positive":
        return {
          icon: Smile,
          className: "bg-success/10 text-success border-success/20",
          label: "Positive",
        };
      case "negative":
        return {
          icon: Frown,
          className: "bg-destructive/10 text-destructive border-destructive/20",
          label: "Negative",
        };
      default:
        return {
          icon: Meh,
          className: "bg-muted text-muted-foreground",
          label: "Neutral",
        };
    }
  };

  const config = getSentimentConfig(sentiment);
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};

export default SentimentBadge;
