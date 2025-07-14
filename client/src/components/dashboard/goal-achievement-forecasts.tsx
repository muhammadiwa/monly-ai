import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { 
  Target, 
  Trophy, 
  Clock, 
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import CreateGoalModal from '@/components/modals/create-goal-modal';

interface GoalAchievementForecast {
  goalId: number;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  expectedSavingPerMonth: number;
  monthsToGoal: number;
  targetMonths: number;
  deviation: number;
  confidence: number;
  status: 'on-track' | 'ahead' | 'behind' | 'at-risk';
  recommendation: string;
}

interface GoalAchievementForecastsProps {
  currency: string;
  showBalance: boolean;
}

export default function GoalAchievementForecasts({ currency, showBalance }: GoalAchievementForecastsProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const { data: forecastData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/ai/goal-forecasts'],
    queryFn: () => {
      const authToken = localStorage.getItem('auth-token');
      return fetch('/api/ai/goal-forecasts', {
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
            <Target className="h-5 w-5 text-purple-500" />
            Goal Achievement Forecasts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !forecastData?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Goal Achievement Forecasts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            <Target className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>Set up financial goals to get AI-powered achievement predictions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const forecasts: GoalAchievementForecast[] = forecastData.data || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ahead': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'on-track': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'behind': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'at-risk': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ahead': return 'bg-green-500';
      case 'on-track': return 'bg-blue-500';
      case 'behind': return 'bg-orange-500';
      case 'at-risk': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ahead': return 'Ahead of Schedule';
      case 'on-track': return 'On Track';
      case 'behind': return 'Behind Schedule';
      case 'at-risk': return 'At Risk';
      default: return 'Unknown';
    }
  };

  const formatMonths = (months: number) => {
    if (months < 1) return `${Math.ceil(months * 30)} days`;
    if (months < 12) return `${months.toFixed(1)} months`;
    const years = Math.floor(months / 12);
    const remainingMonths = Math.floor(months % 12);
    return `${years}y ${remainingMonths}m`;
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Goal Achievement Forecasts
          </div>
          {forecasts.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {forecasts.length} Goal{forecasts.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {forecasts.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Set Your Goals</h3>
            <p className="text-gray-600 mb-4">
              Create financial goals to get AI-powered achievement predictions and personalized recommendations.
            </p>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => setShowCreateModal(true)}>
              <Target className="h-4 w-4 mr-2" />
              Create Goal
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {forecasts.map((forecast) => {
              const progressPercentage = getProgressPercentage(forecast.currentAmount, forecast.targetAmount);
              const remainingAmount = forecast.targetAmount - forecast.currentAmount;
              
              return (
                <div key={forecast.goalId} className="border rounded-lg p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Trophy className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{forecast.goalName}</h3>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(forecast.status)}
                          <Badge 
                            variant="secondary" 
                            className={`${getStatusColor(forecast.status)} text-white text-xs`}
                          >
                            {getStatusLabel(forecast.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-600">
                        {progressPercentage.toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-500">Complete</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">
                        {showBalance ? formatCurrency(forecast.currentAmount, currency) : '••••••'} / {showBalance ? formatCurrency(forecast.targetAmount, currency) : '••••••'}
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-3" />
                    <div className="text-sm text-gray-500">
                      {showBalance ? formatCurrency(remainingAmount, currency) : '••••••'} remaining
                    </div>
                  </div>

                  {/* Timeline Comparison */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-gray-500 mb-1">Target Timeline</div>
                      <div className="font-semibold text-gray-900">
                        {formatMonths(forecast.targetMonths)}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-gray-500 mb-1">AI Prediction</div>
                      <div className={`font-semibold ${forecast.status === 'ahead' ? 'text-green-600' : forecast.status === 'on-track' ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatMonths(forecast.monthsToGoal)}
                      </div>
                    </div>
                  </div>

                  {/* Savings Analysis */}
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Monthly Savings Analysis</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      Based on your current savings rate of {showBalance ? formatCurrency(forecast.expectedSavingPerMonth, currency) : '••••••'}/month, 
                      you're {Math.abs(forecast.deviation) > 1 ? (forecast.deviation > 0 ? `${forecast.deviation.toFixed(1)} months ahead` : `${Math.abs(forecast.deviation).toFixed(1)} months behind`) : 'on track'} of schedule.
                    </div>
                  </div>

                  {/* AI Recommendation */}
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-purple-900 mb-1">AI Recommendation</h4>
                        <p className="text-sm text-purple-700">{forecast.recommendation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Adjust Goal
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 border-green-200 text-green-700 hover:bg-green-50"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Boost Savings
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create Goal Modal */}
      <CreateGoalModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGoalCreated={() => {
          refetch(); // Refresh the forecasts data
        }}
      />
    </Card>
  );
}
