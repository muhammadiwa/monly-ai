import * as React from "react"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, subYears } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DatePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  disablePast?: boolean
  disableFuture?: boolean
  minDate?: Date
  maxDate?: Date
}

interface DateRangePickerProps {
  dateRange?: DateRange
  onDateRangeChange?: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  presets?: boolean
}

interface QuickSelectPreset {
  label: string
  value: string
  getRange: () => DateRange
}

const quickSelectPresets: QuickSelectPreset[] = [
  {
    label: "Today",
    value: "today",
    getRange: () => {
      const today = new Date()
      return { from: today, to: today }
    }
  },
  {
    label: "Last 7 days",
    value: "last-7-days",
    getRange: () => {
      const today = new Date()
      return { from: subDays(today, 6), to: today }
    }
  },
  {
    label: "Last 30 days",
    value: "last-30-days",
    getRange: () => {
      const today = new Date()
      return { from: subDays(today, 29), to: today }
    }
  },
  {
    label: "This month",
    value: "this-month",
    getRange: () => {
      const today = new Date()
      return { from: startOfMonth(today), to: endOfMonth(today) }
    }
  },
  {
    label: "Last month",
    value: "last-month",
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1)
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
    }
  },
  {
    label: "This year",
    value: "this-year",
    getRange: () => {
      const today = new Date()
      return { from: startOfYear(today), to: endOfYear(today) }
    }
  },
  {
    label: "Last year",
    value: "last-year",
    getRange: () => {
      const lastYear = subYears(new Date(), 1)
      return { from: startOfYear(lastYear), to: endOfYear(lastYear) }
    }
  }
]

export function DatePicker({ 
  date, 
  onDateChange, 
  placeholder = "Pick a date",
  className,
  disabled = false,
  disablePast = false,
  disableFuture = false,
  minDate,
  maxDate
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const isDateDisabled = (checkDate: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (disablePast && checkDate < today) return true
    if (disableFuture && checkDate > today) return true
    if (minDate && checkDate < minDate) return true
    if (maxDate && checkDate > maxDate) return true
    
    return false
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal transition-all duration-200",
            "hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm",
            "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
            !date && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
          <span className={date ? "text-gray-900 font-medium" : ""}>
            {date ? format(date, "PPP") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-white/95 backdrop-blur-sm border border-gray-200 shadow-2xl rounded-xl" 
        align="start"
        sideOffset={4}
      >
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-t-xl">
          <h4 className="font-semibold text-sm">Select Date</h4>
        </div>
        <div className="p-2">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              onDateChange?.(selectedDate)
              setOpen(false)
            }}
            disabled={isDateDisabled}
            initialFocus
            captionLayout="dropdown"
            fromYear={1900}
            toYear={2100}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function DateRangePicker({ 
  dateRange, 
  onDateRangeChange, 
  placeholder = "Pick a date range",
  className,
  disabled = false,
  presets = true
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return placeholder
    if (!range.to) return format(range.from, "LLL dd, y")
    if (range.from.getTime() === range.to.getTime()) {
      return format(range.from, "LLL dd, y")
    }
    return `${format(range.from, "LLL dd, y")} - ${format(range.to, "LLL dd, y")}`
  }

  const handlePresetSelect = (preset: string) => {
    const selectedPreset = quickSelectPresets.find(p => p.value === preset)
    if (selectedPreset) {
      const range = selectedPreset.getRange()
      onDateRangeChange?.(range)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal transition-all duration-200",
            "hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm",
            "focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400",
            !dateRange?.from && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-purple-600" />
          <span className={dateRange?.from ? "text-gray-900 font-medium" : ""}>
            {formatDateRange(dateRange)}
          </span>
          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-white/95 backdrop-blur-sm border border-gray-200 shadow-2xl rounded-xl" 
        align="start"
        sideOffset={4}
      >
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-t-xl">
          <h4 className="font-semibold text-sm">Select Date Range</h4>
        </div>
        <div className="flex">
          {presets && (
            <div className="border-r p-3 space-y-1 min-w-[200px] bg-gray-50/50">
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Quick Select
              </div>
              {quickSelectPresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-sm hover:bg-purple-50 hover:text-purple-700 transition-colors duration-150"
                  onClick={() => {
                    handlePresetSelect(preset.value)
                    setOpen(false)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <div className="pt-3 border-t mt-3">
                <Select onValueChange={handlePresetSelect}>
                  <SelectTrigger className="h-8 text-sm border-gray-300 hover:border-purple-400 focus:ring-purple-500/20">
                    <SelectValue placeholder="More options..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-sm">
                    <SelectItem value="last-3-months">Last 3 months</SelectItem>
                    <SelectItem value="last-6-months">Last 6 months</SelectItem>
                    <SelectItem value="last-12-months">Last 12 months</SelectItem>
                    <SelectItem value="all-time">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="p-3">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
              captionLayout="dropdown"
              fromYear={1900}
              toYear={2100}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function SmartDatePicker({ 
  date, 
  onDateChange, 
  placeholder = "Select date",
  className,
  disabled = false
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const quickDates = [
    { label: "Today", value: new Date() },
    { label: "Yesterday", value: subDays(new Date(), 1) },
    { label: "Start of month", value: startOfMonth(new Date()) },
    { label: "End of month", value: endOfMonth(new Date()) },
  ]

  React.useEffect(() => {
    if (date) {
      setInputValue(format(date, "yyyy-MM-dd"))
    }
  }, [date])

  const handleInputChange = (value: string) => {
    setInputValue(value)
    const parsedDate = new Date(value)
    if (!isNaN(parsedDate.getTime())) {
      onDateChange?.(parsedDate)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal transition-all duration-200",
            "hover:border-green-300 hover:bg-green-50/50 hover:shadow-sm",
            "focus:ring-2 focus:ring-green-500/20 focus:border-green-400",
            !date && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-green-600" />
          <span className={date ? "text-gray-900 font-medium" : ""}>
            {date ? format(date, "PPP") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-white/95 backdrop-blur-sm border border-gray-200 shadow-2xl rounded-xl" 
        align="start"
        sideOffset={4}
      >
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-t-xl">
          <h4 className="font-semibold text-sm">Smart Date Selection</h4>
        </div>
        <div className="p-3 border-b bg-gray-50/50">
          <label htmlFor="manual-date-input" className="text-xs font-medium text-gray-600 mb-1 block">Manual Input</label>
          <input
            id="manual-date-input"
            type="date"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all duration-200"
            placeholder="YYYY-MM-DD"
          />
        </div>
        <div className="p-3 border-b bg-gray-50/50 space-y-2">
          <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Quick Dates
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickDates.map((quick) => (
              <Button
                key={quick.label}
                variant="ghost"
                size="sm"
                className="h-8 text-xs justify-start hover:bg-green-50 hover:text-green-700 transition-colors duration-150"
                onClick={() => {
                  onDateChange?.(quick.value)
                  setOpen(false)
                }}
              >
                {quick.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="p-2">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              onDateChange?.(selectedDate)
              setOpen(false)
            }}
            initialFocus
            captionLayout="dropdown"
            fromYear={1900}
            toYear={2100}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
