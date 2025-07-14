import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

// Custom dropdown component for month/year selection
function CustomDropdown({ value, onChange, children, ...props }: Readonly<DropdownProps>) {
  const options = React.Children.toArray(children) as React.ReactElement[]
  const selected = options.find((child) => child.props.value === value)
  
  const handleValueChange = (val: string) => {
    // Create a synthetic event object that matches what react-day-picker expects
    const syntheticEvent = {
      target: { value: val },
      currentTarget: { value: val },
      preventDefault: () => {},
      stopPropagation: () => {}
    } as React.ChangeEvent<HTMLSelectElement>
    
    onChange?.(syntheticEvent)
  }
  
  return (
    <Select
      value={value?.toString()}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="h-9 w-fit border bg-white/90 hover:bg-white border-gray-200 hover:border-gray-300 px-3 py-1 text-sm font-semibold hover:shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20">
        <SelectValue>
          {selected?.props?.children}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[140px] bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl rounded-lg">
        {options.map((child) => (
          <SelectItem 
            key={child.props.value?.toString() || child.props.children} 
            value={child.props.value?.toString() || ""}
            className="text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150 cursor-pointer"
          >
            {child.props.children}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Icon components outside render
const IconLeft = ({ className, ...props }: React.ComponentProps<typeof ChevronLeft>) => (
  <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
)

const IconRight = ({ className, ...props }: React.ComponentProps<typeof ChevronRight>) => (
  <ChevronRight className={cn("h-4 w-4", className)} {...props} />
)

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown", // Enable dropdown by default
  fromYear = 1900,
  toYear = 2100,
  ...props
}: CalendarProps & {
  captionLayout?: "buttons" | "dropdown" | "dropdown-buttons"
  fromYear?: number
  toYear?: number
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      fromYear={fromYear}
      toYear={toYear}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center gap-2 mb-4",
        caption_label: "text-sm font-medium hidden", // Hide default label when using dropdown
        caption_dropdowns: "flex items-center gap-2",
        dropdown_year: "relative",
        dropdown_month: "relative", 
        dropdown: "relative",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 p-0 opacity-70 hover:opacity-100 transition-all duration-200 shadow-sm hover:shadow-md"
        ),
        nav_button_previous: "absolute left-1 hover:scale-110",
        nav_button_next: "absolute right-1 hover:scale-110",
        table: "w-full border-collapse space-y-1 mt-4",
        head_row: "flex mb-2",
        head_cell:
          "text-muted-foreground rounded-lg w-10 h-10 font-semibold text-xs flex items-center justify-center uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: "h-10 w-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-lg [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 hover:scale-110 rounded-lg"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 focus:from-blue-600 focus:to-blue-700 shadow-lg transform scale-105 font-semibold",
        day_today: "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 font-bold ring-2 ring-orange-300 shadow-sm",
        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground opacity-40 hover:opacity-60",
        day_disabled: "text-muted-foreground/30 opacity-30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground/30 hover:scale-100",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Dropdown: CustomDropdown,
        IconLeft,
        IconRight,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
