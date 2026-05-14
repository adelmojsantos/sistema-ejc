import type { Pessoa, PessoaFormData } from '../types/pessoa';

export interface ValidationResult {
    isValid: boolean;
    missingFields: string[];
}

export function validatePessoaForConfirmation(pessoa: Partial<Pessoa> | Partial<PessoaFormData>): ValidationResult {
    const missingFields: string[] = [];

    if (!pessoa.nome_completo || pessoa.nome_completo.trim() === '') {
        missingFields.push('Nome Completo');
    }


    const telefone = pessoa.telefone ? pessoa.telefone.replace(/\D/g, '') : '';
    if (!telefone || telefone.length < 10) {
        missingFields.push('Telefone');
    }

    if (!pessoa.endereco || pessoa.endereco.trim() === '') {
        missingFields.push('Endereço');
    }

    return {
        isValid: missingFields.length === 0,
        missingFields,
    };
}
