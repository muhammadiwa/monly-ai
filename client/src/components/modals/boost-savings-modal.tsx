import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addMonths } from 'date-fns';
import { 
  DollarSign, 
  TrendingUp, 
  ArrowRight, 
  Calculator,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currencyUtils';

interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: number; // Unix timestamp
  category: string;
}

interface GoalAchievementForecast {
  goalId: number;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  expectedSavingPerMonth: number;
  monthsToGoal: number;
  targetMonths: number;
  deviation: number;
  status: 'on-track' | 'ahead' | 'behind' | 'at-risk';
}

interface BoostSavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  forecast: GoalAchievementForecast | null;
  currency: string;
  onBoostSaved: () => void;
}

export default function BoostSavingsModal({
  isOpen,
  onClose,
  goal,
  forecast,
  currency,
  onBoostSaved,
}: BoostSavingsModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [savingsStrategy, setSavingsStrategy] = useState('monthly');
  const [additionalAmount, setAdditionalAmount] = useState('');
  const [extraBoostAmount, setExtraBoostAmount] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState('monthly');

  // Recalculate with new savings rate
  const calculateNewTimeline = () => {
    if (!goal || !forecast) return { months: 0, date: new Date() };
    
    const remainingAmount = goal.targetAmount - goal.currentAmount;
    const additionalMonthly = parseFloat(additionalAmount) || 0;
    const extraBoost = parseFloat(extraBoostAmount) || 0;
    
    const newMonthlySavings = forecast.expectedSavingPerMonth + additionalMonthly;
    const adjustedRemaining = remainingAmount - extraBoost;
    
    if (newMonthlySavings <= 0) return { months: 999, date: new Date(9999, 0, 1) };
    
    const newMonthsToGoal = adjustedRemaining / newMonthlySavings;
    const newTargetDate = addMonths(new Date(), Math.ceil(newMonthsToGoal));
    
    return { months: newMonthsToGoal, date: newTargetDate };
  };
  
  const newTimeline = calculateNewTimeline();
  const timeReduction = forecast ? forecast.monthsToGoal - newTimeline.months : 0;
  
  const formatMonths = (months: number) => {
    if (months < 1) return `${Math.ceil(months * 30)} days`;
    if (months < 12) return `${months.toFixed(1)} months`;
    const years = Math.floor(months / 12);
    const remainingMonths = Math.floor(months % 12);
    return `${years} ${years === 1 ? 'year' : 'years'} ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!goal) {
      toast({
        title: "Error",
        description: "No goal data found.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Handle one-time boost to current amount
      if (parseFloat(extraBoostAmount) > 0) {
        const authToken = localStorage.getItem('auth-token');
        console.log('Sending boost request to goal ID:', goal.id, 'with amount:', parseFloat(extraBoostAmount));
        
        try {
          const boostResponse = await fetch(`/api/goals/${goal.id}/boost`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'X-API-Request': 'true'
            },
            body: JSON.stringify({
              boostAmount: parseFloat(extraBoostAmount),
            }),
          });

          console.log('Boost response status:', boostResponse.status);
          const responseText = await boostResponse.text();
          console.log('Boost raw response:', responseText);
          
          if (!boostResponse.ok) {
            let errorMsg = 'Failed to boost goal';
            try {
              const error = JSON.parse(responseText);
              errorMsg = error.message || errorMsg;
            } catch (e) {
              console.error('Error parsing boost error response:', e);
            }
            throw new Error(errorMsg);
          }
        } catch (err) {
          console.error('Error during boost request:', err);
          throw err;
        }
      }

      // Handle recurring savings plan
      if (parseFloat(additionalAmount) > 0) {
        const authToken = localStorage.getItem('auth-token');
        console.log('Sending savings plan request to goal ID:', goal.id, 'with amount:', parseFloat(additionalAmount), 'frequency:', recurringFrequency);
        
        try {
          const savingsPlanResponse = await fetch(`/api/goals/${goal.id}/savings-plan`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'X-API-Request': 'true'
            },
            body: JSON.stringify({
              additionalAmount: parseFloat(additionalAmount),
              frequency: recurringFrequency,
              isActive: true,
            }),
          });

          console.log('Savings plan response status:', savingsPlanResponse.status);
          const responseText = await savingsPlanResponse.text();
          console.log('Savings plan raw response:', responseText);
          
          if (!savingsPlanResponse.ok) {
            let errorMsg = 'Failed to set up savings plan';
            try {
              const error = JSON.parse(responseText);
              errorMsg = error.message || errorMsg;
            } catch (e) {
              console.error('Error parsing savings plan error response:', e);
            }
            throw new Error(errorMsg);
          }
        } catch (err) {
          console.error('Error during savings plan request:', err);
          throw err;
        }
      }

      toast({
        title: "Savings Boosted",
        description: `Your savings strategy for ${goal.name} has been updated.`,
      });
      
      onBoostSaved();
      onClose();
    } catch (error) {
      console.error('Error boosting savings:', error);
      toast({
        title: "Failed to Update Savings",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!goal || !forecast) return null;

  const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
  const remainingAmount = goal.targetAmount - goal.currentAmount;

  return (
    <Dialog open={isOpen} onOpenChange={() => !isLoading && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Boost Savings for {goal.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900">Current Progress</h3>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">
                    {formatCurrency(goal.currentAmount, currency)} / {formatCurrency(goal.targetAmount, currency)}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2 mt-1" />
                <div className="text-sm text-gray-500 mt-1">
                  {formatCurrency(remainingAmount, currency)} remaining
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 mb-1">Current Timeline</div>
                  <div className="font-semibold text-gray-900">
                    {formatMonths(forecast.monthsToGoal)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    at {formatCurrency(forecast.expectedSavingPerMonth, currency)}/month
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500 mb-1">Target Timeline</div>
                  <div className="font-semibold text-gray-900">
                    {formatMonths(forecast.targetMonths)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(() => {
                      if (forecast.deviation > 0) {
                        return (
                          <span className="text-green-600">
                            {Math.abs(forecast.deviation).toFixed(1)} months ahead
                          </span>
                        );
                      } else if (forecast.deviation < 0) {
                        return (
                          <span className="text-red-600">
                            {Math.abs(forecast.deviation).toFixed(1)} months behind
                          </span>
                        );
                      } else {
                        return <span>on track</span>;
                      }
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Boost Options */}
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-900">Boost Your Savings</h3>
              <Select
                value={savingsStrategy}
                onValueChange={setSavingsStrategy}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Increase Monthly</SelectItem>
                  <SelectItem value="oneTime">One-Time Boost</SelectItem>
                  <SelectItem value="combined">Combined Strategy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(savingsStrategy === 'monthly' || savingsStrategy === 'combined') && (
              <div className="space-y-3">
                <Label htmlFor="additionalAmount">Increase Monthly Savings</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="additionalAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(e.target.value)}
                    placeholder="Additional amount per month"
                    className="pl-10"
                  />
                </div>
                <Select
                  value={recurringFrequency}
                  onValueChange={setRecurringFrequency}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm text-gray-600">
                  New monthly savings: {formatCurrency(forecast.expectedSavingPerMonth + (parseFloat(additionalAmount) || 0), currency)}
                </div>
              </div>
            )}

            {(savingsStrategy === 'oneTime' || savingsStrategy === 'combined') && (
              <div className="space-y-3">
                <Label htmlFor="extraBoostAmount">One-Time Contribution</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="extraBoostAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraBoostAmount}
                    onChange={(e) => setExtraBoostAmount(e.target.value)}
                    placeholder="One-time contribution amount"
                    className="pl-10"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  New current amount: {formatCurrency(goal.currentAmount + (parseFloat(extraBoostAmount) || 0), currency)}
                </div>
              </div>
            )}
          </div>

          {/* New Timeline Preview */}
          {(parseFloat(additionalAmount) > 0 || parseFloat(extraBoostAmount) > 0) && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 space-y-3">
                <h3 className="font-semibold text-green-800 flex items-center">
                  <Calculator className="h-4 w-4 mr-2" />
                  New Timeline Calculation
                </h3>
                
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-lg flex-1 text-center">
                    <div className="text-sm text-gray-500 mb-1">Current Timeline</div>
                    <div className="font-semibold text-gray-900">
                      {formatMonths(forecast.monthsToGoal)}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-green-500" />
                  <div className="p-3 bg-white rounded-lg flex-1 text-center">
                    <div className="text-sm text-gray-500 mb-1">New Timeline</div>
                    <div className="font-semibold text-green-700">
                      {formatMonths(newTimeline.months)}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      <span className="text-gray-500">New target date:</span>
                      <div className="font-medium">{format(newTimeline.date, "MMMM d, yyyy")}</div>
                    </div>
                    <div className="text-sm text-right">
                      <span className="text-gray-500">Time saved:</span>
                      <div className="font-medium text-green-700">
                        {timeReduction > 0 ? formatMonths(timeReduction) : "No change"}
                      </div>
                    </div>
                  </div>
                </div>

                {timeReduction > 0 && (
                  <div className="text-sm text-green-700 flex items-center">
                    <Target className="h-4 w-4 mr-1" />
                    You'll reach your goal {(timeReduction / forecast.monthsToGoal * 100).toFixed(0)}% faster!
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading || 
                (parseFloat(additionalAmount) <= 0 && parseFloat(extraBoostAmount) <= 0)
              }
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Boost Savings
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
