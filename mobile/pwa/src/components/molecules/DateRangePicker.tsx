import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  startLabel?: string;
  endLabel?: string;
  startError?: string;
  endError?: string;
  minDate?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = 'Start Date',
  endLabel = 'End Date',
  startError,
  endError,
  minDate = new Date().toISOString().split('T')[0],
}) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Start Date */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
          {startLabel}
        </label>
        <div className="relative">
          <input
            type="date"
            min={minDate}
            value={startDate || ''}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={`w-full px-3 py-2.5 text-xs bg-white dark:bg-zinc-900 border text-zinc-900 dark:text-zinc-100 outline-none transition-colors ${
              startError ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          <Calendar size={14} className="absolute right-3 top-3 text-zinc-400 pointer-events-none" />
        </div>
        {startError && <p className="text-[10px] font-semibold text-red-500 mt-1">{startError}</p>}
      </div>

      {/* End Date */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
          {endLabel}
        </label>
        <div className="relative">
          <input
            type="date"
            min={startDate || minDate}
            value={endDate || ''}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={`w-full px-3 py-2.5 text-xs bg-white dark:bg-zinc-900 border text-zinc-900 dark:text-zinc-100 outline-none transition-colors ${
              endError ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          <Calendar size={14} className="absolute right-3 top-3 text-zinc-400 pointer-events-none" />
        </div>
        {endError && <p className="text-[10px] font-semibold text-red-500 mt-1">{endError}</p>}
      </div>
    </div>
  );
};

