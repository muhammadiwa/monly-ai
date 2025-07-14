import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Target, DollarSign, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated?: () => void;
}

export default function CreateGoalModal({ isOpen, onClose, onGoalCreated }: CreateGoalModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '0',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.targetAmount || !formData.deadline) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields (name, target amount, and deadline).",
        variant: "destructive",
      });
      return;
    }

    const targetAmount = parseFloat(formData.targetAmount);
    const currentAmount = parseFloat(formData.currentAmount) || 0;

    if (targetAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Target amount must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (currentAmount >= targetAmount) {
      toast({
        title: "Goal Already Achieved",
        description: "Current amount cannot be greater than or equal to target amount.",
        variant: "destructive",
      });
      return;
    }

    if (formData.deadline <= new Date()) {
      toast({
        title: "Invalid Deadline",
        description: "Deadline must be in the future.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const authToken = localStorage.getItem('auth-token');
      const response = await fetch('/api/goals', {
        method: 'POST',
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
          title: "Goal Created!",
          description: `"${formData.name}" has been added to your financial goals.`,
        });
        
        // Reset form
        setFormData({
          name: '',
          targetAmount: '',
          currentAmount: '0',
          deadline: undefined,
          category: '',
          description: ''
        });
        
        onGoalCreated?.();
        onClose();
      } else {
        throw new Error(result.message || 'Failed to create goal');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create goal. Please try again.",
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Create Financial Goal
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Goal Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Goal Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Emergency Fund, Vacation to Japan"
              className="w-full"
              disabled={isLoading}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">Category</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category">
                  {selectedCategory && (
                    <div className="flex items-center gap-2">
                      <span>{selectedCategory.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {goalCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    <div className="flex flex-col">
                      <span>{category.label}</span>
                      <span className="text-xs text-gray-500">{category.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetAmount" className="text-sm font-medium">
                Target Amount <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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

            <div className="space-y-2">
              <Label htmlFor="currentAmount" className="text-sm font-medium">Current Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-3">
            <Label htmlFor="goalDeadline" className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
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
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-800">Goal Timeline</span>
                </div>
                <p className="text-sm text-purple-700">
                  Target date: <span className="font-semibold">{format(formData.deadline, "EEEE, MMMM do, yyyy")}</span>
                </p>
                <p className="text-xs text-purple-600 mt-1">
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
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add details about your goal, motivation, or specific plans..."
              className="w-full resize-none"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Preview */}
          {formData.targetAmount && formData.currentAmount && (
            <div className="bg-purple-50 p-4 rounded-lg space-y-2">
              <h4 className="text-sm font-medium text-purple-900 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Goal Preview
              </h4>
              <div className="text-sm text-purple-700">
                <p>Amount needed: <span className="font-semibold">${(parseFloat(formData.targetAmount) - parseFloat(formData.currentAmount || '0')).toLocaleString()}</span></p>
                {formData.deadline && (
                  <p>Time remaining: <span className="font-semibold">
                    {Math.ceil((formData.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))} months
                  </span></p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Create Goal
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
