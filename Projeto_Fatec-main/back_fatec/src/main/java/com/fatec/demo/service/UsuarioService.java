package com.fatec.demo.service;

import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fatec.demo.model.Cliente;
import com.fatec.demo.model.Prestador;
import com.fatec.demo.model.Usuario;
import com.fatec.demo.repository.ClienteRepository;
import com.fatec.demo.repository.PrestadorRepository;
import com.fatec.demo.repository.UsuarioRepository;

import jakarta.annotation.PostConstruct;

@Service
public class UsuarioService {

    private static final Logger logger = Logger.getLogger(UsuarioService.class.getName());

    @Autowired
    private UsuarioRepository repository;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private PrestadorRepository prestadorRepository;

    @PostConstruct
    public void normalizeUserStatusColumn() {
        try {
            List<Usuario> usuarios = repository.findAll();
            boolean changed = false;

            for (Usuario u : usuarios) {
                Integer status = u.getStatus();
                Integer expectedFromTipo = mapTipoToStatus(u.getTipo());

                if (status == null) {
                    u.setStatus(expectedFromTipo);
                    changed = true;
                    continue;
                }

                // Keep ADMIN PRINCIPAL as-is; for others, align tipo and status.
                if (status != Usuario.STATUS_ADMIN_PRINCIPAL) {
                    String tipoAtual = u.getTipo() == null ? "" : u.getTipo().trim().toLowerCase();
                    if ((status == Usuario.STATUS_PRESTADOR && !"prestador".equals(tipoAtual))
                        || (status == Usuario.STATUS_CLIENTE && !"cliente".equals(tipoAtual))
                        || (status == Usuario.STATUS_ADMIN && !"admin".equals(tipoAtual))) {
                        u.setStatus(status);
                        changed = true;
                    }
                }
            }

            if (changed) {
                repository.saveAll(usuarios);
                logger.info("Status dos usuarios normalizado com sucesso.");
            }
        } catch (Exception e) {
            logger.log(Level.WARNING, "Falha ao normalizar coluna status de usuarios", e);
        }
    }

    private Integer mapTipoToStatus(String tipo) {
        String normalized = tipo == null ? "" : tipo.trim().toLowerCase();
        return switch (normalized) {
            case "prestador" -> Usuario.STATUS_PRESTADOR;
            case "admin" -> Usuario.STATUS_ADMIN;
            case "cliente" -> Usuario.STATUS_CLIENTE;
            default -> Usuario.STATUS_CLIENTE;
        };
    }
    
    public List<Usuario> findAll(){
        try {
            return repository.findAll();
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Erro ao buscar todos os usuários", e);
            throw new RuntimeException("Erro ao buscar usuários do banco de dados", e);
        }
    }
    
    public Usuario findById(Long id){
        try {
            if (id == null || id <= 0) {
                throw new IllegalArgumentException("ID inválido deve ser um número positivo");
            }
            return repository.findById(id).orElse(null);
        } catch (IllegalArgumentException e) {
            logger.log(Level.WARNING, "Erro de validação ao buscar usuário", e);
            throw e;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Erro ao buscar usuário com ID: " + id, e);
            throw new RuntimeException("Erro ao buscar usuário do banco de dados", e);
        }
    }
    
    @Transactional
    public Usuario save(Usuario usuario){
        try {
            if (usuario == null) {
                throw new IllegalArgumentException("Usuário não pode ser nulo");
            }
            if (usuario.getNome() == null || usuario.getNome().isBlank()) {
                throw new IllegalArgumentException("Nome é obrigatório");
            }
            if (usuario.getEmail() == null || usuario.getEmail().isBlank()) {
                throw new IllegalArgumentException("E-mail é obrigatório");
            }
            return repository.save(usuario);
        } catch (IllegalArgumentException e) {
            logger.log(Level.WARNING, "Erro de validação ao salvar usuário", e);
            throw e;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Erro ao salvar usuário no banco de dados", e);
            throw new RuntimeException("Erro ao salvar usuário no banco de dados", e);
        }
    }

    @Transactional
    public Usuario register(Usuario usuario){
        try {
            if (usuario == null) {
                throw new IllegalArgumentException("Usuário não pode ser nulo");
            }
            if (usuario.getNome() == null || usuario.getNome().isBlank()) {
                throw new IllegalArgumentException("Nome é obrigatório");
            }
            if (usuario.getEmail() == null || usuario.getEmail().isBlank()) {
                throw new IllegalArgumentException("E-mail é obrigatório");
            }
            String emailNormalizado = usuario.getEmail().trim().toLowerCase();
            if (emailNormalizado.length() > 255) {
                throw new IllegalArgumentException("E-mail muito longo");
            }

            if (repository.findByEmail(emailNormalizado).isPresent()) {
                throw new IllegalArgumentException("E-mail já cadastrado");
            }

            if (usuario.getSenha() == null || usuario.getSenha().isBlank()) {
                throw new IllegalArgumentException("Senha é obrigatória");
            }
            if (usuario.getSenha().length() < 6) {
                throw new IllegalArgumentException("Senha deve ter pelo menos 6 caracteres");
            }

            if (usuario.getCpf() == null || usuario.getCpf().isBlank()) {
                throw new IllegalArgumentException("CPF é obrigatório");
            }
            String cpfNormalizado = usuario.getCpf().replaceAll("\\D", "");
            if (cpfNormalizado.length() != 11) {
                throw new IllegalArgumentException("CPF inválido: deve conter 11 dígitos");
            }
            if (repository.findByCpf(cpfNormalizado).isPresent()) {
                throw new IllegalArgumentException("CPF já cadastrado");
            }

            if (usuario.getTelefone() == null || usuario.getTelefone().isBlank()) {
                throw new IllegalArgumentException("Telefone é obrigatório");
            }
            String telefoneNumerico = usuario.getTelefone().replaceAll("\\D", "");
            if (telefoneNumerico.length() < 10 || telefoneNumerico.length() > 11) {
                throw new IllegalArgumentException("Telefone inválido: informe DDD + número");
            }

            if (usuario.getEndereco() == null || usuario.getEndereco().isBlank()) {
                throw new IllegalArgumentException("Endereço é obrigatório");
            }
            if (usuario.getCidade() == null || usuario.getCidade().isBlank()) {
                throw new IllegalArgumentException("Cidade é obrigatória");
            }
            if (usuario.getEstado() == null || usuario.getEstado().isBlank()) {
                throw new IllegalArgumentException("Estado é obrigatório");
            }

            if (usuario.getCep() == null || usuario.getCep().isBlank()) {
                throw new IllegalArgumentException("CEP é obrigatório");
            }
            String cepNumerico = usuario.getCep().replaceAll("\\D", "");
            if (cepNumerico.length() != 8) {
                throw new IllegalArgumentException("CEP inválido: deve conter 8 dígitos");
            }

            String tipo = usuario.getTipo() == null ? "" : usuario.getTipo().trim().toLowerCase();
            if (!tipo.equals("cliente") && !tipo.equals("prestador")) {
                throw new IllegalArgumentException("Tipo inválido: deve ser cliente ou prestador");
            }

            String senhaHash = hashSha256(usuario.getSenha());
            String estadoNormalizado = usuario.getEstado() != null ? usuario.getEstado().trim().toUpperCase() : "";
            String cidadeNormalizada = usuario.getCidade() != null ? usuario.getCidade().trim() : "";
            String enderecoNormalizado = usuario.getEndereco() != null ? usuario.getEndereco().trim() : "";

            Usuario saved;
            if (tipo.equals("cliente")) {
                Cliente cliente = new Cliente();
                cliente.setTipo("cliente");
                cliente.setNome(usuario.getNome().trim());
                cliente.setEmail(emailNormalizado);
                cliente.setSenha(senhaHash);
                cliente.setCpf(cpfNormalizado);
                cliente.setTelefone(telefoneNumerico);
                cliente.setEndereco(enderecoNormalizado);
                cliente.setCidade(cidadeNormalizada);
                cliente.setEstado(estadoNormalizado);
                cliente.setCep(cepNumerico);
                cliente.setBio(usuario.getBio());
                cliente.setFoto(usuario.getFoto());
                cliente.setAtivo(true);
                cliente.setStatus(Usuario.STATUS_CLIENTE);
                cliente.setApelido(usuario.getNome().trim());
                saved = clienteRepository.save(cliente);
            } else {
                Prestador prestador = new Prestador();
                prestador.setTipo("prestador");
                prestador.setNome(usuario.getNome().trim());
                prestador.setEmail(emailNormalizado);
                prestador.setSenha(senhaHash);
                prestador.setCpf(cpfNormalizado);
                prestador.setTelefone(telefoneNumerico);
                prestador.setEndereco(enderecoNormalizado);
                prestador.setCidade(cidadeNormalizada);
                prestador.setEstado(estadoNormalizado);
                prestador.setCep(cepNumerico);
                prestador.setBio(usuario.getBio());
                prestador.setFoto(usuario.getFoto());
                prestador.setAtivo(true);
                prestador.setStatus(Usuario.STATUS_PRESTADOR);
                prestador.setNomeProfissional(usuario.getNome().trim());
                prestador.setEspecialidade("Serviços gerais");
                prestador.setDescricao(usuario.getBio());
                saved = prestadorRepository.save(prestador);
            }

            logger.info("Novo usuário registrado: " + emailNormalizado + " (" + tipo + ")");
            return saved;
        } catch (IllegalArgumentException e) {
            logger.log(Level.WARNING, "Erro de validação ao registrar usuário", e);
            throw e;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Erro ao registrar usuário no banco de dados", e);
            e.printStackTrace();
            throw new RuntimeException("Erro ao registrar usuário no banco de dados: " + e.getMessage(), e);
        }
    }

    public Usuario login(String email, String senha){
        try {
            if (email == null || email.isBlank()) {
                throw new IllegalArgumentException("E-mail é obrigatório");
            }
            if (senha == null || senha.isBlank()) {
                throw new IllegalArgumentException("Senha é obrigatória");
            }

            String emailNormalizado = email.trim().toLowerCase();

            Usuario usuario = repository.findByEmail(emailNormalizado).orElse(null);
            if (usuario == null) {
                logger.warning("Tentativa de login falhou: " + emailNormalizado);
                return null;
            }

            if (!usuario.isAtivo()) {
                logger.warning("Tentativa de login com usuario bloqueado: " + emailNormalizado);
                throw new IllegalArgumentException("Usuario bloqueado. Contate o administrador.");
            }

            Usuario user = passwordMatches(senha, usuario.getSenha()) ? usuario : null;

            if (user != null) {
                logger.info("Login bem-sucedido: " + emailNormalizado);
            } else {
                logger.warning("Tentativa de login falhou: " + emailNormalizado);
            }

            return user;
        } catch (IllegalArgumentException e) {
            logger.log(Level.WARNING, "Erro de validação ao fazer login", e);
            throw e;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Erro ao fazer login", e);
            throw new RuntimeException("Erro ao fazer login", e);
        }
    }

    @Transactional
    public Usuario update(Long id, Usuario usuario){
        try {
            if (id == null || id <= 0) {
                throw new IllegalArgumentException("ID inválido deve ser um número positivo");
            }
            if (usuario == null) {
                throw new IllegalArgumentException("Usuário não pode ser nulo");
            }

            Usuario existente = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado"));

            if (usuario.getNome() == null || usuario.getNome().isBlank()) {
                throw new IllegalArgumentException("Nome é obrigatório");
            }
            if (usuario.getEmail() == null || usuario.getEmail().isBlank()) {
                throw new IllegalArgumentException("E-mail é obrigatório");
            }

            String emailNormalizado = usuario.getEmail().trim().toLowerCase();
            repository.findByEmail(emailNormalizado)
                .filter(outro -> !outro.getId().equals(id))
                .ifPresent(outro -> {
                    throw new IllegalArgumentException("E-mail já cadastrado");
                });

            String cpfNormalizado = usuario.getCpf() == null
                ? existente.getCpf()
                : usuario.getCpf().replaceAll("\\D", "");
            if (cpfNormalizado == null || cpfNormalizado.isBlank()) {
                throw new IllegalArgumentException("CPF é obrigatório");
            }
            if (cpfNormalizado.length() != 11) {
                throw new IllegalArgumentException("CPF inválido: deve conter 11 dígitos");
            }
            repository.findByCpf(cpfNormalizado)
                .filter(outro -> !outro.getId().equals(id))
                .ifPresent(outro -> {
                    throw new IllegalArgumentException("CPF já cadastrado");
                });

            if (usuario.getTelefone() == null || usuario.getTelefone().isBlank()) {
                throw new IllegalArgumentException("Telefone é obrigatório");
            }
            String telefoneNumerico = usuario.getTelefone().replaceAll("\\D", "");
            if (telefoneNumerico.length() < 10 || telefoneNumerico.length() > 11) {
                throw new IllegalArgumentException("Telefone inválido: informe DDD + número");
            }

            if (usuario.getEndereco() == null || usuario.getEndereco().isBlank()) {
                throw new IllegalArgumentException("Endereço é obrigatório");
            }
            if (usuario.getCidade() == null || usuario.getCidade().isBlank()) {
                throw new IllegalArgumentException("Cidade é obrigatória");
            }
            if (usuario.getEstado() == null || usuario.getEstado().isBlank()) {
                throw new IllegalArgumentException("Estado é obrigatório");
            }
            if (usuario.getCep() == null || usuario.getCep().isBlank()) {
                throw new IllegalArgumentException("CEP é obrigatório");
            }

            String cepNumerico = usuario.getCep().replaceAll("\\D", "");
            if (cepNumerico.length() != 8) {
                throw new IllegalArgumentException("CEP inválido: deve conter 8 dígitos");
            }

            existente.setNome(usuario.getNome().trim());
            existente.setEmail(emailNormalizado);
            existente.setCpf(cpfNormalizado);
            existente.setTelefone(telefoneNumerico);
            existente.setEndereco(usuario.getEndereco().trim());
            existente.setCidade(usuario.getCidade().trim());
            existente.setEstado(usuario.getEstado().trim().toUpperCase());
            existente.setCep(cepNumerico);
            existente.setBio(usuario.getBio() == null ? null : usuario.getBio().trim());
            existente.setFoto(usuario.getFoto());

            if (usuario.getTipo() != null && !usuario.getTipo().isBlank()) {
                String tipoInformado = usuario.getTipo().trim().toLowerCase();
                String tipoAtual = existente.getTipo() == null ? "" : existente.getTipo().trim().toLowerCase();
                if (!tipoInformado.equals(tipoAtual)) {
                    throw new IllegalArgumentException("Não é permitido alterar o tipo de usuário após o cadastro");
                }
            }

            if (usuario.getSenha() != null && !usuario.getSenha().isBlank()) {
                if (usuario.getSenha().length() < 6) {
                    throw new IllegalArgumentException("Senha deve ter pelo menos 6 caracteres");
                }
                existente.setSenha(hashSha256(usuario.getSenha()));
            }

            Usuario atualizado = repository.save(existente);
            logger.info("Usuário atualizado com sucesso: " + atualizado.getEmail());
            return atualizado;
        } catch (IllegalArgumentException e) {
            logger.log(Level.WARNING, "Erro de validação ao atualizar usuário", e);
            throw e;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Erro ao atualizar usuário no banco de dados", e);
            throw new RuntimeException("Erro ao atualizar usuário no banco de dados", e);
        }
    }

    private String hashSha256(String value){
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar hash", e);
        }
    }

    private boolean passwordMatches(String senhaInformada, String senhaBanco) {
        if (senhaInformada == null || senhaInformada.isBlank()) {
            return false;
        }
        if (senhaBanco == null || senhaBanco.isBlank()) {
            return false;
        }

        // Compatibilidade com dados legados: alguns usuários foram persistidos em texto puro.
        if (senhaBanco.matches("^[a-f0-9]{64}$")) {
            return senhaBanco.equals(hashSha256(senhaInformada));
        }

        return senhaBanco.equals(senhaInformada);
    }

    @Transactional
    public void delete(Long id){
        try {
            if (id == null || id <= 0) {
                throw new IllegalArgumentException("ID inválido: deve ser um número positivo");
            }
            if (!repository.existsById(id)) {
                throw new IllegalArgumentException("Usuário não encontrado com ID: " + id);
            }
            repository.deleteById(id);
            logger.info("Usuário deletado com ID: " + id);
        } catch (IllegalArgumentException e) {
            logger.log(Level.WARNING, "Erro de validação ao deletar usuário", e);
            throw e;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Erro ao deletar usuário com ID: " + id, e);
            throw new RuntimeException("Erro ao deletar usuário do banco de dados", e);
        }
    }
}
