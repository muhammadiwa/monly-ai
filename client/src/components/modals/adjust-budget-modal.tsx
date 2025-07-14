import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingDown, 
  DollarSign, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currencyUtils';

interface BudgetAlert {
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

interface AdjustBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: BudgetAlert | null;
  currency: string;
  onBudgetAdjusted?: () => void;
}

export default function AdjustBudgetModal({ 
  isOpen, 
  onClose, 
  alert, 
  currency, 
  onBudgetAdjusted 
}: AdjustBudgetModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [selectedAction, setSelectedAction] = useState<'increase' | 'decrease' | 'custom'>('increase');

  React.useEffect(() => {
    if (alert && isOpen) {
      setNewBudgetLimit(alert.budgetLimit.toString());
      // Auto-suggest based on forecasted spending
      if (alert.forecastedSpending > alert.budgetLimit) {
        setSelectedAction('increase');
        const suggestedIncrease = Math.ceil(alert.forecastedSpending * 1.1); // 10% buffer
        setNewBudgetLimit(suggestedIncrease.toString());
      }
    }
  }, [alert, isOpen]);

  const handleQuickAdjust = (action: 'increase' | 'decrease', percentage: number) => {
    if (!alert) return;
    
    let newAmount;
    if (action === 'increase') {
      newAmount = alert.budgetLimit * (1 + percentage / 100);
    } else {
      newAmount = alert.budgetLimit * (1 - percentage / 100);
    }
    
    setNewBudgetLimit(Math.round(newAmount).toString());
    setSelectedAction(action);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!alert || !newBudgetLimit) {
      toast({
        title: "Missing Information",
        description: "Please set a new budget amount.",
        variant: "destructive",
      });
      return;
    }

    const budgetAmount = parseFloat(newBudgetLimit);
    if (budgetAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Budget amount must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('auth-token');
      const response = await fetch('/api/budgets/adjust', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          category: alert.category,
          newAmount: budgetAmount,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Budget Updated",
          description: `${alert.category} budget has been adjusted to ${formatCurrency(budgetAmount, currency)}.`,
        });
        
        onBudgetAdjusted?.();
        onClose();
      } else {
        throw new Error(result.message || 'Failed to adjust budget');
      }
    } catch (error) {
      console.error('Error adjusting budget:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to adjust budget. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!alert) return null;

  const newBudgetAmount = parseFloat(newBudgetLimit) || 0;
  const currentUsagePercentage = (alert.currentSpending / alert.budgetLimit) * 100;
  const newUsagePercentage = newBudgetAmount > 0 ? (alert.currentSpending / newBudgetAmount) * 100 : 0;
  const forecastUsagePercentage = newBudgetAmount > 0 ? (alert.forecastedSpending / newBudgetAmount) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Adjust Budget for {alert.category}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Status */}
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-800">Current Status</span>
                  <Badge variant="destructive" className="bg-orange-100 text-orange-800">
                    {Math.round(alert.overBudgetProbability * 100)}% Over Budget Risk
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-orange-600">Current Spending:</span>
                    <div className="font-semibold">{formatCurrency(alert.currentSpending, currency)}</div>
                  </div>
                  <div>
                    <span className="text-orange-600">Current Budget:</span>
                    <div className="font-semibold">{formatCurrency(alert.budgetLimit, currency)}</div>
                  </div>
                  <div>
                    <span className="text-orange-600">Forecasted:</span>
                    <div className="font-semibold">{formatCurrency(alert.forecastedSpending, currency)}</div>
                  </div>
                  <div>
                    <span className="text-orange-600">Days Remaining:</span>
                    <div className="font-semibold">{alert.daysRemaining} days</div>
                  </div>
                </div>

                <Progress value={currentUsagePercentage} className="h-2" />
                <div className="text-xs text-orange-600">
                  {currentUsagePercentage.toFixed(1)}% of current budget used
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Adjust Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick Adjust Options</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={selectedAction === 'increase' ? 'default' : 'outline'}
                onClick={() => handleQuickAdjust('increase', 20)}
                className="h-auto p-3 justify-start"
              >
                <TrendingDown className="h-4 w-4 mr-2 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">Increase 20%</div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(alert.budgetLimit * 1.2, currency)}
                  </div>
                </div>
              </Button>
              
              <Button
                type="button"
                variant={selectedAction === 'increase' && newBudgetAmount === Math.ceil(alert.forecastedSpending * 1.1) ? 'default' : 'outline'}
                onClick={() => {
                  const suggested = Math.ceil(alert.forecastedSpending * 1.1);
                  setNewBudgetLimit(suggested.toString());
                  setSelectedAction('increase');
                }}
                className="h-auto p-3 justify-start"
              >
                <CheckCircle className="h-4 w-4 mr-2 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">Match Forecast</div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(Math.ceil(alert.forecastedSpending * 1.1), currency)}
                  </div>
                </div>
              </Button>
            </div>
          </div>

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label htmlFor="newBudgetLimit" className="text-sm font-medium">
              New Budget Amount
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="newBudgetLimit"
                type="number"
                min="1"
                step="1000"
                value={newBudgetLimit}
                onChange={(e) => {
                  setNewBudgetLimit(e.target.value);
                  setSelectedAction('custom');
                }}
                placeholder="Enter new budget amount"
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Preview */}
          {newBudgetAmount > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-800">New Budget Preview</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {forecastUsagePercentage > 100 ? 'Still Over Budget' : 'Within Budget'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-green-600">New Budget:</span>
                      <div className="font-semibold">{formatCurrency(newBudgetAmount, currency)}</div>
                    </div>
                    <div>
                      <span className="text-green-600">Current Usage:</span>
                      <div className="font-semibold">{newUsagePercentage.toFixed(1)}%</div>
                    </div>
                  </div>

                  <Progress 
                    value={Math.min(newUsagePercentage, 100)} 
                    className="h-2" 
                  />
                  
                  {forecastUsagePercentage <= 100 ? (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Forecasted spending will be within new budget
                    </div>
                  ) : (
                    <div className="text-xs text-orange-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      May still exceed budget by {formatCurrency(alert.forecastedSpending - newBudgetAmount, currency)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !newBudgetLimit || parseFloat(newBudgetLimit) <= 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  Update Budget
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
