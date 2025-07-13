import { db } from "./db";
import { users, categories } from "@shared/schema";

async function createTestData() {
  console.log("🔄 Creating test user and categories...");
  
  try {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        id: "demo_test_user",
        email: "test@gmail.com",
        firstName: "Test",
        lastName: "User",
        password: "$2b$10$example.hash.here", // Demo hash
        profileImageUrl: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .returning();
    
    console.log("✅ Test user created:", user.email);
    
    // Create test categories with emojis
    const testCategories = [
      { name: "Food & Dining", icon: "🍽️", color: "#059669", type: "expense", userId: user.id },
      { name: "Transportation", icon: "🚗", color: "#3B82F6", type: "expense", userId: user.id },
      { name: "Shopping", icon: "🛒", color: "#F59E0B", type: "expense", userId: user.id },
      { name: "Entertainment", icon: "🎬", color: "#EF4444", type: "expense", userId: user.id },
      { name: "Bills & Utilities", icon: "🧾", color: "#8B5CF6", type: "expense", userId: user.id },
      { name: "Healthcare", icon: "🏥", color: "#EC4899", type: "expense", userId: user.id },
      { name: "Education", icon: "📚", color: "#06B6D4", type: "expense", userId: user.id },
      { name: "Other", icon: "📦", color: "#6B7280", type: "expense", userId: user.id },
      { name: "Salary", icon: "💰", color: "#10B981", type: "income", userId: user.id },
      { name: "Investment", icon: "📈", color: "#059669", type: "income", userId: user.id },
      { name: "Freelance", icon: "💻", color: "#3B82F6", type: "income", userId: user.id },
    ];
    
    for (const category of testCategories) {
      const [created] = await db.insert(categories).values({
        ...category,
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).returning();
      
      console.log(`✅ Created category: ${created.name} ${created.icon}`);
    }
    
    console.log("🎉 Test data created successfully!");
    console.log("📧 Login with: test@gmail.com");
    
  } catch (error) {
    console.error("❌ Failed to create test data:", error);
  }
}

// Run the script
createTestData();
