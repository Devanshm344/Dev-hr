import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { getLeaveTypes } from '../services/api'
import Container from '../components/ui/Container'
import ApplyLeaveForm from '../components/leave/ApplyLeaveForm'

export default function ApplyLeavePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialDates = location.state?.initialDates || {}
  const [leaveTypes, setLeaveTypes] = useState([])

  useEffect(() => {
    getLeaveTypes().then(res => setLeaveTypes(res.data || [])).catch(() => {})
  }, [])

  const backToDashboard = () => navigate('/leave')

  return (
    <Container className="max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apply Leave</h1>
          <p className="text-xs text-gray-500 mt-0.5">Submit a new leave request</p>
        </div>
        <button
          type="button"
          onClick={backToDashboard}
          aria-label="Close"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <ApplyLeaveForm
        leaveTypes={leaveTypes}
        initialDates={initialDates}
        onSuccess={backToDashboard}
        onCancel={backToDashboard}
      />
    </Container>
  )
}
