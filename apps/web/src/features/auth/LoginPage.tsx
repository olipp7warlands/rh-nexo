import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input } from '@nucleo/ui';
import { useAuth } from './AuthContext';

const schema = z.object({
  email: z.string().min(1, 'Introduce tu email').email('Email no válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Ya autenticado → fuera del login.
  if (user) return <Navigate to="/" replace />;

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--bg-canvas)] px-4">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[var(--ink-primary)] flex items-center justify-center">
            <div className="w-3 h-3 bg-[var(--accent)] rounded-sm" />
          </div>
          <span className="font-serif font-bold text-[20px] tracking-[-0.02em]">humanX</span>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-md)] p-7">
          <h1 className="text-[18px] font-bold tracking-[-0.01em] mb-1">Inicia sesión</h1>
          <p className="text-[13px] text-[var(--ink-secondary)] mb-6">Accede al Core de RRHH del grupo.</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="tu@grupo.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
                {serverError}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full mt-1">
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-[var(--ink-tertiary)] text-center mt-5">humanX · Core de RRHH</p>
      </div>
    </div>
  );
}
