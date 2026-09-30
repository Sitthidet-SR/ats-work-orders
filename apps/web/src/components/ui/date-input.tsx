'use client';
import { useEffect, useRef, useState, type Ref } from 'react';
import { CalendarDays } from 'lucide-react';

function displayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${Number(match[1]) + 543}` : '';
}
function parseDate(value: string) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return '';
  const [, day, month, year] = match;
  const ceYear = Number(year) - 543;
  if (ceYear < 2000 || ceYear > 2099) return '';
  const iso = `${ceYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : '';
}

export function DateInput({
  value,
  onChange,
  onBlur,
  inputRef,
  name,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  name?: string;
  label: string;
}) {
  const [text, setText] = useState(() => displayDate(value));
  const lastValue = useRef(value);
  const calendar = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setText(displayDate(value));
    }
  }, [value]);
  return (
    <div className="relative">
      <input
        ref={inputRef}
        name={name}
        aria-label={label}
        placeholder="วว/ดด/ปปปป"
        title="ใช้ปี พ.ศ. เช่น 01/10/2569"
        className="pr-12"
        value={text}
        maxLength={10}
        onChange={(event) => {
          setText(event.target.value);
          const iso = parseDate(event.target.value);
          lastValue.current = iso;
          onChange(iso);
        }}
        onBlur={() => {
          if (value) setText(displayDate(value));
          onBlur?.();
        }}
      />
      <button
        type="button"
        aria-label={`เลือก${label}จากปฏิทิน`}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-800"
        onClick={() => calendar.current?.showPicker()}
      >
        <CalendarDays size={17} />
      </button>
      <input
        ref={calendar}
        type="date"
        aria-label={`ปฏิทิน${label}`}
        tabIndex={-1}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 border-0 p-0 opacity-0"
        value={value}
        min="2000-01-01"
        max="2099-12-31"
        onChange={(event) => {
          const iso = event.target.value;
          lastValue.current = iso;
          setText(displayDate(iso));
          onChange(iso);
          onBlur?.();
        }}
      />
    </div>
  );
}
