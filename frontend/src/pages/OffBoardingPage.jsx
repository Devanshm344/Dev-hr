import React, { useState } from 'react'
import { UserMinus, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Container from '../components/ui/Container'
import { BRAND_GRADIENT } from '../theme/colors'

// NOTE: This is a mock/UI-only version dumped in from the Offboarding-main
// project. It is intentionally NOT wired to the backend — submitting the
// exit interview only updates local state. Real submitResignation /
// getMyOffboarding API integration will be added back in a later pass.

// -----------------------------
// Exit interview question set
// -----------------------------
const EXIT_INTERVIEW = {
  designation: { id: 'designation', question: 'Designation', type: 'input' },
  columns: [
    [
      { id: 'mostSatisfying', question: 'What was most satisfying about your job?', type: 'textarea' },
      { id: 'likedBest', question: 'What did you like best about Cotelligent India?', type: 'textarea' },
      { id: 'relationships', question: 'Describe your relationship and experience with the persons you interacted with:', type: 'textarea' },
      { id: 'reasonForLeaving', question: 'What is your primary reason for leaving?', type: 'textarea' },
      { id: 'payAndBenefits', question: 'Were you happy with your pay, benefits and other incentives?', type: 'textarea' },
      { id: 'suggestions', question: 'What suggestions do you have for improvement, at Cotelligent India?', type: 'textarea' },
    ],
    [
      { id: 'leastSatisfying', question: 'What was least satisfying about your job?', type: 'textarea' },
      { id: 'likedLeast', question: 'What did you like least about Cotelligent India?', type: 'textarea' },
      { id: 'obstacles', question: 'Did any company policies or procedures (or any other obstacles) make your job more difficult?', type: 'textarea' },
      { id: 'nextCompany', question: 'What company and position are you going to (if applicable)?', type: 'textarea' },
      { id: 'wouldRecommend', question: 'Would you recommend working for this company to your family and friends?', type: 'input' },
      { id: 'otherComments', question: 'What other comments would you like to make?', type: 'textarea' },
      { id: 'undertakingForm', question: 'Undertaking Form', type: 'input' },
    ],
  ],
}

function QAField({ id, question, type, value, onChange }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-b-0">
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 mb-1.5">
        {question}
      </label>
      {type === 'textarea' ? (
        <textarea
          id={id}
          rows={2}
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          required
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          required
        />
      )}
    </div>
  )
}

function ExitProcessWarningModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exit-warning-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-gray-100 shadow-xl max-w-md w-full p-6"
      >
        <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
          <AlertCircle size={22} className="text-amber-600" />
        </div>
        <h2 id="exit-warning-title" className="text-lg font-bold text-gray-900 mb-2">
          Before you start
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Submitting this form will initiate your exit process. Please ensure you have consulted with your manager before continuing.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmResignationModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-resignation-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-gray-100 shadow-xl max-w-md w-full p-6"
      >
        <h2 id="confirm-resignation-title" className="text-lg font-bold text-gray-900 mb-2">
          Do you want to confirm resignation?
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          This will submit your exit interview and finalize your resignation from TechDemocracy.
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
          >
            Confirm Resignation
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OffBoardingPage() {
  const { designation, columns } = EXIT_INTERVIEW
  const allFields = [designation, ...columns[0], ...columns[1]]

  const [showForm, setShowForm] = useState(false)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [answers, setAnswers] = useState(
    Object.fromEntries(allFields.map((field) => [field.id, '']))
  )

  const handleChange = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    setShowConfirmModal(true)
  }

  const handleConfirmResignation = () => {
    setShowConfirmModal(false)
    setShowForm(false)
    setSubmitted(true)
    toast.success('Resignation submitted (mock — not saved to any backend)')
  }

  const handleCancelConfirm = () => setShowConfirmModal(false)

  const handleCancelForm = () => setShowForm(false)

  const handleStartResignation = () => setShowWarningModal(true)

  const handleConfirmWarning = () => {
    setShowWarningModal(false)
    setShowForm(true)
  }

  const handleCancelWarning = () => setShowWarningModal(false)

  return (
    <Container>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: BRAND_GRADIENT }}
          >
            <UserMinus size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Offboarding</h1>
            <p className="text-xs text-gray-500">Manage your exit process</p>
          </div>
        </div>
        {!showForm && !submitted && (
          <button
            onClick={handleStartResignation}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
            style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
          >
            <UserMinus size={16} /> Submit Resignation
          </button>
        )}
      </div>

      {showWarningModal && (
        <ExitProcessWarningModal
          onConfirm={handleConfirmWarning}
          onCancel={handleCancelWarning}
        />
      )}

      {/* Exit interview form */}
      {showForm && !submitted && (
        <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
            <div>
              <QAField {...designation} value={answers[designation.id]} onChange={handleChange} />
              {columns[0].map((field) => (
                <QAField key={field.id} {...field} value={answers[field.id]} onChange={handleChange} />
              ))}
            </div>
            <div>
              {columns[1].map((field) => (
                <QAField key={field.id} {...field} value={answers[field.id]} onChange={handleChange} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleCancelForm}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
            >
              Submit
            </button>
          </div>

          {showConfirmModal && (
            <ConfirmResignationModal
              onConfirm={handleConfirmResignation}
              onCancel={handleCancelConfirm}
            />
          )}
        </form>
      )}

      {/* Mock "submitted" state */}
      {submitted && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
          <p className="text-gray-900 font-semibold">Resignation submitted</p>
          <p className="text-gray-400 text-sm mt-1">
            This is a mock confirmation — nothing was sent to the server.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!showForm && !submitted && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <UserMinus size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No active offboarding process</p>
          <p className="text-gray-400 text-sm mt-1">Use "Submit Resignation" to initiate your exit process</p>
        </div>
      )}
    </Container>
  )
}
