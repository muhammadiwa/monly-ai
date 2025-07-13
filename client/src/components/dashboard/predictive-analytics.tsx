import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle,
  BarChart3
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

interface PredictiveAnalyticsProps {
  predictions: any;
  currency: string;
  showBalance: boolean;
}

export default function PredictiveAnalytics({ predictions, currency, showBalance }: PredictiveAnalyticsProps) {
  const mockPredictions = [
    {
      type: "income",
      title: "Next Month's Income",
      predicted: currency === 'IDR' ? 13250000 : 1325,
      confidence: 92,
      change: "+6%",
      trend: "up",
      factors: ["Regular salary", "Freelance projects", "Investment returns"]
    },
    {
      type: "expenses",
      title: "Expected Expenses",
      predicted: currency === 'IDR' ? 9150000 : 915,
      confidence: 88,
      change: "+4.5%",
      trend: "up",
      factors: ["Seasonal increase", "Upcoming bills", "Shopping patterns"]
    },
    {
      type: "savings",
      title: "Projected Savings",
      predicted: currency === 'IDR' ? 4100000 : 410,
      confidence: 85,
      change: "+8.2%",
      trend: "up",
      factors: ["Income growth", "Expense optimization", "Goal progress"]
    }
  ];

  const data = predictions || mockPredictions;

  const nextMonthAlerts = [
    {
      type: "warning",
      message: "Electricity bill likely to increase by 20% due to seasonal usage",
      impact: currency === 'IDR' ? 150000 : 15,
      date: "Jan 15"
    },
    {
      type: "opportunity",
      message: "Best time to invest: Market conditions favorable",
      impact: currency === 'IDR' ? 500000 : 50,
      date: "Jan 20"
    },
    {
      type: "goal",
      message: "Emergency fund goal achievable with current savings rate",
      impact: currency === 'IDR' ? 2000000 : 200,
      date: "Jan 31"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          Predictive Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Predictions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.map((prediction: any, index: number) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">{prediction.title}</h4>
                {prediction.trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              
              <div className="space-y-1">
                <div className="text-2xl font-bold text-gray-900">
                  {showBalance ? formatCurrency(prediction.predicted, currency) : '••••••'}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {prediction.confidence}% confidence
                  </Badge>
                  <span className={`text-xs ${prediction.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {prediction.change}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-gray-500 font-medium">Key factors:</p>
                {prediction.factors.slice(0, 2).map((factor: string, i: number) => (
                  <p key={i} className="text-xs text-gray-600">• {factor}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Next Month Alerts */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Next Month Insights
          </h4>
          
          {nextMonthAlerts.map((alert, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg border">
              <div className={`p-1 rounded-full ${
                alert.type === 'warning' ? 'bg-yellow-100' :
                alert.type === 'opportunity' ? 'bg-green-100' : 'bg-blue-100'
              }`}>
                {alert.type === 'warning' ? (
                  <AlertTriangle className="h-3 w-3 text-yellow-600" />
                ) : alert.type === 'opportunity' ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-blue-600" />
                )}
              </div>
              
              <div className="flex-1">
                <p className="text-sm text-gray-700">{alert.message}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">Impact: {showBalance ? formatCurrency(alert.impact, currency) : '••••'}</span>
                  <span className="text-xs text-gray-500">{alert.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Forecast Chart Placeholder */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">6-Month Forecast</h4>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="h-24 flex items-end justify-between gap-2">
            {[65, 78, 84, 92, 88, 95].map((height, index) => (
              <div key={index} className="flex-1 space-y-1">
                <div 
                  className="bg-gradient-to-t from-blue-500 to-purple-500 rounded-t" 
                  style={{ height: `${height}%` }}
                />
                <p className="text-xs text-center text-gray-500">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][index]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
