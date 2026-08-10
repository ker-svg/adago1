import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import RoleSelectView from '@/views/RoleSelectView.vue'
import PassengerView from '@/views/PassengerView.vue'
import DriverView from '@/views/DriverView.vue'
import DriverOnboardingView from '@/views/DriverOnboardingView.vue'
import ProfileView from '@/views/ProfileView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import AdminLoginView from '@/views/AdminLoginView.vue'
import AdminView from '@/views/AdminView.vue'
import { useAuthStore } from '@/stores/authStore'
import { useDriverStore } from '@/stores/driverStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { guestOnly: true },
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: AdminLoginView,
      meta: { guestOnly: true, hideNavbar: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAuth: true, role: 'admin', hideNavbar: true },
    },
    {
      path: '/role',
      name: 'role-select',
      component: RoleSelectView,
      meta: { requiresAuth: true },
    },
    {
      path: '/passenger',
      name: 'passenger',
      component: PassengerView,
      meta: { mapPage: true, requiresAuth: true, role: 'passenger' },
    },
    {
      path: '/driver',
      name: 'driver',
      component: DriverView,
      meta: { mapPage: true, requiresAuth: true, role: 'driver' },
    },
    {
      path: '/driver-onboarding',
      name: 'driver-onboarding',
      component: DriverOnboardingView,
      meta: { requiresAuth: true, role: 'driver' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true },
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.initialized) {
    await authStore.initSession()
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    if (!authStore.currentRole) return { name: 'role-select' }
    return authStore.panelPathForRole()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    const loginRoute = to.meta.role === 'admin' ? 'admin-login' : 'login'
    return {
      name: loginRoute,
      query: { redirect: to.fullPath },
    }
  }

  const requiredRole = to.meta.role
  if (requiredRole && authStore.currentRole !== requiredRole) {
    if (!authStore.currentRole) {
      return { name: 'role-select' }
    }
    return authStore.panelPathForRole()
  }

  // Admin asla yolcu/sürücü paneline düşmesin
  if (
    authStore.currentRole === 'admin' &&
    (to.name === 'passenger' || to.name === 'driver' || to.name === 'driver-onboarding')
  ) {
    return { name: 'admin' }
  }

  // Aşama 2: sürücü onboarding zorunlu
  if (authStore.currentRole === 'driver' && authStore.isAuthenticated) {
    const driverStore = useDriverStore()
    try {
      await driverStore.ensureLoaded()
    } catch {
      // Yükleme hatası UI'da gösterilir; rotayı kilitleme
    }

    if (to.name === 'driver' && driverStore.needsOnboarding) {
      return { name: 'driver-onboarding' }
    }

    if (to.name === 'driver-onboarding' && !driverStore.needsOnboarding && driverStore.loaded) {
      return { name: 'driver' }
    }
  }

  return true
})

export default router
