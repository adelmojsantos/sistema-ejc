import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, ShieldCheck } from 'lucide-react';

/**
 * Página de Política de Privacidade — LGPD Art. 9º (transparência) e Art. 18 (direitos do titular).
 * Informa ao titular: finalidade, quem é o controlador, quais dados, retenção e como exercer direitos.
 */
export function PrivacidadePage() {
    const orgName = 'EJC Capelinha';
    const contactEmail = 'contato@ejccapelinha.com.br';
    const updatedAt = '20/03/2026';

    return (
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
            <nav style={{ marginBottom: '2rem' }}>
                <Link
                    to="/"
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        color: 'var(--primary-color)', textDecoration: 'none',
                        fontWeight: 600, fontSize: '0.9rem',
                    }}
                >
                    <ArrowLeft size={16} /> Voltar para a página inicial
                </Link>
            </nav>

            <header style={{ marginBottom: '2.5rem' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    marginBottom: '0.75rem',
                }}>
                    <ShieldCheck size={32} color="var(--primary-color)" />
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>
                        Política de Privacidade
                    </h1>
                </div>
                <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>
                    Última atualização: {updatedAt}
                </p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', lineHeight: 1.7 }}>

                <section>
                    <h2>1. Quem somos (Controlador de Dados)</h2>
                    <p>
                        O <strong>{orgName}</strong> é o controlador dos dados pessoais coletados por
                        meio deste site e sistema de gestão. Missão: organizar a participação de
                        jovens no Encontro de Jovens com Cristo, evento de formação espiritual e
                        comunitária.
                    </p>
                    <p>
                        Em caso de dúvidas sobre o tratamento dos seus dados, entre em contato:
                    </p>
                    <a
                        href={`mailto:${contactEmail}`}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            color: 'var(--primary-color)', fontWeight: 600,
                        }}
                    >
                        <Mail size={16} /> {contactEmail}
                    </a>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                <section>
                    <h2>2. Quais dados coletamos e para quê</h2>
                    <p>
                        Coletamos somente os dados necessários para a finalidade indicada
                        (<strong>princípio da minimização — LGPD Art. 6º, III</strong>):
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--card-bg)', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Dado</th>
                                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Finalidade</th>
                                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Base Legal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['Nome completo', 'Identificação e comunicação', 'Consentimento (Art. 7º, I)'],
                                ['Telefone / WhatsApp', 'Contato e confirmação de inscrição', 'Consentimento (Art. 7º, I)'],
                                ['E-mail', 'Envio de informações do evento (opcional)', 'Consentimento (Art. 7º, I)'],
                                ['Data de nascimento', 'Verificar elegibilidade ao evento', 'Consentimento (Art. 7º, I)'],
                                ['CPF', 'Identificação única para evitar duplicatas', 'Legítimo interesse (Art. 7º, IX)'],
                                ['Endereço', 'Registro do encontrista', 'Consentimento (Art. 7º, I)'],
                                ['Nome do pai / mãe', 'Registro do encontrista', 'Consentimento (Art. 7º, I)'],
                            ].map(([dado, finalidade, base]) => (
                                <tr key={dado}>
                                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>{dado}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>{finalidade}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', opacity: 0.7 }}>{base}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
                        Campos marcados como opcionais no formulário nunca são obrigatórios.
                    </p>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                <section>
                    <h2>3. Por quanto tempo guardamos seus dados</h2>
                    <ul>
                        <li><strong>Pré-cadastros pendentes:</strong> eliminados automaticamente após 6 meses.</li>
                        <li><strong>Pré-cadastros convertidos:</strong> eliminados imediatamente após a efetivação da inscrição.</li>
                        <li><strong>Dados de participantes:</strong> mantidos enquanto forem relevantes para o histórico do evento e eliminados mediante solicitação do titular.</li>
                    </ul>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                <section>
                    <h2>4. Compartilhamento de dados</h2>
                    <p>
                        Seus dados <strong>não são vendidos, alugados ou compartilhados</strong> com
                        terceiros para fins comerciais. Utilizamos a plataforma{' '}
                        <strong>Supabase</strong> (infraestrutura de banco de dados hospedada nos EUA
                        com criptografia em trânsito e em repouso) como suboperador de dados.
                    </p>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                <section>
                    <h2>5. Seus direitos (LGPD Art. 18)</h2>
                    <p>Você tem direito a:</p>
                    <ul>
                        <li>✅ <strong>Confirmar</strong> a existência de tratamento dos seus dados</li>
                        <li>✅ <strong>Acessar</strong> os seus dados que mantemos</li>
                        <li>✅ <strong>Corrigir</strong> dados incompletos, inexatos ou desatualizados</li>
                        <li>✅ <strong>Solicitar a exclusão</strong> dos seus dados (direito ao esquecimento)</li>
                        <li>✅ <strong>Revogar o consentimento</strong> a qualquer momento</li>
                        <li>✅ <strong>Portar</strong> seus dados para outro fornecedor</li>
                    </ul>
                    <p>
                        Para exercer qualquer desses direitos, envie um e-mail para{' '}
                        <a href={`mailto:${contactEmail}`} style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                            {contactEmail}
                        </a>{' '}
                        com o assunto <em>"Direitos LGPD"</em>. Responderemos em até <strong>15 dias úteis</strong>.
                    </p>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                <section>
                    <h2>6. Segurança</h2>
                    <p>
                        Adotamos as seguintes medidas técnicas para proteger seus dados:
                    </p>
                    <ul>
                        <li>Comunicação criptografada via HTTPS/TLS</li>
                        <li>Acesso ao banco de dados restrito por autenticação JWT e regras de segurança a nível de linha (Row Level Security)</li>
                        <li>Tokens de sessão nunca expostos em URLs</li>
                        <li>CPF nunca exibido em formato completo para operadores</li>
                        <li>Controle de acesso por perfil de usuário (admin, secretaria, visitação)</li>
                    </ul>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

                <section>
                    <h2>7. Alterações nesta política</h2>
                    <p>
                        Em caso de alterações relevantes, publicaremos a nova versão nesta página com
                        a data de atualização. Recomendamos a leitura periódica.
                    </p>
                </section>

                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    background: 'color-mix(in srgb, var(--primary-color) 8%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--primary-color) 25%, transparent)',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                }}>
                    <Lock size={20} color="var(--primary-color)" style={{ flexShrink: 0 }} />
                    <span>
                        Esta política está em conformidade com a{' '}
                        <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</strong>.
                    </span>
                </div>
            </div>
        </div>
    );
}
