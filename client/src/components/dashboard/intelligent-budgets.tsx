import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { 
  Target, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Plus,
  Settings,
  Brain
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

interface IntelligentBudgetsProps {
  readonly data: any;
  readonly currency: string;
  readonly showBalance: boolean;
}

export default function IntelligentBudgets({ data, currency, showBalance }: IntelligentBudgetsProps) {
  // Fetch intelligent budget data from API
  const { data: budgetData } = useQuery({
    queryKey: ["/api/analytics/intelligent-budgets"],
    queryFn: () => {
      const authToken = localStorage.getItem('auth-token');
      return fetch("/api/analytics/intelligent-budgets", {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }).then(res => res.json());
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (!budgetData?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Intelligent Budgets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            Analyzing your budget recommendations...
          </div>
        </CardContent>
      </Card>
    );
  }

  const { suggestedBudgets, budgetOptimization, overallRecommendation } = budgetData.data;

  const getStatusColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'; 
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (priority: string) => {
    switch (priority) {
      case 'high': return AlertTriangle;
      case 'medium': return TrendingUp;
      case 'low': return CheckCircle;
      default: return Target;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Intelligent Budgets
          </CardTitle>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Recommendation */}
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-start gap-2">
            <Brain className="h-4 w-4 text-purple-600 mt-0.5" />
            <div className="text-sm text-purple-800">
              {overallRecommendation}
            </div>
          </div>
        </div>

        {/* Budget Optimizations */}
        {budgetOptimization && budgetOptimization.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Budget Optimizations</h4>
            {budgetOptimization.slice(0, 3).map((optimization: any, index: number) => {
              const StatusIcon = getStatusIcon(optimization.priority);
              const savingsPercentage = optimization.currentBudget > 0 
                ? (optimization.potentialSavings / optimization.currentBudget * 100) 
                : 0;
              
              return (
                <div key={`optimization-${optimization.categoryName}-${index}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-gray-800">{optimization.categoryName}</h5>
                    <Badge className={getStatusColor(optimization.priority)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {optimization.priority} priority
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Current: {showBalance ? formatCurrency(optimization.currentBudget, currency) : '••••••'}</span>
                      <span>Recommended: {showBalance ? formatCurrency(optimization.recommendedBudget, currency) : '••••••'}</span>
                    </div>
                    {optimization.potentialSavings > 0 && (
                      <div className="text-green-600 font-medium mt-1">
                        Potential savings: {showBalance ? formatCurrency(optimization.potentialSavings, currency) : '••••••'} ({savingsPercentage.toFixed(1)}%)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Suggested Budgets */}
        {suggestedBudgets && suggestedBudgets.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Suggested New Budgets</h4>
            {suggestedBudgets.slice(0, 2).map((suggestion: any, index: number) => (
              <div key={`suggestion-${suggestion.categoryName}-${index}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-gray-800">{suggestion.categoryName}</h5>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    <Plus className="h-3 w-3 mr-1" />
                    {suggestion.confidence}% confidence
                  </Badge>
                </div>
                
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Suggested: {showBalance ? formatCurrency(suggestion.suggestedAmount, currency) : '••••••'}</span>
                    <span>Current avg: {showBalance ? formatCurrency(suggestion.currentSpending, currency) : '••••••'}</span>
                  </div>
                  <div className="text-gray-500 mt-1 text-xs">
                    {suggestion.reasoning}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <Button className="w-full" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Apply Recommendations
        </Button>
      </CardContent>
    </Card>
  );
}
