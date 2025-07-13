import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Target,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

interface AIInsightsProps {
  insights: any;
  currency: string;
  showBalance: boolean;
}

export default function AIInsights({ insights, currency, showBalance }: AIInsightsProps) {
  // Mock AI insights for demonstration
  const mockInsights = [
    {
      type: "optimization",
      title: "Smart Spending Opportunity",
      message: "You could save 15% on dining expenses by cooking at home 3 more times per week.",
      impact: currency === 'IDR' ? 750000 : 75,
      confidence: 89,
      action: "View recommendations"
    },
    {
      type: "prediction",
      title: "Budget Alert Prediction",
      message: "Based on current spending patterns, you'll exceed your entertainment budget by 23% this month.",
      impact: currency === 'IDR' ? 350000 : 35,
      confidence: 94,
      action: "Adjust budget"
    },
    {
      type: "achievement",
      title: "Goal Achievement",
      message: "You're on track to reach your emergency fund goal 2 months early with current savings rate.",
      impact: currency === 'IDR' ? 2500000 : 250,
      confidence: 91,
      action: "View progress"
    }
  ];

  const data = insights || mockInsights;

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'optimization': return Lightbulb;
      case 'prediction': return AlertTriangle;
      case 'achievement': return CheckCircle;
      default: return Brain;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'optimization': return 'bg-yellow-50 border-yellow-200';
      case 'prediction': return 'bg-red-50 border-red-200';
      case 'achievement': return 'bg-green-50 border-green-200';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'optimization': return 'text-yellow-600';
      case 'prediction': return 'text-red-600';
      case 'achievement': return 'text-green-600';
      default: return 'text-blue-600';
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-indigo-100" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          AI Financial Intelligence
          <Sparkles className="h-4 w-4 text-purple-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {data.map((insight: any, index: number) => {
          const Icon = getInsightIcon(insight.type);
          return (
            <div 
              key={index}
              className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full bg-white ${getIconColor(insight.type)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {insight.confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700">{insight.message}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-gray-500">Potential impact: </span>
                      <span className="font-medium text-gray-900">
                        {showBalance ? formatCurrency(insight.impact, currency) : '••••••'}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1">
                      {insight.action}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* AI Chat Quick Access */}
        <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Ask MonlyAI</h4>
              <p className="text-sm text-gray-600">Get personalized financial advice</p>
            </div>
            <Button size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600">
              Chat Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
