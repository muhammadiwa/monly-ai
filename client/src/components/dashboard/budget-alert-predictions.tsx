import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { 
  AlertTriangle, 
  Shield, 
  Clock, 
  TrendingUp,
  CheckCircle,
  Calendar,
  Target
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';

interface BudgetAlertPrediction {
  category: string;
  currentSpending: number;
  budgetLimit: number;
  forecastedSpending: number;
  overBudgetAmount: number;
  overBudgetProbability: number;
  confidence: number;
  daysRemaining: number;
  recommendation: string;
}

interface BudgetAlertPredictionsProps {
  currency: string;
  showBalance: boolean;
}

export default function BudgetAlertPredictions({ currency, showBalance }: BudgetAlertPredictionsProps) {
  const { data: alertData, isLoading, error } = useQuery({
    queryKey: ['/api/ai/budget-alerts'],
    queryFn: () => {
      const authToken = localStorage.getItem('auth-token');
      return fetch('/api/ai/budget-alerts', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }).then(res => res.json());
    },
    // refetchInterval: 300000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Budget Alert Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !alertData?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Budget Alert Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            <Shield className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>Set up budgets to get AI-powered overspending predictions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const alerts: BudgetAlertPrediction[] = alertData.data || [];

  const getRiskLevel = (probability: number) => {
    if (probability >= 0.8) return { level: 'High Risk', color: 'bg-red-500', textColor: 'text-red-700' };
    if (probability >= 0.5) return { level: 'Medium Risk', color: 'bg-orange-500', textColor: 'text-orange-700' };
    return { level: 'Low Risk', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
  };

  const getSpendingPercentage = (current: number, budget: number) => {
    return (current / budget) * 100;
  };

  const getForecastPercentage = (forecast: number, budget: number) => {
    return (forecast / budget) * 100;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Budget Alert Predictions
          </div>
          {alerts.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Good!</h3>
            <p className="text-gray-600">
              You're on track with your budgets. No overspending predicted for this month.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const risk = getRiskLevel(alert.overBudgetProbability);
              const currentPercentage = getSpendingPercentage(alert.currentSpending, alert.budgetLimit);
              const forecastPercentage = getForecastPercentage(alert.forecastedSpending, alert.budgetLimit);
              
              return (
                <div key={alert.category} className="border rounded-lg p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${risk.color === 'bg-red-500' ? 'bg-red-100' : risk.color === 'bg-orange-500' ? 'bg-orange-100' : 'bg-yellow-100'}`}>
                        <AlertTriangle className={`h-5 w-5 ${risk.color === 'bg-red-500' ? 'text-red-600' : risk.color === 'bg-orange-500' ? 'text-orange-600' : 'text-yellow-600'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{alert.category}</h3>
                        <Badge 
                          variant="secondary" 
                          className={`${risk.color} text-white text-xs`}
                        >
                          {risk.level} ({(alert.overBudgetProbability * 100).toFixed(0)}%)
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {alert.daysRemaining} days left
                      </div>
                    </div>
                  </div>

                  {/* Budget Progress */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Spending</span>
                      <span className="font-medium">
                        {showBalance ? formatCurrency(alert.currentSpending, currency) : '••••••'} 
                        <span className={`ml-1 ${risk.textColor}`}>
                          ({currentPercentage.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    
                    <Progress value={currentPercentage} className="h-2" />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Budget Limit</span>
                      <span className="font-medium">
                        {showBalance ? formatCurrency(alert.budgetLimit, currency) : '••••••'}
                      </span>
                    </div>
                  </div>

                  {/* Forecast */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-900">Predicted End-of-Month</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-lg font-bold text-red-700">
                          {showBalance ? formatCurrency(alert.forecastedSpending, currency) : '••••••'}
                        </div>
                        <div className="text-sm text-red-600">
                          {forecastPercentage.toFixed(0)}% of budget
                        </div>
                      </div>
                      {alert.overBudgetAmount > 0 && (
                        <div className="text-right">
                          <div className="text-sm text-red-600">Over budget by</div>
                          <div className="font-bold text-red-700">
                            {showBalance ? formatCurrency(alert.overBudgetAmount, currency) : '••••••'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Recommendation */}
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-900 mb-1">AI Recommendation</h4>
                        <p className="text-sm text-blue-700">{alert.recommendation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Adjust Budget
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 border-green-200 text-green-700 hover:bg-green-50"
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Set Spending Limit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
