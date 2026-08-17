import React from 'react'
import CalendarWidget  from './CalendarWidget'
import HolidayWidget   from './HolidayWidget'
import BirthdayWidget  from './BirthdayWidget'

export default function DashboardSidebar() {
  return (
    <aside className="w-72 xl:w-80 shrink-0 hidden lg:flex flex-col gap-4 self-start sticky top-0">
      <CalendarWidget />
      <HolidayWidget  />
      <BirthdayWidget />
    </aside>
  )
}
