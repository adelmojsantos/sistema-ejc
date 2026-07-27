import { supabase } from '../lib/supabase';
import { getFileExtension, optimizeImageForUpload } from '../utils/imageOptimization';
import { removePublicImage, uploadPublicImage } from './publicImageStorageService';
import type {
  AlmoxarifadoCategoria,
  AlmoxarifadoCompra,
  AlmoxarifadoCompraFinalizarItemInput,
  AlmoxarifadoCompraItem,
  AlmoxarifadoCompraItemUpdate,
  AlmoxarifadoItem,
  AlmoxarifadoItemFormData,
  AlmoxarifadoMovimentacaoInput,
  AlmoxarifadoPedido,
  AlmoxarifadoPedidoFormData,
  AlmoxarifadoPedidoItem,
  AlmoxarifadoPedidoItemFormData,
  AlmoxarifadoSaldo,
  AlmoxarifadoSaldoFormData,
  AlmoxarifadoUnidade,
} from '../types/almoxarifado';

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeNumber = (value: unknown) => Number(value ?? 0);
const MAX_COMPROVANTE_BYTES = 10 * 1024 * 1024;

const normalizeComprovantes = (urls?: unknown): string[] => {
  const list = Array.isArray(urls)
    ? urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];

  return list;
};

const saldoSelect = `
  *,
  item:almoxarifado_itens(
    *,
    categoria:almoxarifado_categorias(id, nome, cor),
    unidade:almoxarifado_unidades(id, nome, sigla),
    equipe_padrao:equipes!almoxarifado_itens_equipe_padrao_id_fkey(id, nome)
  ),
  equipe:equipes(id, nome)
`;

const itemSelect = `
  *,
  categoria:almoxarifado_categorias(id, nome, cor),
  unidade:almoxarifado_unidades(id, nome, sigla),
  equipe_padrao:equipes!almoxarifado_itens_equipe_padrao_id_fkey(id, nome)
`;

const pedidoSelect = `
  *,
  equipe:equipes(id, nome),
  itens:almoxarifado_pedido_itens(
    *,
    item:almoxarifado_itens(
      *,
      categoria:almoxarifado_categorias(id, nome, cor),
      unidade:almoxarifado_unidades(id, nome, sigla),
      equipe_padrao:equipes!almoxarifado_itens_equipe_padrao_id_fkey(id, nome)
    )
  )
`;

const pedidoItemSelect = `
  *,
  item:almoxarifado_itens(
    *,
    categoria:almoxarifado_categorias(id, nome, cor),
    unidade:almoxarifado_unidades(id, nome, sigla),
    equipe_padrao:equipes!almoxarifado_itens_equipe_padrao_id_fkey(id, nome)
  )
`;

const compraSelect = `
  *,
  itens:almoxarifado_compra_itens(
    *,
    item:almoxarifado_itens(
      *,
      categoria:almoxarifado_categorias(id, nome, cor),
      unidade:almoxarifado_unidades(id, nome, sigla),
      equipe_padrao:equipes!almoxarifado_itens_equipe_padrao_id_fkey(id, nome)
    )
  )
`;

function normalizeSaldo(row: AlmoxarifadoSaldo): AlmoxarifadoSaldo {
  return {
    ...row,
    quantidade: normalizeNumber(row.quantidade),
  };
}

function normalizePedidoItem(row: AlmoxarifadoPedidoItem): AlmoxarifadoPedidoItem {
  return {
    ...row,
    quantidade_necessaria: normalizeNumber(row.quantidade_necessaria),
    quantidade_disponivel: normalizeNumber(row.quantidade_disponivel),
    quantidade_a_comprar: normalizeNumber(row.quantidade_a_comprar),
  };
}

function normalizePedido(row: AlmoxarifadoPedido): AlmoxarifadoPedido {
  return {
    ...row,
    itens: row.itens?.map(normalizePedidoItem) || [],
  };
}

function normalizeCompraItem(row: AlmoxarifadoCompraItem): AlmoxarifadoCompraItem {
  return {
    ...row,
    quantidade_a_comprar: normalizeNumber(row.quantidade_a_comprar),
    quantidade_comprada: normalizeNumber(row.quantidade_comprada),
    valor_unitario: normalizeNumber(row.valor_unitario),
    valor_total: normalizeNumber(row.valor_total),
  };
}

function normalizeCompra(row: AlmoxarifadoCompra): AlmoxarifadoCompra {
  return {
    ...row,
    valor_total_calculado: normalizeNumber(row.valor_total_calculado),
    valor_total_informado: row.valor_total_informado === null ? null : normalizeNumber(row.valor_total_informado),
    comprovantes_urls: normalizeComprovantes(row.comprovantes_urls),
    itens: row.itens?.map(normalizeCompraItem) || [],
  };
}

export const almoxarifadoService = {
  async listarCategorias(): Promise<AlmoxarifadoCategoria[]> {
    const { data, error } = await supabase
      .from('almoxarifado_categorias')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;
    return data as AlmoxarifadoCategoria[];
  },

  async listarTodasCategorias(): Promise<AlmoxarifadoCategoria[]> {
    const { data, error } = await supabase
      .from('almoxarifado_categorias')
      .select('*')
      .order('ativo', { ascending: false })
      .order('nome');

    if (error) throw error;
    return data as AlmoxarifadoCategoria[];
  },

  async criarCategoria(nome: string, cor: string | null): Promise<AlmoxarifadoCategoria> {
    const { data, error } = await supabase
      .from('almoxarifado_categorias')
      .insert({ nome: nome.trim(), cor, ativo: true })
      .select('*')
      .single();

    if (error) throw error;
    return data as AlmoxarifadoCategoria;
  },

  async atualizarCategoria(id: string, payload: { nome?: string; cor?: string | null; ativo?: boolean }): Promise<AlmoxarifadoCategoria> {
    const { data, error } = await supabase
      .from('almoxarifado_categorias')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as AlmoxarifadoCategoria;
  },

  async listarUnidades(): Promise<AlmoxarifadoUnidade[]> {
    const { data, error } = await supabase
      .from('almoxarifado_unidades')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;
    return data as AlmoxarifadoUnidade[];
  },

  async listarTodasUnidades(): Promise<AlmoxarifadoUnidade[]> {
    const { data, error } = await supabase
      .from('almoxarifado_unidades')
      .select('*')
      .order('ativo', { ascending: false })
      .order('nome');

    if (error) throw error;
    return data as AlmoxarifadoUnidade[];
  },

  async criarUnidade(nome: string, sigla: string): Promise<AlmoxarifadoUnidade> {
    const { data, error } = await supabase
      .from('almoxarifado_unidades')
      .insert({ nome: nome.trim(), sigla: sigla.trim(), ativo: true })
      .select('*')
      .single();

    if (error) throw error;
    return data as AlmoxarifadoUnidade;
  },

  async atualizarUnidade(id: string, payload: { nome?: string; sigla?: string; ativo?: boolean }): Promise<AlmoxarifadoUnidade> {
    const { data, error } = await supabase
      .from('almoxarifado_unidades')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as AlmoxarifadoUnidade;
  },

  async listarItens(busca = ''): Promise<AlmoxarifadoItem[]> {
    let query = supabase
      .from('almoxarifado_itens')
      .select(itemSelect)
      .eq('ativo', true)
      .order('nome');

    if (busca.trim()) {
      query = query.ilike('nome', `%${busca.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as AlmoxarifadoItem[];
  },

  async listarTodosItens(busca = ''): Promise<AlmoxarifadoItem[]> {
    let query = supabase
      .from('almoxarifado_itens')
      .select(itemSelect)
      .order('ativo', { ascending: false })
      .order('nome');

    if (busca.trim()) {
      query = query.ilike('nome', `%${busca.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as AlmoxarifadoItem[];
  },

  async criarItem(formData: AlmoxarifadoItemFormData): Promise<AlmoxarifadoItem> {
    const payload = {
      nome: formData.nome.trim(),
      categoria_id: emptyToNull(formData.categoria_id),
      unidade_id: emptyToNull(formData.unidade_id),
      equipe_padrao_id: emptyToNull(formData.equipe_padrao_id),
      marca_preferida: emptyToNull(formData.marca_preferida),
      fornecedor_padrao: emptyToNull(formData.fornecedor_padrao),
      ativo: true,
    };

    const { data, error } = await supabase
      .from('almoxarifado_itens')
      .insert(payload)
      .select(itemSelect)
      .single();

    if (error) throw error;
    return data as AlmoxarifadoItem;
  },

  async atualizarItem(id: string, formData: Partial<AlmoxarifadoItemFormData> & { ativo?: boolean }): Promise<AlmoxarifadoItem> {
    const payload = {
      ...(formData.nome !== undefined ? { nome: formData.nome.trim() } : {}),
      ...(formData.categoria_id !== undefined ? { categoria_id: emptyToNull(formData.categoria_id) } : {}),
      ...(formData.unidade_id !== undefined ? { unidade_id: emptyToNull(formData.unidade_id) } : {}),
      ...(formData.equipe_padrao_id !== undefined ? { equipe_padrao_id: emptyToNull(formData.equipe_padrao_id) } : {}),
      ...(formData.marca_preferida !== undefined ? { marca_preferida: emptyToNull(formData.marca_preferida) } : {}),
      ...(formData.fornecedor_padrao !== undefined ? { fornecedor_padrao: emptyToNull(formData.fornecedor_padrao) } : {}),
      ...(formData.ativo !== undefined ? { ativo: formData.ativo } : {}),
    };

    const { data, error } = await supabase
      .from('almoxarifado_itens')
      .update(payload)
      .eq('id', id)
      .select(itemSelect)
      .single();

    if (error) throw error;
    return data as AlmoxarifadoItem;
  },

  async listarSaldos(encontroId?: string, filtros?: { busca?: string; equipeId?: string; categoriaId?: string }): Promise<AlmoxarifadoSaldo[]> {
    let query = supabase
      .from('almoxarifado_saldos')
      .select(saldoSelect)
      .order('data_validade', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (encontroId) {
      query = query.or(`encontro_id.eq.${encontroId},encontro_id.is.null`);
    }

    if (filtros?.equipeId) {
      query = query.eq('equipe_id', filtros.equipeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const busca = filtros?.busca?.trim().toLowerCase();
    const categoriaId = filtros?.categoriaId;

    return ((data as AlmoxarifadoSaldo[]) || [])
      .map(normalizeSaldo)
      .filter((saldo) => {
        const matchesBusca = !busca
          || saldo.item?.nome?.toLowerCase().includes(busca)
          || saldo.marca?.toLowerCase().includes(busca)
          || saldo.fornecedor?.toLowerCase().includes(busca);
        const matchesCategoria = !categoriaId || saldo.item?.categoria_id === categoriaId;
        return matchesBusca && matchesCategoria;
      });
  },

  async criarSaldo(formData: AlmoxarifadoSaldoFormData): Promise<AlmoxarifadoSaldo> {
    const payload = {
      encontro_id: emptyToNull(formData.encontro_id),
      item_id: formData.item_id,
      equipe_id: emptyToNull(formData.equipe_id),
      marca: emptyToNull(formData.marca),
      fornecedor: emptyToNull(formData.fornecedor),
      quantidade: formData.quantidade,
      data_validade: emptyToNull(formData.data_validade),
      observacoes: emptyToNull(formData.observacoes),
    };

    const { data, error } = await supabase
      .from('almoxarifado_saldos')
      .insert(payload)
      .select(saldoSelect)
      .single();

    if (error) throw error;

    const saldo = normalizeSaldo(data as AlmoxarifadoSaldo);

    if (saldo.quantidade > 0) {
      await supabase.from('almoxarifado_movimentacoes').insert({
        saldo_id: saldo.id,
        encontro_id: saldo.encontro_id,
        item_id: saldo.item_id,
        equipe_id: saldo.equipe_id,
        tipo: 'entrada',
        quantidade: saldo.quantidade,
        quantidade_anterior: 0,
        quantidade_resultante: saldo.quantidade,
        motivo: 'Saldo inicial',
      });
    }

    return saldo;
  },

  async registrarMovimentacao(input: AlmoxarifadoMovimentacaoInput): Promise<AlmoxarifadoSaldo> {
    const { data, error } = await supabase.rpc('registrar_movimentacao_almoxarifado', {
      p_saldo_id: input.saldo_id,
      p_tipo: input.tipo,
      p_quantidade: input.quantidade,
      p_motivo: emptyToNull(input.motivo),
    });

    if (error) throw error;
    return normalizeSaldo(data as AlmoxarifadoSaldo);
  },

  async listarPedidos(encontroId?: string, filtros?: { busca?: string; equipeId?: string; status?: string }): Promise<AlmoxarifadoPedido[]> {
    let query = supabase
      .from('almoxarifado_pedidos')
      .select(pedidoSelect)
      .order('created_at', { ascending: false });

    if (encontroId) {
      query = query.eq('encontro_id', encontroId);
    }

    if (filtros?.equipeId) {
      query = query.eq('solicitante_equipe_id', filtros.equipeId);
    }

    if (filtros?.status) {
      query = query.eq('status', filtros.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const busca = filtros?.busca?.trim().toLowerCase();
    return ((data as AlmoxarifadoPedido[]) || [])
      .map(normalizePedido)
      .filter((pedido) => !busca
        || pedido.titulo.toLowerCase().includes(busca)
        || pedido.equipe?.nome?.toLowerCase().includes(busca)
        || pedido.itens?.some((item) => item.item?.nome.toLowerCase().includes(busca)));
  },

  async criarPedido(formData: AlmoxarifadoPedidoFormData): Promise<AlmoxarifadoPedido> {
    const payload = {
      encontro_id: emptyToNull(formData.encontro_id),
      solicitante_equipe_id: emptyToNull(formData.solicitante_equipe_id),
      titulo: formData.titulo.trim(),
      observacoes: emptyToNull(formData.observacoes),
      observacao_origem: emptyToNull(formData.observacao_origem),
      criado_em_nome_de_terceiro: Boolean(formData.observacao_origem.trim()),
      status: 'rascunho',
    };

    const { data, error } = await supabase
      .from('almoxarifado_pedidos')
      .insert(payload)
      .select(pedidoSelect)
      .single();

    if (error) throw error;
    return normalizePedido(data as AlmoxarifadoPedido);
  },

  async atualizarPedido(id: string, payload: Partial<AlmoxarifadoPedidoFormData> & { status?: string }): Promise<AlmoxarifadoPedido> {
    const updatePayload = {
      ...(payload.encontro_id !== undefined ? { encontro_id: emptyToNull(payload.encontro_id) } : {}),
      ...(payload.solicitante_equipe_id !== undefined ? { solicitante_equipe_id: emptyToNull(payload.solicitante_equipe_id) } : {}),
      ...(payload.titulo !== undefined ? { titulo: payload.titulo.trim() } : {}),
      ...(payload.observacoes !== undefined ? { observacoes: emptyToNull(payload.observacoes) } : {}),
      ...(payload.observacao_origem !== undefined ? { observacao_origem: emptyToNull(payload.observacao_origem), criado_em_nome_de_terceiro: Boolean(payload.observacao_origem.trim()) } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
    };

    const { data, error } = await supabase
      .from('almoxarifado_pedidos')
      .update(updatePayload)
      .eq('id', id)
      .select(pedidoSelect)
      .single();

    if (error) throw error;
    return normalizePedido(data as AlmoxarifadoPedido);
  },

  async adicionarItemPedido(formData: AlmoxarifadoPedidoItemFormData): Promise<AlmoxarifadoPedidoItem> {
    const payload = {
      pedido_id: formData.pedido_id,
      item_id: formData.item_id,
      marca_preferida: emptyToNull(formData.marca_preferida),
      quantidade_necessaria: formData.quantidade_necessaria,
      prioridade: formData.prioridade,
      observacoes: emptyToNull(formData.observacoes),
    };

    const { data, error } = await supabase
      .from('almoxarifado_pedido_itens')
      .insert(payload)
      .select(pedidoItemSelect)
      .single();

    if (error) throw error;

    const itemId = (data as AlmoxarifadoPedidoItem).id;
    await this.recalcularPedidosRelacionados(itemId);
    return await this.recalcularItemPedido(itemId);
  },

  async removerItemPedido(id: string): Promise<void> {
    const { error } = await supabase
      .from('almoxarifado_pedido_itens')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async recalcularItemPedido(id: string): Promise<AlmoxarifadoPedidoItem> {
    const { data, error } = await supabase.rpc('recalcular_item_pedido_almoxarifado', {
      p_pedido_item_id: id,
    });

    if (error) throw error;
    return normalizePedidoItem(data as AlmoxarifadoPedidoItem);
  },

  async recalcularPedidosRelacionados(itemPedidoId: string): Promise<void> {
    const { error } = await supabase.rpc('recalcular_pedidos_relacionados_almoxarifado', {
      p_pedido_item_id: itemPedidoId,
    });

    if (error) throw error;
  },

  async listarCompras(encontroId?: string): Promise<AlmoxarifadoCompra[]> {
    let query = supabase
      .from('almoxarifado_compras')
      .select(compraSelect)
      .order('created_at', { ascending: false });

    if (encontroId) {
      query = query.eq('encontro_id', encontroId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data as AlmoxarifadoCompra[]) || []).map(normalizeCompra);
  },

  async criarCompraDePedidos(encontroId: string): Promise<AlmoxarifadoCompra> {
    const { data, error } = await supabase.rpc('criar_compra_almoxarifado_de_pedidos', {
      p_encontro_id: encontroId,
    });

    if (error) throw error;

    const compraId = (data as AlmoxarifadoCompra).id;
    const { data: compra, error: fetchError } = await supabase
      .from('almoxarifado_compras')
      .select(compraSelect)
      .eq('id', compraId)
      .single();

    if (fetchError) throw fetchError;
    const normalizedCompra = normalizeCompra(compra as AlmoxarifadoCompra);

    if (!normalizedCompra.itens?.length) {
      return await this.atualizarCompra(compraId, { status: 'cancelada' });
    }

    return normalizedCompra;
  },

  async atualizarCompra(id: string, payload: Partial<Pick<AlmoxarifadoCompra, 'mercado_fornecedor' | 'data_compra' | 'valor_total_informado' | 'comprovantes_urls' | 'observacoes' | 'status'>>): Promise<AlmoxarifadoCompra> {
    const { data, error } = await supabase
      .from('almoxarifado_compras')
      .update(payload)
      .eq('id', id)
      .select(compraSelect)
      .single();

    if (error) throw error;
    return normalizeCompra(data as AlmoxarifadoCompra);
  },

  async atualizarCompraItem(id: string, input: AlmoxarifadoCompraItemUpdate): Promise<AlmoxarifadoCompraItem> {
    const valorTotal = input.status === 'comprou'
      ? Number((input.quantidade_comprada * input.valor_unitario).toFixed(2))
      : 0;

    const payload = {
      status: input.status,
      quantidade_comprada: input.status === 'comprou' ? input.quantidade_comprada : 0,
      valor_unitario: input.status === 'comprou' ? input.valor_unitario : 0,
      valor_total: valorTotal,
      mercado_fornecedor: emptyToNull(input.mercado_fornecedor),
      observacoes: emptyToNull(input.observacoes),
    };

    const { data, error } = await supabase
      .from('almoxarifado_compra_itens')
      .update(payload)
      .eq('id', id)
      .select(pedidoItemSelect.replace('almoxarifado_pedido_itens', 'almoxarifado_compra_itens'))
      .single();

    if (error) throw error;
    const item = normalizeCompraItem(data as unknown as AlmoxarifadoCompraItem);
    await this.atualizarTotalCompra(item.compra_id);
    return item;
  },

  async finalizarCompra(compraId: string, itens: AlmoxarifadoCompraFinalizarItemInput[], comprovantesUrls: string[] = []): Promise<AlmoxarifadoCompra> {
    const { data, error } = await supabase.rpc('finalizar_compra_almoxarifado', {
      p_compra_id: compraId,
      p_itens: itens,
      p_comprovantes_urls: comprovantesUrls,
    });

    if (error) throw error;

    const { data: compra, error: fetchError } = await supabase
      .from('almoxarifado_compras')
      .select(compraSelect)
      .eq('id', (data as AlmoxarifadoCompra).id)
      .single();

    if (fetchError) throw fetchError;
    return normalizeCompra(compra as AlmoxarifadoCompra);
  },

  async uploadComprovanteCompra(compraId: string, file: File): Promise<string> {
    if (file.size > MAX_COMPROVANTE_BYTES) {
      throw new Error('O comprovante deve ter no máximo 10 MB.');
    }

    const uploadFile = file.type.startsWith('image/')
      ? await optimizeImageForUpload(file, { maxDimension: 1600, quality: 0.82 })
      : file;
    const extension = getFileExtension(uploadFile, 'arquivo');
    const filePath = `fotos/comprovantes/almoxarifado/compras/${compraId}/comprovante_${Date.now()}.${extension}`;

    return uploadPublicImage(filePath, uploadFile);
  },

  async removerComprovanteCompra(reference: string): Promise<void> {
    await removePublicImage(reference);
  },

  async anexarComprovantesCompra(compra: AlmoxarifadoCompra, files: File[]): Promise<AlmoxarifadoCompra> {
    const uploadedReferences: string[] = [];

    try {
      for (const file of files) {
        uploadedReferences.push(await this.uploadComprovanteCompra(compra.id, file));
      }

      const comprovantes = [...normalizeComprovantes(compra.comprovantes_urls), ...uploadedReferences];
      return await this.atualizarCompra(compra.id, {
        comprovantes_urls: comprovantes,
      });
    } catch (error) {
      await Promise.all(uploadedReferences.map((reference) => this.removerComprovanteCompra(reference).catch(() => undefined)));
      throw error;
    }
  },

  async removerComprovanteAnexadoCompra(compra: AlmoxarifadoCompra, reference: string): Promise<AlmoxarifadoCompra> {
    const comprovantes = normalizeComprovantes(compra.comprovantes_urls)
      .filter((url) => url !== reference);

    const updatedCompra = await this.atualizarCompra(compra.id, {
      comprovantes_urls: comprovantes,
    });

    await this.removerComprovanteCompra(reference).catch((error) => {
      console.error('Erro ao remover arquivo do comprovante:', error);
    });

    return updatedCompra;
  },

  async atualizarTotalCompra(compraId: string): Promise<void> {
    const { error } = await supabase.rpc('refresh_almoxarifado_compra_total', {
      p_compra_id: compraId,
    });

    if (error) throw error;
  },
};
