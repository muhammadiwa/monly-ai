import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getUserCurrency, getCurrencySymbol } from '@/lib/currencyUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Target, DollarSign, Clock, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: number; // Unix timestamp
  category: string;
  description: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  onGoalUpdated?: () => void;
}

export default function EditGoalModal({ isOpen, onClose, goal, onGoalUpdated }: EditGoalModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Get user preferences for currency formatting
  const { data: userPreferences } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/preferences');
      return response;
    },
    enabled: isOpen,
  });
  
  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    deadline: undefined as Date | undefined,
    category: '',
    description: ''
  });

  const goalCategories = [
    { value: 'emergency', label: '🆘 Emergency Fund', description: 'Build financial safety net' },
    { value: 'vacation', label: '🏖️ Vacation', description: 'Save for travel and leisure' },
    { value: 'house', label: '🏠 House Down Payment', description: 'Save for home purchase' },
    { value: 'car', label: '🚗 Vehicle', description: 'Save for car purchase or upgrade' },
    { value: 'education', label: '🎓 Education', description: 'Save for courses or degree' },
    { value: 'wedding', label: '💒 Wedding', description: 'Save for wedding expenses' },
    { value: 'retirement', label: '🏖️ Retirement', description: 'Long-term retirement savings' },
    { value: 'investment', label: '📈 Investment', description: 'Capital for investment opportunities' },
    { value: 'business', label: '💼 Business', description: 'Start or expand business' },
    { value: 'gadget', label: '💻 Electronics', description: 'Save for gadgets or tech' },
    { value: 'other', label: '🎯 Other', description: 'Custom financial goal' }
  ];

  useEffect(() => {
    if (goal && isOpen) {
      setFormData({
        name: goal.name,
        targetAmount: goal.targetAmount.toString(),
        currentAmount: goal.currentAmount.toString(),
        deadline: new Date(goal.deadline * 1000),
        category: goal.category,
        description: goal.description
      });
    }
  }, [goal, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.targetAmount || !formData.deadline || !goal) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const targetAmount = parseFloat(formData.targetAmount);
    const currentAmount = parseFloat(formData.currentAmount) || 0;

    if (targetAmount <= 0) {
      toast({
        title: "Invalid Target Amount",
        description: "Target amount must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (currentAmount < 0) {
      toast({
        title: "Invalid Current Amount",
        description: "Current amount cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    if (currentAmount > targetAmount) {
      toast({
        title: "Invalid Amount",
        description: "Current amount cannot be greater than target amount.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('auth-token');
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: formData.name,
          targetAmount: targetAmount,
          currentAmount: currentAmount,
          deadline: Math.floor(formData.deadline.getTime() / 1000), // Unix timestamp
          category: formData.category || 'other',
          description: formData.description
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Goal Updated",
          description: `"${formData.name}" has been successfully updated.`,
        });
        
        onGoalUpdated?.();
        onClose();
      } else {
        throw new Error(result.message || 'Failed to update goal');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update goal. Please try again.",
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

  const selectedCategory = goalCategories.find(cat => cat.value === formData.category);
  const progress = formData.targetAmount ? (parseFloat(formData.currentAmount) || 0) / parseFloat(formData.targetAmount) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Edit Financial Goal
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Goal Name */}
            <div className="space-y-2">
              <Label htmlFor="goalName" className="text-sm font-medium">
                Goal Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="goalName"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Emergency Fund"
                disabled={isLoading}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="goalCategory" className="text-sm font-medium">Goal Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {goalCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div>
                        <div className="font-medium">{category.label}</div>
                        <div className="text-xs text-gray-500">{category.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory && (
                <p className="text-xs text-gray-500">{selectedCategory.description}</p>
              )}
            </div>

            {/* Target Amount */}
            <div className="space-y-2">
              <Label htmlFor="targetAmount" className="text-sm font-medium">
                Target Amount <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                {getCurrencySymbol(getUserCurrency(userPreferences)) === '$' ? 
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /> :
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400">
                    {getCurrencySymbol(getUserCurrency(userPreferences))}
                  </span>
                }
                <Input
                  id="targetAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetAmount: e.target.value }))}
                  placeholder="10000"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Current Amount */}
            <div className="space-y-2">
              <Label htmlFor="currentAmount" className="text-sm font-medium">Current Amount</Label>
              <div className="relative">
                {getCurrencySymbol(getUserCurrency(userPreferences)) === '$' ? 
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /> :
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400">
                    {getCurrencySymbol(getUserCurrency(userPreferences))}
                  </span>
                }
                <Input
                  id="currentAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.currentAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentAmount: e.target.value }))}
                  placeholder="0"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {progress > 0 && (
                <div className="text-xs text-gray-500">
                  Progress: {progress.toFixed(1)}% of target
                </div>
              )}
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label htmlFor="goalDeadline" className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Target Deadline <span className="text-red-500">*</span>
              </Label>
              <DatePicker
                date={formData.deadline}
                onDateChange={(date) => setFormData(prev => ({ ...prev, deadline: date }))}
                placeholder="Select your target deadline"
                className="w-full"
                disabled={isLoading}
                disablePast={true}
              />
              {formData.deadline && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Updated Timeline</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Target date: <span className="font-semibold">{format(formData.deadline, "EEEE, MMMM do, yyyy")}</span>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {(() => {
                      const now = new Date()
                      const days = Math.ceil((formData.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      const months = Math.ceil(days / 30)
                      
                      if (days <= 0) return "⚠️ This date has already passed"
                      if (days <= 30) return `⚡ ${days} days from now - Short term goal`
                      if (days <= 365) return `📅 ${months} months from now - Medium term goal`
                      return `🎯 ${Math.ceil(days / 365)} years from now - Long term goal`
                    })()}
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="goalDescription" className="text-sm font-medium">Description</Label>
              <Textarea
                id="goalDescription"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your goal and why it's important to you..."
                className="resize-none"
                rows={3}
                disabled={isLoading}
              />
            </div>
          </div>

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
              disabled={isLoading || !formData.name || !formData.targetAmount || !formData.deadline}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Goal
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
