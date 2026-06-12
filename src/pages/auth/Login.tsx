import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import logoImg from '../../assets/Akiter-logo.png.png'

export function Login() {
  const { user, signIn } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0f2e1c] flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-[#c9a84c] blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-[#2d6b45] blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Akiter" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-white font-bold text-xl">Akiter</p>
              <p className="text-[#c9a84c] text-xs tracking-widest uppercase">ERP</p>
            </div>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Gestión integral<br />para tu empresa
          </h2>
          <p className="text-white/60 mt-4 text-lg">
            Proyectos, clientes, facturación y más en una sola plataforma.
          </p>
          <div className="mt-8 flex gap-6">
            {['Proyectos', 'Facturación', 'CRM', 'Inventario'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
                <span className="text-white/70 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-sm relative">© 2024 Akiter. Todos los derechos reservados.</p>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src={logoImg} alt="Akiter" className="w-10 h-10 object-contain" />
            <div>
              <p className="text-[#1a4a2e] font-bold text-xl">Akiter ERP</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Iniciar sesión</h1>
          <p className="text-gray-500 mb-8">Accede a tu cuenta de Akiter ERP</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={16} />}
              required
              autoComplete="email"
            />
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={16} />}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
              autoComplete="current-password"
            />
            <Button type="submit" size="lg" className="w-full mt-6" loading={loading}>
              Entrar
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-8">
            ¿Problemas para acceder? Contacta con el administrador.
          </p>
        </div>
      </div>
    </div>
  )
}
