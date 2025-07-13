import { db } from "./db";
import { categories } from "@shared/schema";
import { eq } from "drizzle-orm";

// Icon mapping from Font Awesome to Emoji
const iconMapping: Record<string, string> = {
  "fas fa-utensils": "🍽️",
  "fas fa-car": "🚗", 
  "fas fa-shopping-bag": "🛒",
  "fas fa-film": "🎬",
  "fas fa-file-invoice-dollar": "🧾",
  "fas fa-heart": "🏥",
  "fas fa-graduation-cap": "📚",
  "fas fa-ellipsis-h": "📦",
  "fas fa-dollar-sign": "💰",
  "fas fa-chart-line": "📈",
  "fas fa-laptop": "💻",
};

async function updateCategoryIcons() {
  console.log("🔄 Starting icon migration...");
  
  try {
    // Get all categories with Font Awesome icons
    const allCategories = await db.select().from(categories);
    
    let updateCount = 0;
    
    for (const category of allCategories) {
      if (category.icon && category.icon.startsWith("fas fa-")) {
        const newIcon = iconMapping[category.icon];
        
        if (newIcon) {
          await db
            .update(categories)
            .set({ icon: newIcon })
            .where(eq(categories.id, category.id));
          
          console.log(`✅ Updated "${category.name}": ${category.icon} → ${newIcon}`);
          updateCount++;
        } else {
          console.log(`⚠️ No mapping found for: ${category.icon} (${category.name})`);
        }
      }
    }
    
    console.log(`🎉 Migration complete! Updated ${updateCount} categories.`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}

// Run the migration
updateCategoryIcons();
