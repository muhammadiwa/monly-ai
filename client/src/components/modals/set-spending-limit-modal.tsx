import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  DollarSign, 
  Bell, 
  AlertTriangle,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, getCurrencySymbol } from '@/lib/currencyUtils';

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

interface SetSpendingLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: BudgetAlert | null;
  currency: string;
  onLimitSet?: () => void;
}

export default function SetSpendingLimitModal({ 
  isOpen, 
  onClose, 
  alert, 
  currency, 
  onLimitSet 
}: SetSpendingLimitModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [limitSettings, setLimitSettings] = useState({
    dailyLimit: '',
    weeklyLimit: '',
    enableDailyAlerts: true,
    enableWeeklyAlerts: true,
    hardLimit: false, // Whether to block transactions when limit is reached
    warningThreshold: 80, // Percentage to trigger warning
  });

  React.useEffect(() => {
    if (alert && isOpen) {
      // Calculate suggested limits based on current budget and remaining days
      const dailySuggestion = Math.floor(alert.budgetLimit / 30); // Assume 30-day month
      const weeklySuggestion = Math.floor(alert.budgetLimit / 4); // 4 weeks per month
      
      setLimitSettings(prev => ({
        ...prev,
        dailyLimit: dailySuggestion.toString(),
        weeklyLimit: weeklySuggestion.toString(),
      }));
    }
  }, [alert, isOpen]);

  const handleQuickSet = (type: 'conservative' | 'moderate' | 'current') => {
    if (!alert) return;
    
    let dailyAmount, weeklyAmount;
    
    switch (type) {
      case 'conservative':
        // 20% below current budget rate
        dailyAmount = Math.floor((alert.budgetLimit / 30) * 0.8);
        weeklyAmount = Math.floor((alert.budgetLimit / 4) * 0.8);
        break;
      case 'moderate':
        // Current budget rate
        dailyAmount = Math.floor(alert.budgetLimit / 30);
        weeklyAmount = Math.floor(alert.budgetLimit / 4);
        break;
      case 'current':
        // Based on current spending rate
        const currentDailyRate = alert.currentSpending / (30 - alert.daysRemaining);
        dailyAmount = Math.floor(currentDailyRate);
        weeklyAmount = Math.floor(currentDailyRate * 7);
        break;
    }
    
    setLimitSettings(prev => ({
      ...prev,
      dailyLimit: dailyAmount.toString(),
      weeklyLimit: weeklyAmount.toString(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!alert) {
      toast({
        title: "Error",
        description: "No budget alert data found.",
        variant: "destructive",
      });
      return;
    }

    const dailyLimit = parseFloat(limitSettings.dailyLimit);
    const weeklyLimit = parseFloat(limitSettings.weeklyLimit);

    if (dailyLimit <= 0 && weeklyLimit <= 0) {
      toast({
        title: "Invalid Limits",
        description: "Please set at least one spending limit.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('auth-token');
      const response = await fetch('/api/budgets/spending-limits', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          category: alert.category,
          dailyLimit: dailyLimit > 0 ? dailyLimit : null,
          weeklyLimit: weeklyLimit > 0 ? weeklyLimit : null,
          enableDailyAlerts: limitSettings.enableDailyAlerts,
          enableWeeklyAlerts: limitSettings.enableWeeklyAlerts,
          hardLimit: limitSettings.hardLimit,
          warningThreshold: limitSettings.warningThreshold,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Spending Limits Set",
          description: `Spending limits have been configured for ${alert.category}.`,
        });
        
        onLimitSet?.();
        onClose();
      } else {
        throw new Error(result.message || 'Failed to set spending limits');
      }
    } catch (error) {
      console.error('Error setting spending limits:', error);
      toast({
        title: "Configuration Failed",
        description: error instanceof Error ? error.message : "Failed to set spending limits. Please try again.",
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

  const dailyLimitAmount = parseFloat(limitSettings.dailyLimit) || 0;
  const weeklyLimitAmount = parseFloat(limitSettings.weeklyLimit) || 0;
  const currentDailyRate = alert.currentSpending / (30 - alert.daysRemaining);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Set Spending Limits for {alert.category}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Spending Pattern */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">Current Spending Pattern</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Analysis
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600">Daily Average:</span>
                    <div className="font-semibold">{formatCurrency(currentDailyRate, currency)}</div>
                  </div>
                  <div>
                    <span className="text-blue-600">Weekly Estimate:</span>
                    <div className="font-semibold">{formatCurrency(currentDailyRate * 7, currency)}</div>
                  </div>
                  <div>
                    <span className="text-blue-600">Monthly Budget:</span>
                    <div className="font-semibold">{formatCurrency(alert.budgetLimit, currency)}</div>
                  </div>
                  <div>
                    <span className="text-blue-600">Days Remaining:</span>
                    <div className="font-semibold">{alert.daysRemaining} days</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Preset Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick Preset Limits</Label>
            <div className="grid grid-cols-3 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickSet('conservative')}
                className="h-auto p-3 justify-start"
              >
                <Shield className="h-4 w-4 mr-2 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">Conservative</div>
                  <div className="text-xs text-gray-500">20% below budget</div>
                </div>
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickSet('moderate')}
                className="h-auto p-3 justify-start"
              >
                <CheckCircle className="h-4 w-4 mr-2 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">Moderate</div>
                  <div className="text-xs text-gray-500">Match budget</div>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleQuickSet('current')}
                className="h-auto p-3 justify-start"
              >
                <Calendar className="h-4 w-4 mr-2 text-orange-600" />
                <div className="text-left">
                  <div className="font-medium">Current Rate</div>
                  <div className="text-xs text-gray-500">Based on usage</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Custom Limits */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Custom Spending Limits</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyLimit" className="text-sm">Daily Limit</Label>
                <div className="relative">
                  {getCurrencySymbol(currency) === '$' ? (
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  ) : (
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400 font-medium">
                      {getCurrencySymbol(currency)}
                    </span>
                  )}
                  <Input
                    id="dailyLimit"
                    type="number"
                    min="0"
                    value={limitSettings.dailyLimit}
                    onChange={(e) => setLimitSettings(prev => ({ ...prev, dailyLimit: e.target.value }))}
                    placeholder="Daily spending limit"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weeklyLimit" className="text-sm">Weekly Limit</Label>
                <div className="relative">
                  {getCurrencySymbol(currency) === '$' ? (
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  ) : (
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400 font-medium">
                      {getCurrencySymbol(currency)}
                    </span>
                  )}
                  <Input
                    id="weeklyLimit"
                    type="number"
                    min="0"
                    value={limitSettings.weeklyLimit}
                    onChange={(e) => setLimitSettings(prev => ({ ...prev, weeklyLimit: e.target.value }))}
                    placeholder="Weekly spending limit"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Alert Settings */}
          <Card className="border-gray-200">
            <CardContent className="pt-4">
              <div className="space-y-4">
                <Label className="text-sm font-medium">Alert Settings</Label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Daily Alerts</Label>
                      <p className="text-xs text-gray-500">Get notified when approaching daily limit</p>
                    </div>
                    <Switch
                      checked={limitSettings.enableDailyAlerts}
                      onCheckedChange={(checked) => setLimitSettings(prev => ({ ...prev, enableDailyAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Weekly Alerts</Label>
                      <p className="text-xs text-gray-500">Get notified when approaching weekly limit</p>
                    </div>
                    <Switch
                      checked={limitSettings.enableWeeklyAlerts}
                      onCheckedChange={(checked) => setLimitSettings(prev => ({ ...prev, enableWeeklyAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Hard Limit</Label>
                      <p className="text-xs text-gray-500">Block transactions when limit is reached</p>
                    </div>
                    <Switch
                      checked={limitSettings.hardLimit}
                      onCheckedChange={(checked) => setLimitSettings(prev => ({ ...prev, hardLimit: checked }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warningThreshold" className="text-sm">Warning Threshold (%)</Label>
                  <Input
                    id="warningThreshold"
                    type="number"
                    min="50"
                    max="95"
                    step="5"
                    value={limitSettings.warningThreshold}
                    onChange={(e) => setLimitSettings(prev => ({ ...prev, warningThreshold: parseInt(e.target.value) }))}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    Get warnings when spending reaches {limitSettings.warningThreshold}% of limit
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {(dailyLimitAmount > 0 || weeklyLimitAmount > 0) && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-800">Limit Preview</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {dailyLimitAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-green-600">Daily Limit:</span>
                        <span className="font-semibold">{formatCurrency(dailyLimitAmount, currency)}</span>
                      </div>
                    )}
                    {weeklyLimitAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-green-600">Weekly Limit:</span>
                        <span className="font-semibold">{formatCurrency(weeklyLimitAmount, currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-green-600">Warning at:</span>
                      <span className="font-semibold">{limitSettings.warningThreshold}% of limit</span>
                    </div>
                  </div>

                  <div className="text-xs text-green-600 flex items-center gap-1">
                    <Bell className="h-3 w-3" />
                    You'll receive alerts based on your settings
                  </div>
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
              disabled={isLoading || (parseFloat(limitSettings.dailyLimit) <= 0 && parseFloat(limitSettings.weeklyLimit) <= 0)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting Limits...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Set Spending Limits
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
