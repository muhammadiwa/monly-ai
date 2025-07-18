import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  Target, 
  Calendar,
  DollarSign,
  Trash2
} from 'lucide-react';
import { formatCurrency, getUserCurrency } from '@/lib/currencyUtils';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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

interface DeleteGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal | null;
  onConfirmDelete: () => void;
  isDeleting?: boolean;
}

export default function DeleteGoalModal({
  isOpen,
  onClose,
  goal,
  onConfirmDelete,
  isDeleting = false
}: DeleteGoalModalProps) {
  // Get user preferences for currency formatting
  const { data: userPreferences } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/preferences');
      return response;
    },
    enabled: isOpen,
  });
  
  if (!goal) return null;

  const progress = (goal.currentAmount / goal.targetAmount) * 100;
  const deadline = new Date(goal.deadline * 1000);
  const userCurrency = getUserCurrency(userPreferences);
  const now = new Date();
  const isOverdue = deadline < now;
  const isCompleted = progress >= 100;

  const getCategoryEmoji = (category: string) => {
    const categoryMap: Record<string, string> = {
      'emergency': '🆘',
      'vacation': '🏖️',
      'house': '🏠',
      'car': '🚗',
      'education': '🎓',
      'wedding': '💒',
      'retirement': '🏖️',
      'investment': '📈',
      'business': '💼',
      'gadget': '💻',
      'other': '🎯'
    };
    return categoryMap[category] || '🎯';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Goal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Message */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 mb-1">
                  Are you sure you want to delete this goal?
                </h3>
                <p className="text-sm text-red-700">
                  This action cannot be undone. All progress and data associated with this goal will be permanently removed.
                </p>
              </div>
            </div>
          </div>

          {/* Goal Details */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">{goal.name}</h3>
                  </div>
                  {goal.description && (
                    <p className="text-sm text-gray-600 mb-2">{goal.description}</p>
                  )}
                  <Badge className="text-xs bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors px-2 py-1 flex items-center gap-1.5 font-medium border-0">
                    <span className="text-base leading-none">{getCategoryEmoji(goal.category)}</span>
                    <span>{goal.category === 'gadget' ? 'Electronics' : goal.category.charAt(0).toUpperCase() + goal.category.slice(1)}</span>
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">
                    {progress.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500">Complete</div>
                </div>
              </div>

              {/* Progress */}
              <div>
                <Progress value={Math.min(progress, 100)} className="h-2 mb-2" />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progress</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
              </div>

              {/* Financial Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-1 text-gray-600 mb-1">
                    <DollarSign className="h-3 w-3" />
                    Current Amount
                  </div>
                  <div className="font-semibold">
                    {formatCurrency(goal.currentAmount, userCurrency)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-gray-600 mb-1">
                    <Target className="h-3 w-3" />
                    Target Amount
                  </div>
                  <div className="font-semibold">
                    {formatCurrency(goal.targetAmount, userCurrency)}
                  </div>
                </div>
              </div>

              {/* Deadline */}
              <div className="text-sm">
                <div className="flex items-center gap-1 text-gray-600 mb-1">
                  <Calendar className="h-3 w-3" />
                  Deadline
                </div>
                <div className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {format(deadline, 'MMMM dd, yyyy')}
                  {isOverdue && !isCompleted && (
                    <span className="text-red-600 ml-2">(Overdue)</span>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex justify-end">
                <Badge 
                  className={
                    isCompleted 
                      ? 'bg-green-100 text-green-800' 
                      : isOverdue 
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                  }
                >
                  {isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'Active'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Special Warnings */}
          {isCompleted && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  This is a completed goal with {formatCurrency(goal.currentAmount, userCurrency)} saved.
                </span>
              </div>
            </div>
          )}

          {goal.currentAmount > 0 && !isCompleted && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-800">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">
                  You have {formatCurrency(goal.currentAmount, userCurrency)} progress towards this goal.
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Goal
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
