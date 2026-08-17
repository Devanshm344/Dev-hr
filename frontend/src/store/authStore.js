import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Normalise legacy role values from old sessions to the current RBAC tiers.
// New sessions already receive 'Super Admin', 'Admin', or 'Employee' from the API.
function normalizeRole(role) {
  if (!role) return 'Employee'
  if (role === 'Super Admin' || role === 'Admin' || role === 'Employee') return role
  if (role === 'admin' || role === 'hr_manager') return 'Admin'
  return 'Employee'
}

function normalizeUser(user) {
  if (!user) return null
  return { ...user, role: normalizeRole(user.role) }
}

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => {
        set({ user: normalizeUser(user), token, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
        localStorage.removeItem('hrms-auth')
      },

      updateUser: (user) => set({ user: normalizeUser(user) }),
    }),
    {
      name: 'hrms-auth',
      // Migrate persisted sessions with legacy role values on rehydration
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          state.user = normalizeUser(state.user)
        }
      },
    }
  )
)
