import { OpenAI } from 'openai';
import { db } from './db';
import { transactions, budgets, goals, users, categories } from '../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-key'
});

interface TransactionHistory {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: number;
  description?: string;
}

interface BudgetAllocation {
  category: string;
  amount: number;
  period: 'monthly';
}

interface FinancialGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: number;
  category: string;
}

interface UserProfile {
  lifestyle: 'single' | 'family' | 'student';
  incomeLevel: 'low' | 'medium' | 'high';
  spendingPattern: 'conservative' | 'moderate' | 'liberal';
}

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

interface BudgetAlertPrediction {
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

interface GoalAchievementForecast {
  goalId: number;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  expectedSavingPerMonth: number;
  monthsToGoal: number;
  targetMonths: number;
  deviation: number; // positive = ahead, negative = behind
  confidence: number;
  status: 'on-track' | 'ahead' | 'behind' | 'at-risk';
  recommendation: string;
}

interface AIFinancialIntelligence {
  smartSpendingOpportunities: SmartSpendingOpportunity[];
  budgetAlerts: BudgetAlertPrediction[];
  goalForecasts: GoalAchievementForecast[];
  overallScore: number;
  lastUpdated: number;
}

export class AIFinancialIntelligenceEngine {
  private userId: string;
  
  constructor(userId: string) {
    this.userId = userId;
  }

  async generateIntelligence(): Promise<AIFinancialIntelligence> {
    try {
      // 1. Gather all necessary data
      const transactionHistory = await this.getTransactionHistory();
      const budgetAllocations = await this.getBudgetAllocations();
      const financialGoals = await this.getFinancialGoals();
      const userProfile = await this.getUserProfile();
      const monthlyIncome = await this.getMonthlyIncome();

      // 2. Generate AI insights
      const smartSpendingOpportunities = await this.generateSmartSpendingOpportunities(
        transactionHistory, budgetAllocations, userProfile
      );
      
      const budgetAlerts = await this.generateBudgetAlertPredictions(
        transactionHistory, budgetAllocations
      );
      
      const goalForecasts = await this.generateGoalAchievementForecasts(
        transactionHistory, financialGoals, monthlyIncome
      );

      // 3. Calculate overall intelligence score
      const overallScore = this.calculateOverallScore(
        smartSpendingOpportunities, budgetAlerts, goalForecasts
      );

      return {
        smartSpendingOpportunities,
        budgetAlerts,
        goalForecasts,
        overallScore,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('AI Financial Intelligence Error:', error);
      return this.getFallbackIntelligence();
    }
  }

  private async getTransactionHistory(): Promise<TransactionHistory[]> {
    const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000);
    
    const userTransactions = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        date: transactions.date,
        description: transactions.description
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, this.userId),
          gte(transactions.date, Math.floor(sixMonthsAgo / 1000))
        )
      )
      .orderBy(desc(transactions.date));

    return userTransactions.map(t => ({
      id: t.id,
      type: t.type as 'income' | 'expense',
      amount: t.amount,
      category: t.categoryName, // Use category name instead of ID
      date: t.date,
      description: t.description
    }));
  }

  private async getBudgetAllocations(): Promise<BudgetAllocation[]> {
    const userBudgets = await db
      .select({
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        amount: budgets.amount
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.userId, this.userId));

    return userBudgets.map(b => ({
      category: b.categoryName, // Use category name instead of ID
      amount: b.amount,
      period: 'monthly' as const
    }));
  }

  private async getFinancialGoals(): Promise<FinancialGoal[]> {
    console.log('Getting financial goals for userId:', this.userId);
    const userGoals = await db
      .select()
      .from(goals)
      .where(eq(goals.userId, this.userId));

    console.log('Found goals:', userGoals.length, userGoals);
    return userGoals.map(g => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      deadline: g.deadline,
      category: g.category || 'general'
    }));
  }

  private async getUserProfile(): Promise<UserProfile> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, this.userId))
      .limit(1);

    if (!user.length) {
      return {
        lifestyle: 'single',
        incomeLevel: 'medium',
        spendingPattern: 'moderate'
      };
    }

    // Determine profile based on transaction patterns
    return {
      lifestyle: 'single', // Could be determined from spending patterns
      incomeLevel: 'medium', // Could be determined from income levels
      spendingPattern: 'moderate' // Could be determined from spending variance
    };
  }

  private async getMonthlyIncome(): Promise<number> {
    const now = new Date();
    const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
    
    const monthlyIncomeTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, this.userId),
          eq(transactions.type, 'income'),
          gte(transactions.date, startOfMonth)
        )
      );

    return monthlyIncomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  }

  private async generateSmartSpendingOpportunities(
    transactionHistory: TransactionHistory[],
    budgetAllocations: BudgetAllocation[],
    userProfile: UserProfile
  ): Promise<SmartSpendingOpportunity[]> {
    
    // Group transactions by category for analysis
    const categorySpending = this.groupTransactionsByCategory(transactionHistory, 'expense');
    const opportunities: SmartSpendingOpportunity[] = [];

    for (const [category, transactions] of Object.entries(categorySpending)) {
      const currentMonthlySpending = this.calculateMonthlyAverage(transactions);
      const benchmark = this.getCategoryBenchmark(category, userProfile);
      
      if (currentMonthlySpending > benchmark * 1.2) { // 20% above benchmark
        const potentialSaving = currentMonthlySpending - benchmark;
        const savingPercentage = (potentialSaving / currentMonthlySpending) * 100;
        
        const aiInsight = await this.generateCategoryOptimizationTips(
          category, currentMonthlySpending, benchmark, transactions
        );

        opportunities.push({
          category,
          currentSpending: currentMonthlySpending,
          recommendedSpending: benchmark,
          potentialSaving,
          savingPercentage,
          confidence: this.calculateConfidence(transactions.length, savingPercentage),
          reasoning: aiInsight.reasoning,
          actionableTips: aiInsight.tips
        });
      }
    }

    return opportunities.sort((a, b) => b.potentialSaving - a.potentialSaving);
  }

  private async generateBudgetAlertPredictions(
    transactionHistory: TransactionHistory[],
    budgetAllocations: BudgetAllocation[]
  ): Promise<BudgetAlertPrediction[]> {
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = endOfMonth.getDate();
    const daysPassed = now.getDate();
    const daysRemaining = daysInMonth - daysPassed;

    const currentMonthTransactions = transactionHistory.filter(t => {
      const transactionDate = new Date(t.date * 1000);
      return transactionDate >= startOfMonth && transactionDate <= now;
    });

    const alerts: BudgetAlertPrediction[] = [];

    for (const budget of budgetAllocations) {
      const categoryTransactions = currentMonthTransactions.filter(
        t => t.category === budget.category && t.type === 'expense'
      );
      
      const currentSpending = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
      const dailySpendingRate = currentSpending / daysPassed;
      const forecastedSpending = currentSpending + (dailySpendingRate * daysRemaining);
      
      if (forecastedSpending > budget.amount) {
        const overBudgetAmount = forecastedSpending - budget.amount;
        const overBudgetProbability = this.calculateOverBudgetProbability(
          categoryTransactions, budget.amount, daysRemaining
        );

        const recommendation = await this.generateBudgetRecommendation(
          budget.category, currentSpending, budget.amount, forecastedSpending
        );

        alerts.push({
          category: budget.category,
          currentSpending,
          budgetLimit: budget.amount,
          forecastedSpending,
          overBudgetAmount,
          overBudgetProbability,
          confidence: this.calculateForecastConfidence(categoryTransactions.length),
          daysRemaining,
          recommendation
        });
      }
    }

    return alerts.sort((a, b) => b.overBudgetProbability - a.overBudgetProbability);
  }

  private async generateGoalAchievementForecasts(
    transactionHistory: TransactionHistory[],
    financialGoals: FinancialGoal[],
    monthlyIncome: number
  ): Promise<GoalAchievementForecast[]> {
    
    const forecasts: GoalAchievementForecast[] = [];
    
    // Calculate average monthly savings
    const monthlySavings = this.calculateMonthlySavingsPattern(transactionHistory, monthlyIncome);
    
    for (const goal of financialGoals) {
      const remainingAmount = goal.targetAmount - goal.currentAmount;
      const deadlineDate = new Date(goal.deadline * 1000);
      const now = new Date();
      const monthsToDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
      
      const expectedSavingPerMonth = monthlySavings.average;
      const monthsToGoal = remainingAmount / expectedSavingPerMonth;
      const deviation = monthsToDeadline - monthsToGoal;
      
      let status: 'on-track' | 'ahead' | 'behind' | 'at-risk';
      if (deviation > 2) status = 'ahead';
      else if (deviation > -1) status = 'on-track';
      else if (deviation > -3) status = 'behind';
      else status = 'at-risk';

      const recommendation = await this.generateGoalRecommendation(
        goal, remainingAmount, expectedSavingPerMonth, status
      );

      forecasts.push({
        goalId: goal.id,
        goalName: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        expectedSavingPerMonth,
        monthsToGoal,
        targetMonths: monthsToDeadline,
        deviation,
        confidence: this.calculateGoalConfidence(monthlySavings.variance),
        status,
        recommendation
      });
    }

    return forecasts;
  }

  // Helper methods
  private groupTransactionsByCategory(transactions: TransactionHistory[], type: 'income' | 'expense') {
    return transactions
      .filter(t => t.type === type)
      .reduce((groups, transaction) => {
        const category = transaction.category;
        if (!groups[category]) groups[category] = [];
        groups[category].push(transaction);
        return groups;
      }, {} as Record<string, TransactionHistory[]>);
  }

  private calculateMonthlyAverage(transactions: TransactionHistory[]): number {
    if (!transactions.length) return 0;
    
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const months = this.getMonthsSpanned(transactions);
    return total / Math.max(months, 1);
  }

  private getMonthsSpanned(transactions: TransactionHistory[]): number {
    if (!transactions.length) return 1;
    
    const dates = transactions.map(t => t.date * 1000);
    const earliest = Math.min(...dates);
    const latest = Math.max(...dates);
    const monthsDiff = (latest - earliest) / (1000 * 60 * 60 * 24 * 30);
    return Math.max(monthsDiff, 1);
  }

  private getCategoryBenchmark(category: string, userProfile: UserProfile): number {
    // Benchmark spending amounts based on category and user profile
    const benchmarks: Record<string, Record<string, number>> = {
      'Food & Dining': {
        'conservative': 1500000, // 1.5M IDR
        'moderate': 2000000,     // 2M IDR
        'liberal': 3000000       // 3M IDR
      },
      'Transportation': {
        'conservative': 800000,
        'moderate': 1200000,
        'liberal': 2000000
      },
      'Shopping': {
        'conservative': 500000,
        'moderate': 1000000,
        'liberal': 2000000
      },
      'Entertainment': {
        'conservative': 300000,
        'moderate': 600000,
        'liberal': 1200000
      },
      'Bills & Utilities': {
        'conservative': 800000,
        'moderate': 1000000,
        'liberal': 1500000
      }
    };

    return benchmarks[category]?.[userProfile.spendingPattern] || 1000000;
  }

  private calculateConfidence(dataPoints: number, impactMagnitude: number): number {
    let confidence = 0.5; // Base confidence
    
    // More data points = higher confidence
    confidence += Math.min(dataPoints / 50, 0.3);
    
    // Higher impact = easier to detect pattern
    confidence += Math.min(impactMagnitude / 100, 0.2);
    
    return Math.min(confidence, 0.95);
  }

  private calculateOverBudgetProbability(
    transactions: TransactionHistory[],
    budgetLimit: number,
    daysRemaining: number
  ): number {
    if (!transactions.length) return 0;
    
    const currentSpending = transactions.reduce((sum, t) => sum + t.amount, 0);
    const spendingRate = currentSpending / transactions.length; // per transaction
    const estimatedTransactions = (transactions.length / 30) * daysRemaining;
    const projectedSpending = currentSpending + (spendingRate * estimatedTransactions);
    
    if (projectedSpending <= budgetLimit) return 0;
    
    const overBudgetRatio = (projectedSpending - budgetLimit) / budgetLimit;
    return Math.min(overBudgetRatio * 0.8 + 0.2, 0.95);
  }

  private calculateForecastConfidence(dataPoints: number): number {
    if (dataPoints < 5) return 0.3;
    if (dataPoints < 15) return 0.6;
    if (dataPoints < 30) return 0.8;
    return 0.9;
  }

  private calculateMonthlySavingsPattern(
    transactions: TransactionHistory[],
    monthlyIncome: number
  ): { average: number; variance: number } {
    // Group by month and calculate savings
    const monthlyData: Record<string, { income: number; expenses: number }> = {};
    
    transactions.forEach(t => {
      const date = new Date(t.date * 1000);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenses: 0 };
      }
      
      if (t.type === 'income') {
        monthlyData[monthKey].income += t.amount;
      } else {
        monthlyData[monthKey].expenses += t.amount;
      }
    });

    const savingsData = Object.values(monthlyData).map(
      month => month.income - month.expenses
    );

    if (!savingsData.length) {
      return { average: monthlyIncome * 0.1, variance: 0.3 }; // Assume 10% savings
    }

    const average = savingsData.reduce((sum, s) => sum + s, 0) / savingsData.length;
    const variance = savingsData.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / savingsData.length;
    
    return { average, variance };
  }

  private calculateGoalConfidence(variance: number): number {
    // Lower variance = higher confidence
    const normalizedVariance = Math.min(variance / 10000000, 1); // Normalize to 0-1
    return Math.max(0.95 - normalizedVariance, 0.3);
  }

  private calculateOverallScore(
    opportunities: SmartSpendingOpportunity[],
    alerts: BudgetAlertPrediction[],
    forecasts: GoalAchievementForecast[]
  ): number {
    let score = 70; // Base score
    
    // Deduct for spending opportunities (more opportunities = lower score)
    score -= opportunities.length * 5;
    
    // Deduct for budget alerts
    score -= alerts.reduce((sum, alert) => sum + (alert.overBudgetProbability * 20), 0);
    
    // Add for goals on track
    const onTrackGoals = forecasts.filter(f => f.status === 'on-track' || f.status === 'ahead').length;
    score += onTrackGoals * 10;
    
    return Math.max(0, Math.min(100, score));
  }

  // AI-powered content generation methods
  private async generateCategoryOptimizationTips(
    category: string,
    currentSpending: number,
    benchmark: number,
    transactions: TransactionHistory[]
  ): Promise<{ reasoning: string; tips: string[] }> {
    try {
      const prompt = `
Analyze spending pattern for category "${category}":
- Current monthly spending: ${this.formatCurrency(currentSpending)}
- Recommended benchmark: ${this.formatCurrency(benchmark)}
- Recent transactions: ${transactions.slice(0, 5).map(t => `${t.description}: ${this.formatCurrency(t.amount)}`).join(', ')}

Provide:
1. Brief reasoning why spending is high
2. 3 actionable tips to reduce spending

Respond in JSON format: {"reasoning": "...", "tips": ["tip1", "tip2", "tip3"]}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          return JSON.parse(content);
        } catch {
          // Fallback parsing
        }
      }
    } catch (error) {
      console.error('AI tip generation error:', error);
    }

    // Fallback tips
    return this.getFallbackTips(category);
  }

  private async generateBudgetRecommendation(
    category: string,
    currentSpending: number,
    budgetLimit: number,
    forecastedSpending: number
  ): Promise<string> {
    try {
      const prompt = `
Budget alert for "${category}":
- Current spending: ${this.formatCurrency(currentSpending)}
- Budget limit: ${this.formatCurrency(budgetLimit)}
- Forecasted spending: ${this.formatCurrency(forecastedSpending)}

Generate a brief, actionable recommendation to stay within budget.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 100
      });

      return response.choices[0]?.message?.content || this.getFallbackBudgetRecommendation(category);
    } catch {
      return this.getFallbackBudgetRecommendation(category);
    }
  }

  private async generateGoalRecommendation(
    goal: FinancialGoal,
    remainingAmount: number,
    expectedSavingPerMonth: number,
    status: string
  ): Promise<string> {
    try {
      const prompt = `
Financial goal "${goal.name}":
- Target: ${this.formatCurrency(goal.targetAmount)}
- Current: ${this.formatCurrency(goal.currentAmount)}
- Remaining: ${this.formatCurrency(remainingAmount)}
- Monthly savings: ${this.formatCurrency(expectedSavingPerMonth)}
- Status: ${status}

Generate a brief recommendation to achieve this goal.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 100
      });

      return response.choices[0]?.message?.content || this.getFallbackGoalRecommendation(status);
    } catch {
      return this.getFallbackGoalRecommendation(status);
    }
  }

  // Fallback methods
  private getFallbackIntelligence(): AIFinancialIntelligence {
    return {
      smartSpendingOpportunities: [],
      budgetAlerts: [],
      goalForecasts: [],
      overallScore: 70,
      lastUpdated: Date.now()
    };
  }

  private getFallbackTips(category: string): { reasoning: string; tips: string[] } {
    const fallbackTips: Record<string, { reasoning: string; tips: string[] }> = {
      'Food & Dining': {
        reasoning: 'Your dining expenses are above average for your spending pattern.',
        tips: [
          'Cook at home more frequently - aim for 4-5 home meals per week',
          'Use meal planning apps to reduce food waste',
          'Look for restaurant deals and happy hours when dining out'
        ]
      },
      'Transportation': {
        reasoning: 'Transportation costs are higher than typical benchmarks.',
        tips: [
          'Consider using public transportation or ride-sharing for daily commutes',
          'Combine errands into single trips to reduce fuel costs',
          'Explore carpooling options with colleagues'
        ]
      }
    };

    return fallbackTips[category] || {
      reasoning: 'This category shows potential for optimization.',
      tips: [
        'Review recent purchases for unnecessary expenses',
        'Set stricter spending limits for this category',
        'Look for alternative providers or cheaper options'
      ]
    };
  }

  private getFallbackBudgetRecommendation(category: string): string {
    return `Consider reducing ${category} spending by 20% for the remainder of the month to stay within budget.`;
  }

  private getFallbackGoalRecommendation(status: string): string {
    const recommendations: Record<string, string> = {
      'on-track': 'You\'re on track! Maintain your current saving rate.',
      'ahead': 'Excellent progress! Consider increasing your goal or setting a new one.',
      'behind': 'Consider increasing monthly contributions or reducing expenses.',
      'at-risk': 'Urgent action needed. Review your budget and cut non-essential expenses.'
    };

    return recommendations[status] || 'Review your financial plan and adjust as needed.';
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }
}
