import { expect, test } from '@playwright/test';

test('a raiz leva diretamente ao acesso do sistema', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
});

test('o login oferece saídas públicas claras', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('link', { name: 'Fazer inscrição' }))
    .toHaveAttribute('href', '/inscricao-online');
  await expect(page.getByRole('link', { name: 'Conhecer o EJC' }))
    .toHaveAttribute('href', '/inicio');
});

test('uma rota privada sem sessão retorna ao login', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Entrar no Sistema' })).toBeVisible();
});

test('a recuperação de senha usa link por e-mail', async ({ page }) => {
  await page.goto('/esqueci-senha');

  await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar link de recuperação' })).toBeVisible();
});

test('a redefinição rejeita acesso sem sessão válida', async ({ page }) => {
  await page.goto('/redefinir-senha');

  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Solicitar novo link' }))
    .toHaveAttribute('href', '/esqueci-senha');
});

test('a página institucional continua disponível e acessível', async ({ page }) => {
  await page.goto('/inicio');

  await expect(page.getByRole('heading', {
    name: 'Uma jornada de renovação e novas amizades.',
  })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeAttached();
});

test('a política de privacidade retorna para a área pública', async ({ page }) => {
  await page.goto('/privacidade');

  await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Voltar para a página inicial/ }))
    .toHaveAttribute('href', '/inicio');
});
