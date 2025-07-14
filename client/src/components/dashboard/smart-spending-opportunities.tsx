import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingDown, 
  Lightbulb, 
  DollarSign, 
  Target,
  CheckCircle,
  Info
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';

interface SmartSpendingOpportunity {
  category: string;
  currentSpending: number;
  recommendedSpending: number;
  potentialSaving: number;
  savingPercentage: number;
  confidence: number;
  reasoning: string;
  actionableTips: string[];
}

interface SmartSpendingOpportunitiesProps {
  currency: string;
  showBalance: boolean;
}

export default function SmartSpendingOpportunities({ currency, showBalance }: SmartSpendingOpportunitiesProps) {
  const { data: spendingData, isLoading, error } = useQuery({
    queryKey: ['/api/ai/spending-opportunities'],
    queryFn: () => {
      const authToken = localStorage.getItem('auth-token');
      return fetch('/api/ai/spending-opportunities', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }).then(res => res.json());
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Smart Spending Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !spendingData?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Smart Spending Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            <Info className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>AI analysis will be available after you have more transaction data.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const opportunities: SmartSpendingOpportunity[] = spendingData.data || [];

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const getTotalPotentialSaving = () => {
    return opportunities.reduce((total, opp) => total + opp.potentialSaving, 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Smart Spending Opportunities
          </CardTitle>
          {opportunities.length > 0 && (
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Potential Saving</div>
              <div className="text-lg font-bold text-green-600">
                {showBalance ? formatCurrency(getTotalPotentialSaving(), currency) : '••••••'}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Great Job!</h3>
            <p className="text-gray-600">
              Your spending patterns look optimized. No significant saving opportunities detected at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {opportunities.map((opportunity) => (
              <div key={`opportunity-${opportunity.category}`} className="border rounded-lg p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{opportunity.category}</h3>
                      <Badge 
                        variant="secondary" 
                        className={`${getConfidenceColor(opportunity.confidence)} text-white text-xs`}
                      >
                        {getConfidenceLabel(opportunity.confidence)}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {showBalance ? formatCurrency(opportunity.potentialSaving, currency) : '••••••'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {opportunity.savingPercentage.toFixed(1)}% potential saving
                    </div>
                  </div>
                </div>

                {/* Spending Comparison */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Current Spending</span>
                    <div className="font-semibold text-red-600">
                      {showBalance ? formatCurrency(opportunity.currentSpending, currency) : '••••••'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Recommended</span>
                    <div className="font-semibold text-green-600">
                      {showBalance ? formatCurrency(opportunity.recommendedSpending, currency) : '••••••'}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Recommended</span>
                    <span>Current</span>
                  </div>
                  <Progress 
                    value={(opportunity.recommendedSpending / opportunity.currentSpending) * 100} 
                    className="h-2"
                  />
                </div>

                {/* AI Reasoning */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 mb-1">AI Analysis</h4>
                      <p className="text-sm text-blue-700">{opportunity.reasoning}</p>
                    </div>
                  </div>
                </div>

                {/* Actionable Tips */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    Actionable Tips
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {opportunity.actionableTips.map((tip, tipIndex) => (
                      <li key={`tip-${opportunity.category}-${tipIndex}`} className="flex items-start gap-2">
                        <span className="inline-block w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Set Budget Goal for {opportunity.category}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
