import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { IconEmojiPicker } from "@/components/ui/icon-emoji-picker";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Search } from "lucide-react";

// Category icons mapping - removed since we now use the picker
const categoryTypes = ["income", "expense"];

export default function Categories() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  
  const [formData, setFormData] = useState({
    name: "",
    type: "expense" as "income" | "expense",
    icon: "🏷️",
    color: "#3B82F6"
  });

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsDialogOpen(false);
      resetForm();
      showToast('success', '✨ Category Created!', 'has been successfully added to your categories', formData.name);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to create category';
      showToast('error', '❌ Creation Failed', errorMessage);
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update category");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsDialogOpen(false);
      const categoryName = editingCategory?.name || formData.name;
      setEditingCategory(null);
      resetForm();
      showToast('success', '🔄 Category Updated!', 'has been successfully updated', categoryName);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to update category';
      showToast('error', '❌ Update Failed', errorMessage);
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('auth-token')}`
        },
      });
      if (!response.ok) throw new Error("Failed to delete category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      const deletedCategoryName = categoryToDelete?.name;
      showToast('success', '🗑️ Category Deleted!', 'has been permanently removed', deletedCategoryName);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to delete category';
      showToast('error', '❌ Deletion Failed', errorMessage);
    },
  });

  // Helper function for better toast notifications
  const showToast = (type: 'success' | 'error' | 'warning', title: string, description: string, categoryName?: string) => {
    const variants = {
      success: undefined, // default
      error: "destructive" as const,
      warning: "default" as const,
    };

    const finalDescription = categoryName ? `"${categoryName}" ${description}` : description;
    
    toast({
      title,
      description: finalDescription,
      variant: variants[type],
      duration: type === 'error' ? 5000 : 3000, // Error messages stay longer
      className: type === 'success' ? 'border-green-200 bg-green-50' : 
                 type === 'warning' ? 'border-yellow-200 bg-yellow-50' : '',
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "expense",
      icon: "🏷️", 
      color: "#3B82F6"
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation
    if (!formData.name.trim()) {
      showToast('warning', '⚠️ Validation Error', 'Category name is required');
      return;
    }
    
    if (formData.name.trim().length < 2) {
      showToast('warning', '⚠️ Validation Error', 'Category name must be at least 2 characters long');
      return;
    }
    
    // Check for duplicate names (case-insensitive)
    const existingCategory = (categories as any[]).find((cat: any) => 
      cat.name.toLowerCase() === formData.name.trim().toLowerCase() && 
      cat.id !== editingCategory?.id
    );
    
    if (existingCategory) {
      showToast('warning', '⚠️ Duplicate Category', 'A category with this name already exists');
      return;
    }
    
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createCategoryMutation.mutate(formData);
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      icon: category.icon || "🏷️",
      color: category.color || "#3B82F6"
    });
    setIsDialogOpen(true);
    
    // Show helpful toast
    showToast('success', '✏️ Editing Category', `You can now modify "${category.name}" settings`);
  };

  const handleDelete = (category: any) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (categoryToDelete) {
      // Show loading toast
      showToast('warning', '⏳ Deleting Category...', 'Please wait while we remove the category');
      
      deleteCategoryMutation.mutate(categoryToDelete.id);
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  // Filter categories
  const filteredCategories = (categories as any[]).filter((category: any) => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || category.type === selectedType;
    return matchesSearch && matchesType;
  });

  const incomeCategories = filteredCategories.filter((cat: any) => cat.type === "income");
  const expenseCategories = filteredCategories.filter((cat: any) => cat.type === "expense");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 lg:px-6 space-y-5 sm:space-y-6 md:space-y-8 max-w-[100vw] overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Categories</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage transaction categories for better financial organization</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingCategory(null); }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-w-[90vw] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {editingCategory ? "Edit Category" : "Create Category"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {editingCategory ? "Edit an existing category" : "Create a new category to organize your transactions"}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm">Category Name</Label>
                <Input
                  id="name"
                  placeholder="Category name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-sm"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="type" className="text-sm">Category Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: "income" | "expense") => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Category type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="icon" className="text-sm">Icon/Emoji</Label>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-sm"
                    onClick={() => setIsIconPickerOpen(true)}
                  >
                    <span className="text-xl sm:text-2xl mr-2">{formData.icon}</span>
                    Choose Icon/Emoji
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-3 sm:pt-4">
                <Button type="button" variant="outline" className="w-full sm:w-auto order-2 sm:order-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="w-full sm:w-auto order-1 sm:order-2"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                >
                  {editingCategory ? "Save" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Icon/Emoji Picker Modal */}
      <IconEmojiPicker
        open={isIconPickerOpen}
        onOpenChange={setIsIconPickerOpen}
        onSelect={(icon) => setFormData({ ...formData, icon })}
        value={formData.icon}
      />

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Categories Tabs */}
      <Tabs defaultValue="income" className="w-full">
        <TabsList className="grid w-full grid-cols-2 p-0.5">
          <TabsTrigger value="income" className="text-xs sm:text-sm py-1.5 sm:py-2">
            Income ({incomeCategories.length})
          </TabsTrigger>
          <TabsTrigger value="expense" className="text-xs sm:text-sm py-1.5 sm:py-2">
            Expense ({expenseCategories.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="income" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {incomeCategories.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📈</div>
                  <h3 className="font-medium text-gray-900 text-center">No income categories yet</h3>
                  <p className="text-gray-500 text-center text-sm sm:text-base mt-1 sm:mt-2">
                    Add income categories to manage your revenue streams
                  </p>
                </CardContent>
              </Card>
            ) : (
              incomeCategories.map((category: any) => (
                <Card key={category.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-2 sm:pt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-lg sm:text-xl">{category.icon || "📈"}</span>
                        </div>
                        <div>
                          <CardTitle className="text-xs sm:text-sm font-medium">{category.name}</CardTitle>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5">
                            Income
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-0.5 sm:space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          onClick={() => handleDelete(category)}
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="expense" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {expenseCategories.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">💸</div>
                  <h3 className="font-medium text-gray-900 text-center">No expense categories yet</h3>
                  <p className="text-gray-500 text-center text-sm sm:text-base mt-1 sm:mt-2">
                    Add expense categories to manage your spending
                  </p>
                </CardContent>
              </Card>
            ) : (
              expenseCategories.map((category: any) => (
                <Card key={category.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-2 sm:pt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-lg sm:text-xl">{category.icon || "💸"}</span>
                        </div>
                        <div>
                          <CardTitle className="text-xs sm:text-sm font-medium">{category.name}</CardTitle>
                          <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5">
                            Expense
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-0.5 sm:space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          onClick={() => handleDelete(category)}
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-md max-w-[90vw] p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-semibold text-gray-900">Delete Category</div>
                <div className="text-xs sm:text-sm text-gray-500">This action cannot be undone</div>
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 sm:space-y-3 mt-2 sm:mt-3">
              {categoryToDelete && (
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg font-semibold text-white"
                      style={{ backgroundColor: categoryToDelete.color }}
                    >
                      {categoryToDelete.icon}
                    </div>
                    <div>
                      <div className="font-medium text-sm sm:text-base text-gray-900">{categoryToDelete.name}</div>
                      <div className="text-xs sm:text-sm text-gray-500 capitalize">{categoryToDelete.type}</div>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs sm:text-sm text-gray-600">
                Are you sure you want to delete this category? All transactions associated with this category will lose their category assignment.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel 
              className="hover:bg-gray-100 w-full sm:w-auto order-2 sm:order-1"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setCategoryToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto order-1 sm:order-2"
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Deleting...
                </div>
              ) : (
                "Delete Category"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
