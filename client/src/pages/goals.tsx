import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { 
  Target, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Search
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { format } from 'date-fns';
import CreateGoalModal from '@/components/modals/create-goal-modal';
import EditGoalModal from '@/components/modals/edit-goal-modal';
import DeleteGoalModal from '@/components/modals/delete-goal-modal';
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

interface GoalsPageProps {
  currency: string;
  showBalance: boolean;
}

export default function GoalsPage({ currency, showBalance }: GoalsPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');

  // Fetch goals
  const { data: goals = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/goals'],
    queryFn: () => {
      const authToken = localStorage.getItem('auth-token');
      return fetch('/api/goals', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }).then(res => res.json());
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: number) => {
      const authToken = localStorage.getItem('auth-token');
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to delete goal');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      toast({
        title: "Goal Deleted",
        description: "Goal has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete goal.",
        variant: "destructive",
      });
    },
  });

  const getGoalStatus = (goal: Goal) => {
    const now = Date.now();
    const deadline = goal.deadline * 1000;
    const progress = (goal.currentAmount / goal.targetAmount) * 100;
    
    if (progress >= 100) return 'completed';
    if (deadline < now) return 'overdue';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      case 'active': return <Clock className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const filteredGoals = goals.filter((goal: Goal) => {
    const matchesSearch = goal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         goal.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterStatus === 'all') return true;
    
    const status = getGoalStatus(goal);
    return status === filterStatus;
  });

  const handleEditGoal = (goal: Goal) => {
    setSelectedGoal(goal);
    setShowEditModal(true);
  };

  const handleDeleteGoal = (goal: Goal) => {
    setSelectedGoal(goal);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedGoal) {
      deleteGoalMutation.mutate(selectedGoal.id);
      setShowDeleteModal(false);
      setSelectedGoal(null);
    }
  };

  const totalGoals = goals.length;
  const completedGoals = goals.filter((goal: Goal) => getGoalStatus(goal) === 'completed').length;
  const activeGoals = goals.filter((goal: Goal) => getGoalStatus(goal) === 'active').length;
  const overdueGoals = goals.filter((goal: Goal) => getGoalStatus(goal) === 'overdue').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500 py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-400" />
              <p>Failed to load goals. Please try again.</p>
              <Button onClick={() => refetch()} className="mt-4">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Goals</h1>
          <p className="text-gray-600">Track and manage your financial objectives</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Goal
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Goals</p>
                <p className="text-2xl font-bold">{totalGoals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{completedGoals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-blue-600">{activeGoals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueGoals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search goals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                All
              </Button>
              <Button
                variant={filterStatus === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('active')}
              >
                Active
              </Button>
              <Button
                variant={filterStatus === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('completed')}
              >
                Completed
              </Button>
              <Button
                variant={filterStatus === 'overdue' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('overdue')}
              >
                Overdue
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals List */}
      {filteredGoals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {goals.length === 0 ? 'No Goals Yet' : 'No Matching Goals'}
              </h3>
              <p className="text-gray-600 mb-4">
                {goals.length === 0 
                  ? 'Create your first financial goal to start tracking your progress.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
              {goals.length === 0 && (
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Goal
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredGoals.map((goal: Goal) => {
            const status = getGoalStatus(goal);
            const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0);
            const deadline = new Date(goal.deadline * 1000);
            const daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <Card key={goal.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{goal.name}</h3>
                        <Badge className={getStatusColor(status)}>
                          {getStatusIcon(status)}
                          <span className="ml-1 capitalize">{status}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{goal.description}</p>
                      <p className="text-sm text-gray-500">Category: {goal.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditGoal(goal)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteGoal(goal)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span className="font-medium">{progress.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* Amount Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Current</span>
                        <div className="font-semibold">
                          {showBalance ? formatCurrency(goal.currentAmount, currency) : '••••••'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Target</span>
                        <div className="font-semibold">
                          {showBalance ? formatCurrency(goal.targetAmount, currency) : '••••••'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Remaining</span>
                        <div className="font-semibold">
                          {showBalance ? formatCurrency(remainingAmount, currency) : '••••••'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Deadline</span>
                        <div className="font-semibold flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(deadline, 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    {status !== 'completed' && (
                      <div className="text-sm">
                        {daysRemaining > 0 ? (
                          <div className="flex items-center gap-1 text-blue-600">
                            <Clock className="h-3 w-3" />
                            {daysRemaining} days remaining
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            {Math.abs(daysRemaining)} days overdue
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateGoalModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGoalCreated={() => {
          refetch();
        }}
      />

      <EditGoalModal 
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedGoal(null);
        }}
        goal={selectedGoal}
        onGoalUpdated={() => {
          refetch();
        }}
      />

      <DeleteGoalModal 
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedGoal(null);
        }}
        goal={selectedGoal}
        onConfirmDelete={confirmDelete}
        isDeleting={deleteGoalMutation.isPending}
      />
    </div>
  );
}
