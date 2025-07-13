import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface IconEmojiPickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (value: string) => void;
  readonly value?: string;
}

// Comprehensive icon options with icons
const iconOptions = [
  { value: "💳", label: "Account", category: "finance" },
  { value: "🏦", label: "Bank", category: "finance" },
  { value: "💵", label: "Cash", category: "finance" },
  { value: "💰", label: "Money", category: "finance" },
  { value: "💸", label: "Money with Wings", category: "finance" },
  { value: "💎", label: "Gem", category: "finance" },
  { value: "📱", label: "Mobile Phone", category: "technology" },
  { value: "💻", label: "Laptop", category: "technology" },
  { value: "🖥️", label: "Desktop Computer", category: "technology" },
  { value: "⌚", label: "Watch", category: "technology" },
  { value: "📺", label: "Television", category: "technology" },
  { value: "🎮", label: "Video Game", category: "entertainment" },
  { value: "🎬", label: "Movie", category: "entertainment" },
  { value: "🎭", label: "Theater", category: "entertainment" },
  { value: "🎨", label: "Art", category: "entertainment" },
  { value: "🎪", label: "Circus", category: "entertainment" },
  { value: "🎯", label: "Target", category: "entertainment" },
  { value: "🍕", label: "Pizza", category: "food" },
  { value: "🍔", label: "Hamburger", category: "food" },
  { value: "🍟", label: "French Fries", category: "food" },
  { value: "🍜", label: "Noodles", category: "food" },
  { value: "🍱", label: "Bento Box", category: "food" },
  { value: "🍣", label: "Sushi", category: "food" },
  { value: "☕", label: "Coffee", category: "food" },
  { value: "🍺", label: "Beer", category: "food" },
  { value: "🍷", label: "Wine", category: "food" },
  { value: "🚗", label: "Car", category: "transport" },
  { value: "🚕", label: "Taxi", category: "transport" },
  { value: "🚌", label: "Bus", category: "transport" },
  { value: "🚇", label: "Metro", category: "transport" },
  { value: "✈️", label: "Airplane", category: "transport" },
  { value: "🚲", label: "Bicycle", category: "transport" },
  { value: "⛽", label: "Fuel", category: "transport" },
  { value: "🏥", label: "Hospital", category: "health" },
  { value: "💊", label: "Pill", category: "health" },
  { value: "🩹", label: "Bandage", category: "health" },
  { value: "🏋️", label: "Weight Lifting", category: "health" },
  { value: "🧘", label: "Meditation", category: "health" },
  { value: "🛒", label: "Shopping Cart", category: "shopping" },
  { value: "🛍️", label: "Shopping Bags", category: "shopping" },
  { value: "👕", label: "T-Shirt", category: "shopping" },
  { value: "👖", label: "Jeans", category: "shopping" },
  { value: "👟", label: "Sneakers", category: "shopping" },
  { value: "👜", label: "Handbag", category: "shopping" },
  { value: "📚", label: "Books", category: "education" },
  { value: "🎓", label: "Graduation Cap", category: "education" },
  { value: "✏️", label: "Pencil", category: "education" },
  { value: "📝", label: "Memo", category: "education" },
  { value: "🏫", label: "School", category: "education" },
  { value: "🏠", label: "House", category: "home" },
  { value: "🏡", label: "Home", category: "home" },
  { value: "🔧", label: "Wrench", category: "home" },
  { value: "🔌", label: "Electric Plug", category: "home" },
  { value: "💡", label: "Light Bulb", category: "home" },
  { value: "🧾", label: "Receipt", category: "bills" },
  { value: "⚡", label: "Electricity", category: "bills" },
  { value: "💧", label: "Water", category: "bills" },
  { value: "📞", label: "Phone", category: "bills" },
  { value: "📡", label: "Internet", category: "bills" },
  { value: "🎁", label: "Gift", category: "gift" },
  { value: "💝", label: "Gift Heart", category: "gift" },
  { value: "🎉", label: "Party", category: "gift" },
  { value: "🎂", label: "Birthday Cake", category: "gift" },
  { value: "⚽", label: "Soccer", category: "sports" },
  { value: "🏀", label: "Basketball", category: "sports" },
  { value: "🎾", label: "Tennis", category: "sports" },
  { value: "🏊", label: "Swimming", category: "sports" },
  { value: "🚴", label: "Cycling", category: "sports" },
  { value: "👨‍👩‍👧‍👦", label: "Family", category: "family" },
  { value: "👶", label: "Baby", category: "family" },
  { value: "🧸", label: "Teddy Bear", category: "family" },
  { value: "🍼", label: "Baby Bottle", category: "family" },
  { value: "📥", label: "Inbox", category: "transfer" },
  { value: "📤", label: "Outbox", category: "transfer" },
  { value: "🔄", label: "Refresh", category: "transfer" },
  { value: "📈", label: "Chart Up", category: "investment" },
  { value: "📊", label: "Bar Chart", category: "investment" },
  { value: "💹", label: "Chart with Yen", category: "investment" },
  { value: "🏷️", label: "Label", category: "other" },
  { value: "❓", label: "Question", category: "other" },
  { value: "⭐", label: "Star", category: "other" },
  { value: "🔥", label: "Fire", category: "other" },
  { value: "🌟", label: "Glowing Star", category: "other" }
];

// Comprehensive emoji categories
const emojiCategories = {
  "smileys": {
    name: "Smileys & People",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "☺️", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔",
      "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😔", "😪", "🤤", "😴", "😷", "🤒",
      "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕",
      "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱",
      "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩"
    ]
  },
  "people": {
    name: "People & Body",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "🖕", "👇", "☝️", "👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️",
      "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀",
      "👁️", "👅", "👄", "💋", "🩸", "👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "👨‍🦰", "👨‍🦱",
      "👨‍🦳", "👨‍🦲", "👩", "👩‍🦰", "🧑‍🦰", "👩‍🦱", "🧑‍🦱", "👩‍🦳", "🧑‍🦳", "👩‍🦲", "🧑‍🦲"
    ]
  },
  "animals": {
    name: "Animals & Nature",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈",
      "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴",
      "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍", "🦎", "🦖",
      "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆",
      "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏"
    ]
  },
  "food": {
    name: "Food & Drink",
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝",
      "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐",
      "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭",
      "🍔", "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫", "🍝", "🍜",
      "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧"
    ]
  },
  "activities": {
    name: "Activities",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍",
      "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛷", "⛸️", "🥌", "🎿",
      "⛷️", "🏂", "🪂", "🏋️‍♀️", "🏋️", "🏋️‍♂️", "🤼‍♀️", "🤼", "🤼‍♂️", "🤸‍♀️", "🤸", "🤸‍♂️", "⛹️‍♀️", "⛹️", "⛹️‍♂️",
      "🤺", "🤾‍♀️", "🤾", "🤾‍♂️", "🏌️‍♀️", "🏌️", "🏌️‍♂️", "🏇", "🧘‍♀️", "🧘", "🧘‍♂️", "🏄‍♀️", "🏄", "🏄‍♂️", "🏊‍♀️", "🏊"
    ]
  },
  "travel": {
    name: "Travel & Places",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍️", "🛵",
      "🚲", "🛴", "🛺", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄",
      "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🛩️", "💺", "🛰️", "🚀", "🛸", "🚁",
      "🛶", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "⚓", "⛽", "🚧", "🚦", "🚥", "🗺️", "🗿", "🗽", "🗼"
    ]
  },
  "objects": {
    name: "Objects",
    emojis: [
      "⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💽", "💾", "💿", "📀", "📼",
      "📷", "📸", "📹", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "🧭", "⏱️",
      "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🪔", "🧯", "🛢️", "💸", "💵",
      "💴", "💶", "💷", "🪙", "💰", "💳", "💎", "⚖️", "🪜", "🧰", "🪛", "🔧", "🔨", "⚒️", "🛠️", "⛏️"
    ]
  },
  "symbols": {
    name: "Symbols",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈",
      "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳",
      "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚", "💮", "🉐", "㊙️", "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️"
    ]
  },
  "flags": {
    name: "Flags",
    emojis: [
      "🏁", "🚩", "🎌", "🏴", "🏳️", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️", "🇦🇨", "🇦🇩", "🇦🇪", "🇦🇫", "🇦🇬", "🇦🇮", "🇦🇱", "🇦🇲",
      "🇦🇴", "🇦🇶", "🇦🇷", "🇦🇸", "🇦🇹", "🇦🇺", "🇦🇼", "🇦🇽", "🇦🇿", "🇧🇦", "🇧🇧", "🇧🇩", "🇧🇪", "🇧🇫", "🇧🇬", "🇧🇭",
      "🇧🇮", "🇧🇯", "🇧🇱", "🇧🇲", "🇧🇳", "🇧🇴", "🇧🇶", "🇧🇷", "🇧🇸", "🇧🇹", "🇧🇻", "🇧🇼", "🇧🇾", "🇧🇿", "🇨🇦", "🇨🇨"
    ]
  }
};

export function IconEmojiPicker({ open, onOpenChange, onSelect, value }: IconEmojiPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("finance");

  // Filter icons based on search term and category
  const filteredIcons = iconOptions.filter(icon => {
    const matchesSearch = icon.label.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || icon.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const iconCategories = Array.from(new Set(iconOptions.map(icon => icon.category)));

  // Filter emojis based on search term
  const getFilteredEmojis = (emojis: string[]) => {
    if (!searchTerm) return emojis;
    return emojis.filter(emoji => {
      // Simple emoji search - could be enhanced with descriptions
      return emoji.includes(searchTerm);
    });
  };

  const handleSelect = (selectedValue: string) => {
    onSelect(selectedValue);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose Icon/Emoji</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="icons" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="icons">Icons</TabsTrigger>
              <TabsTrigger value="emojis">Emojis</TabsTrigger>
            </TabsList>
            
            <TabsContent value="icons" className="space-y-4">
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                >
                  All
                </Button>
                {iconCategories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className="capitalize"
                  >
                    {category}
                  </Button>
                ))}
              </div>

              {/* Icon Grid */}
              <div className="grid grid-cols-8 gap-2 max-h-96 overflow-y-auto p-2">
                {filteredIcons.map((icon) => (
                  <Button
                    key={icon.value}
                    variant={value === icon.value ? "default" : "outline"}
                    className="aspect-square p-2 text-2xl hover:scale-110 transition-transform"
                    onClick={() => handleSelect(icon.value)}
                    title={icon.label}
                  >
                    {icon.value}
                  </Button>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="emojis" className="space-y-4">
              <div className="max-h-96 overflow-y-auto space-y-4">
                {Object.entries(emojiCategories).map(([categoryKey, category]) => {
                  const filteredEmojis = getFilteredEmojis(category.emojis);
                  if (filteredEmojis.length === 0) return null;
                  
                  return (
                    <div key={categoryKey}>
                      <h3 className="font-medium text-sm text-gray-700 mb-2">
                        {category.name}
                      </h3>
                      <div className="grid grid-cols-10 gap-1">
                        {filteredEmojis.map((emoji, index) => (
                          <Button
                            key={`${categoryKey}-${index}`}
                            variant={value === emoji ? "default" : "ghost"}
                            className="aspect-square p-1 text-lg hover:scale-110 transition-transform"
                            onClick={() => handleSelect(emoji)}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
