import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Briefcase, Camera, User } from "lucide-react";

import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { api } from "../services/api";
import {
  isAdmin,
  normalizeTipo,
  saveSessionUser,
  type TipoUsuario,
} from "../services/auth";

type AccessRole = "cliente" | "prestador";
type RegisterField =
  | "nome"
  | "email"
  | "senha"
  | "cpf"
  | "telefone"
  | "endereco"
  | "cidade"
  | "estado"
  | "cep";
type RegisterErrors = Partial<Record<RegisterField, string>>;

const roleConfig = {
  cliente: {
    label: "Cliente",
    headline: "Encontre o profissional ideal",
    sub: "Solicite servicos, compare orcamentos e contrate com seguranca.",
    badge: "PARA CLIENTES",
    gradient: "bg-blue-600",
    badgeBg: "bg-blue-500/30",
    btnClass: "bg-blue-600 hover:bg-blue-700 text-white",
    tabActive: "bg-white text-blue-700 shadow",
    icon: User,
  },
  prestador: {
    label: "Profissional",
    headline: "Transforme seu talento em renda",
    sub: "Cadastre-se, receba pedidos e expanda seu negocio.",
    badge: "PARA PROFISSIONAIS",
    gradient: "bg-orange-500",
    badgeBg: "bg-orange-400/30",
    btnClass: "bg-orange-500 hover:bg-orange-600 text-white",
    tabActive: "bg-white text-orange-600 shadow",
    icon: Briefcase,
  },
} as const;

function getDefaultRedirect(role: TipoUsuario | ""): string {
  if (role === "admin") return "/admin";
  if (role === "prestador") return "/prestador";
  return "/dashboard";
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function formatCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
}

function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function getPasswordStrength(password: string): { label: string; tone: string } {
  if (!password) return { label: "Digite uma senha", tone: "text-gray-500" };

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: "Forca: fraca", tone: "text-red-600" };
  if (score <= 3) return { label: "Forca: media", tone: "text-amber-600" };
  return { label: "Forca: forte", tone: "text-green-600" };
}

function mapApiError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("cpf ja cadastrado") || normalized.includes("cpf já cadastrado")) {
    return "CPF ja cadastrado. Tente entrar ou use outro CPF.";
  }
  if (
    normalized.includes("e-mail ja cadastrado") ||
    normalized.includes("e-mail já cadastrado") ||
    normalized.includes("email ja cadastrado") ||
    normalized.includes("email já cadastrado")
  ) {
    return "E-mail ja cadastrado. Tente entrar ou use outro e-mail.";
  }
  return message;
}

function validateRegisterData(data: {
  nome: string;
  email: string;
  senha: string;
  cpf: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
}): RegisterErrors {
  const errors: RegisterErrors = {};

  if (!data.nome.trim()) errors.nome = "Informe seu nome completo.";
  if (!data.email.trim() || !data.email.includes("@")) errors.email = "Informe um e-mail valido.";
  if (data.senha.length < 6) errors.senha = "A senha deve ter pelo menos 6 caracteres.";
  if (onlyDigits(data.cpf).length !== 11) errors.cpf = "CPF deve conter 11 digitos.";
  if (onlyDigits(data.telefone).length < 10) errors.telefone = "Telefone deve conter DDD + numero.";
  if (!data.endereco.trim()) errors.endereco = "Informe um endereco.";
  if (!data.cidade.trim()) errors.cidade = "Informe a cidade.";
  if (data.estado.trim().length !== 2) errors.estado = "UF deve ter 2 letras.";
  if (onlyDigits(data.cep).length !== 8) errors.cep = "CEP deve conter 8 digitos.";

  return errors;
}

export function Access() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlTipo = normalizeTipo(searchParams.get("tipo") ?? "") as TipoUsuario | "";
  const roleFromUrl: AccessRole = urlTipo === "prestador" ? "prestador" : "cliente";
  const redirectTo = searchParams.get("redirect") || getDefaultRedirect(urlTipo);

  const [role, setRole] = useState<AccessRole>(roleFromUrl);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", senha: "" });
  const [registerData, setRegisterData] = useState({
    nome: "",
    email: "",
    senha: "",
    cpf: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    foto: "",
    tipo: roleFromUrl as AccessRole,
  });
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({});

  const passwordStrength = getPasswordStrength(registerData.senha);
  const cfg = roleConfig[role];
  const Icon = cfg.icon;

  useEffect(() => {
    setRole(roleFromUrl);
    setRegisterData((prev) => ({ ...prev, tipo: roleFromUrl }));
  }, [roleFromUrl]);

  function switchRole(nextRole: AccessRole) {
    setRole(nextRole);
    setError("");
    setRegisterErrors({});
    setRegisterData((prev) => ({ ...prev, tipo: nextRole }));
  }

  function clearRegisterFieldError(field: RegisterField) {
    setRegisterErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validateRole(tipo: string): boolean {
    if (!urlTipo) return true;
    return normalizeTipo(tipo) === urlTipo;
  }

  const handleProfilePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRegisterData((prev) => ({
        ...prev,
        foto: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await api.login({ email: loginData.email.trim(), senha: loginData.senha });

      if (isAdmin(user)) {
        saveSessionUser(user);
        navigate("/admin", { replace: true });
        return;
      }

      if (!validateRole(user.tipo)) {
        setError(`Sua conta nao possui acesso de ${cfg.label}.`);
        return;
      }

      saveSessionUser(user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? mapApiError(err.message) : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setRegisterErrors({});
    setLoading(true);

    try {
      const validationErrors = validateRegisterData(registerData);
      if (Object.keys(validationErrors).length > 0) {
        setRegisterErrors(validationErrors);
        throw new Error("Revise os campos destacados.");
      }

      const payload = {
        ...registerData,
        nome: registerData.nome.trim(),
        email: registerData.email.trim(),
        endereco: registerData.endereco.trim(),
        cidade: registerData.cidade.trim(),
        estado: registerData.estado.trim().toUpperCase(),
        tipo: role,
      };

      await api.register(payload);
      const user = await api.login({ email: payload.email, senha: payload.senha });
      saveSessionUser(user);
      navigate(getDefaultRedirect(normalizeTipo(user.tipo)), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? mapApiError(err.message) : "Falha ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {!urlTipo && (
          <div className="grid grid-cols-2 bg-gray-100">
            {(["cliente", "prestador"] as const).map((r) => {
              const activeColors: Record<AccessRole, string> = {
                cliente: "bg-white text-blue-700 border-b-2 border-blue-600",
                prestador: "bg-white text-orange-600 border-b-2 border-orange-500",
              };
              const labels: Record<AccessRole, string> = {
                cliente: "Cliente",
                prestador: "Profissional",
              };
              const RoleIcon = roleConfig[r].icon;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => switchRole(r)}
                  className={`flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                    role === r ? activeColors[r] : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <RoleIcon size={13} />
                  {labels[r]}
                </button>
              );
            })}
          </div>
        )}

        <div className={`${cfg.gradient} px-6 py-8 text-white`}>
          <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${cfg.badgeBg} mb-3 tracking-wider`}>
            {cfg.badge}
          </span>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2">
              <Icon size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{cfg.headline}</h1>
              <p className="text-sm opacity-80 mt-0.5">{cfg.sub}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`py-2 text-sm font-medium rounded-md transition-all ${
                mode === "login" ? cfg.tabActive : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`py-2 text-sm font-medium rounded-md transition-all ${
                mode === "register" ? cfg.tabActive : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Cadastrar
            </button>
          </div>

          <div aria-live="polite" className="space-y-2">
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
            {loading && <p className="text-xs text-gray-500">Processando, aguarde...</p>}
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="********"
                  value={loginData.senha}
                  onChange={(e) => setLoginData((prev) => ({ ...prev, senha: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${cfg.btnClass}`}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="register-name">Nome completo</Label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Seu nome"
                  value={registerData.nome}
                  aria-invalid={!!registerErrors.nome}
                  onChange={(e) => {
                    clearRegisterFieldError("nome");
                    setRegisterData((prev) => ({ ...prev, nome: e.target.value }));
                  }}
                  required
                />
                {registerErrors.nome && <p className="text-xs text-red-600">{registerErrors.nome}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-photo">Foto de perfil</Label>
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-full bg-white ring-2 ring-white shadow-sm flex items-center justify-center">
                      {registerData.foto ? (
                        <img src={registerData.foto} alt="Previa do perfil" className="h-full w-full object-cover" />
                      ) : (
                        <Camera className="text-gray-400" size={22} />
                      )}
                    </div>
                    <div className="flex-1">
                      <Input id="register-photo" type="file" accept="image/*" onChange={handleProfilePhotoChange} />
                      <p className="mt-2 text-xs text-gray-500">Essa foto aparecera no seu perfil e nos orcamentos enviados.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-email">E-mail</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={registerData.email}
                  aria-invalid={!!registerErrors.email}
                  onChange={(e) => {
                    clearRegisterFieldError("email");
                    setRegisterData((prev) => ({ ...prev, email: e.target.value }));
                  }}
                  required
                />
                {registerErrors.email && <p className="text-xs text-red-600">{registerErrors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-password">Senha</Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder="Minimo 6 caracteres"
                  value={registerData.senha}
                  aria-invalid={!!registerErrors.senha}
                  onChange={(e) => {
                    clearRegisterFieldError("senha");
                    setRegisterData((prev) => ({ ...prev, senha: e.target.value }));
                  }}
                  required
                />
                <p className={`text-xs ${passwordStrength.tone}`}>{passwordStrength.label}</p>
                {registerErrors.senha && <p className="text-xs text-red-600">{registerErrors.senha}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-cpf">CPF</Label>
                <Input
                  id="register-cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={registerData.cpf}
                  inputMode="numeric"
                  maxLength={14}
                  aria-invalid={!!registerErrors.cpf}
                  onChange={(e) => {
                    clearRegisterFieldError("cpf");
                    setRegisterData((prev) => ({ ...prev, cpf: formatCpf(e.target.value) }));
                  }}
                  required
                />
                {registerErrors.cpf && <p className="text-xs text-red-600">{registerErrors.cpf}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-phone">Telefone</Label>
                <Input
                  id="register-phone"
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={registerData.telefone}
                  inputMode="numeric"
                  maxLength={15}
                  aria-invalid={!!registerErrors.telefone}
                  onChange={(e) => {
                    clearRegisterFieldError("telefone");
                    setRegisterData((prev) => ({ ...prev, telefone: formatPhone(e.target.value) }));
                  }}
                  required
                />
                {registerErrors.telefone && <p className="text-xs text-red-600">{registerErrors.telefone}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-address">Endereco</Label>
                <Input
                  id="register-address"
                  type="text"
                  placeholder="Rua, numero e complemento"
                  value={registerData.endereco}
                  aria-invalid={!!registerErrors.endereco}
                  onChange={(e) => {
                    clearRegisterFieldError("endereco");
                    setRegisterData((prev) => ({ ...prev, endereco: e.target.value }));
                  }}
                  required
                />
                {registerErrors.endereco && <p className="text-xs text-red-600">{registerErrors.endereco}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="register-city">Cidade</Label>
                  <Input
                    id="register-city"
                    type="text"
                    placeholder="Cidade"
                    value={registerData.cidade}
                    aria-invalid={!!registerErrors.cidade}
                    onChange={(e) => {
                      clearRegisterFieldError("cidade");
                      setRegisterData((prev) => ({ ...prev, cidade: e.target.value }));
                    }}
                    required
                  />
                  {registerErrors.cidade && <p className="text-xs text-red-600">{registerErrors.cidade}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-state">Estado (UF)</Label>
                  <Input
                    id="register-state"
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={registerData.estado}
                    aria-invalid={!!registerErrors.estado}
                    onChange={(e) => {
                      clearRegisterFieldError("estado");
                      setRegisterData((prev) => ({
                        ...prev,
                        estado: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase(),
                      }));
                    }}
                    required
                  />
                  {registerErrors.estado && <p className="text-xs text-red-600">{registerErrors.estado}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-cep">CEP</Label>
                <Input
                  id="register-cep"
                  type="text"
                  placeholder="00000-000"
                  value={registerData.cep}
                  inputMode="numeric"
                  maxLength={9}
                  aria-invalid={!!registerErrors.cep}
                  onChange={(e) => {
                    clearRegisterFieldError("cep");
                    setRegisterData((prev) => ({ ...prev, cep: formatCep(e.target.value) }));
                  }}
                  required
                />
                {registerErrors.cep && <p className="text-xs text-red-600">{registerErrors.cep}</p>}
              </div>

              <div
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 ${
                  role === "prestador" ? "border-orange-300 bg-orange-50" : "border-blue-200 bg-blue-50"
                }`}
              >
                <Icon size={16} className={role === "prestador" ? "text-orange-500" : "text-blue-600"} />
                <span className={`text-sm font-medium ${role === "prestador" ? "text-orange-700" : "text-blue-700"}`}>
                  Cadastrando como {cfg.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="submit" disabled={loading} className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${cfg.btnClass}`}>
                  {loading ? "Cadastrando..." : "Criar conta"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setRegisterErrors({});
                    setRegisterData((prev) => ({
                      ...prev,
                      nome: "",
                      email: "",
                      senha: "",
                      cpf: "",
                      telefone: "",
                      endereco: "",
                      cidade: "",
                      estado: "",
                      cep: "",
                      foto: "",
                    }));
                  }}
                  className="w-full py-2.5 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Limpar
                </button>
              </div>
            </form>
          )}

          <div className="text-center text-sm text-gray-500">
            <Link to="/" className="hover:underline">
              {"<- Voltar para o inicio"}
            </Link>
            <span className="mx-2">*</span>
            <Link to="/centro-ajuda" className="hover:underline">
              Precisa de ajuda?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
