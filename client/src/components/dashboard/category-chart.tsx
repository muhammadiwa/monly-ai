import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryChartProps {
  data: any[];
}

export default function CategoryChart({ data }: CategoryChartProps) {
  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);

  // Generate colors for the pie chart
  const colors = ["#059669", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
  
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Expense Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center mb-6">
          {/* Mock pie chart using CSS */}
          <div className="relative w-48 h-48">
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                background: data.length > 0 
                  ? `conic-gradient(${data.map((item, index) => {
                      const percentage = (parseFloat(item.total || 0) / totalAmount) * 100;
                      return `${colors[index % colors.length]} ${percentage}%`;
                    }).join(', ')})` 
                  : `conic-gradient(#059669 0% 35%, #3B82F6 35% 60%, #F59E0B 60% 80%, #EF4444 80% 100%)`
              }}
            />
            <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  ${totalAmount.toFixed(0)}
                </p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          {data.length > 0 ? (
            data.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: item.categoryColor || colors[index % colors.length] }}
                  />
                  <span className="text-sm text-gray-600">{item.categoryName}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  ${parseFloat(item.total || 0).toFixed(2)}
                </span>
              </div>
            ))
          ) : (
            // Mock data when no real data is available
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-primary rounded-full mr-2" />
                  <span className="text-sm text-gray-600">Food & Dining</span>
                </div>
                <span className="text-sm font-medium text-gray-900">$1,102.50</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
                  <span className="text-sm text-gray-600">Transportation</span>
                </div>
                <span className="text-sm font-medium text-gray-900">$787.50</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2" />
                  <span className="text-sm text-gray-600">Shopping</span>
                </div>
                <span className="text-sm font-medium text-gray-900">$630.00</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                  <span className="text-sm text-gray-600">Entertainment</span>
                </div>
                <span className="text-sm font-medium text-gray-900">$630.00</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
