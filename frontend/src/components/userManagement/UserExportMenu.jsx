import React, { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText, MoreHorizontal, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportUsersCsv, exportUsersExcel, exportUsersPdf } from '../../services/api'

function triggerDownload(blobData, filename) {
  const url = URL.createObjectURL(new Blob([blobData]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Same trigger-icon dropdown shape as ShiftRosterPage's ExportMenu, but
 * wired to the real user_management export endpoints (blob download, same
 * pattern PolicyPage/EmployeePolicyPage already use for document downloads)
 * instead of "coming soon" placeholder actions.
 */
export default function UserExportMenu({ params, onImportClick }) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const download = async (format) => {
    setDownloading(format)
    try {
      const fn = { csv: exportUsersCsv, excel: exportUsersExcel, pdf: exportUsersPdf }[format]
      const ext = { csv: 'csv', excel: 'xlsx', pdf: 'pdf' }[format]
      const res = await fn(params)
      triggerDownload(res.data, `users_export.${ext}`)
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`)
    } finally {
      setDownloading(null)
      setOpen(false)
    }
  }

  const items = [
    ...(onImportClick ? [{ icon: Upload, label: 'Import CSV', action: onImportClick }] : []),
    { icon: Download, label: 'Export CSV', action: () => download('csv') },
    { icon: FileSpreadsheet, label: 'Export Excel', action: () => download('excel') },
    { icon: FileText, label: 'Export PDF', action: () => download('pdf') },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors border border-gray-200"
        disabled={!!downloading}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-30">
          {items.map(item => (
            <button
              key={item.label}
              onClick={item.action}
              disabled={!!downloading}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <item.icon size={14} className="text-gray-400" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
