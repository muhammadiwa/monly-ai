import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { 
  Brain, 
  Zap,
  Lightbulb,
  AlertTriangle,
  Target
} from 'lucide-react';
import SmartSpendingOpportunities from './smart-spending-opportunities';
import BudgetAlertPredictions from './budget-alert-predictions';
import GoalAchievementForecasts from './goal-achievement-forecasts';

interface AIFinancialIntelligenceProps {
  currency: string;
  showBalance: boolean;
}

export default function AIFinancialIntelligence({ currency, showBalance }: AIFinancialIntelligenceProps) {
  const { data: intelligenceData, isLoading } = useQuery({
    queryKey: ['/api/ai/financial-intelligence'],
    queryFn: () => {
      const authToken = localStorage.getItem('auth-token');
      return fetch('/api/ai/financial-intelligence', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }).then(res => res.json());
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const overallScore = intelligenceData?.success ? intelligenceData.data.overallScore : 0;
  const spendingOpportunities = intelligenceData?.success ? intelligenceData.data.smartSpendingOpportunities?.length || 0 : 0;
  const budgetAlerts = intelligenceData?.success ? intelligenceData.data.budgetAlerts?.length || 0 : 0;
  const goalForecasts = intelligenceData?.success ? intelligenceData.data.goalForecasts?.length || 0 : 0;

  return (
    <div className="space-y-6">
      {/* AI Intelligence Overview */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-600" />
              <span className="text-xl font-bold text-purple-900">AI Financial Intelligence</span>
            </div>
            {!isLoading && (
              <div className="flex items-center gap-2">
                <Badge className={`${getScoreBadgeColor(overallScore)} text-white`}>
                  {getScoreLabel(overallScore)}
                </Badge>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                    {overallScore}
                  </div>
                  <div className="text-xs text-gray-500">AI Score</div>
                </div>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <span className="ml-3 text-gray-600">Analyzing your financial data with AI...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Spending Opportunities */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{spendingOpportunities}</div>
                  <div className="text-sm text-gray-600">Spending Opportunities</div>
                </div>
              </div>

              {/* Budget Alerts */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{budgetAlerts}</div>
                  <div className="text-sm text-gray-600">Budget Alerts</div>
                </div>
              </div>

              {/* Goal Forecasts */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{goalForecasts}</div>
                  <div className="text-sm text-gray-600">Goal Forecasts</div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">AI Insights Powered by Machine Learning</span>
            </div>
            <p className="text-sm text-blue-700">
              Our AI analyzes your spending patterns, predicts budget overruns, and forecasts goal achievements 
              using advanced machine learning algorithms. Get personalized recommendations to optimize your financial health.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Individual AI Components */}
      <div className="space-y-6">
        {/* Smart Spending Opportunities */}
        <SmartSpendingOpportunities 
          currency={currency} 
          showBalance={showBalance} 
        />

        {/* Budget Alert Predictions */}
        <BudgetAlertPredictions 
          currency={currency} 
          showBalance={showBalance} 
        />

        {/* Goal Achievement Forecasts */}
        <GoalAchievementForecasts 
          currency={currency} 
          showBalance={showBalance} 
        />
      </div>
    </div>
  );
}
