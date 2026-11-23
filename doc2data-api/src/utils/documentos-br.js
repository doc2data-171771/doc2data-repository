// Regras de formação de documentos brasileiros (funções puras, sem dependências):
// dígitos verificadores de CPF/CNPJ, chave de acesso de DF-e, boleto e arrecadação.

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

function mod10(num) {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    const p = Number(num[i]) * peso;
    soma += Math.floor(p / 10) + (p % 10);
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

// Soma ponderada com pesos 2..9 da direita para a esquerda; devolve o resto da divisão por 11.
function restoMod11(num) {
  let soma = 0;
  let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    soma += Number(num[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  return soma % 11;
}

// DV do código de barras de boleto (posição 5): 0, 10 e 11 viram 1.
function dvBoleto(num) {
  const dv = 11 - restoMod11(num);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

// DV de arrecadação no módulo 11 (identificador de valor 8 ou 9).
function dvArrecadacaoMod11(num) {
  const r = restoMod11(num);
  if (r === 0 || r === 1) return 0;
  if (r === 10) return 1;
  return 11 - r;
}

// DV da chave de acesso de NF-e, NFC-e, CT-e, NFCom etc. (44 dígitos).
function dvChave(num) {
  const r = restoMod11(num);
  return r < 2 ? 0 : 11 - r;
}

function chaveValida(chave) {
  const d = soDigitos(chave);
  return d.length === 44 && dvChave(d.slice(0, 43)) === Number(d[43]);
}

// ---------------------------------------------------------------- CPF / CNPJ

function cpfValido(cpf) {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[n])) return false;
  }
  return true;
}

// Aceita também o CNPJ alfanumérico (letras nas 12 primeiras posições, valor = código ASCII - 48).
function cnpjValido(cnpj) {
  const s = String(cnpj ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!/^[0-9A-Z]{12}\d{2}$/.test(s) || /^(\d)\1{13}$/.test(s)) return false;
  const valores = [...s].map((c) => c.charCodeAt(0) - 48);
  for (const n of [12, 13]) {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, p, i) => acc + valores[i] * p, 0);
    const r = soma % 11;
    if ((r < 2 ? 0 : 11 - r) !== valores[n]) return false;
  }
  return true;
}

// ---------------------------------------------------------------- boleto e arrecadação

function barrasValido(cod) {
  if (!/^\d{44}$/.test(cod)) return false;
  if (cod[0] === '8') {
    const semDv = cod.slice(0, 3) + cod.slice(4);
    const dv = '67'.includes(cod[2]) ? mod10(semDv) : dvArrecadacaoMod11(semDv);
    return dv === Number(cod[3]);
  }
  return dvBoleto(cod.slice(0, 4) + cod.slice(5)) === Number(cod[4]);
}

function linhaParaBarras(linha) {
  const l = soDigitos(linha);
  if (l.length === 47) {
    const cod = l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31);
    const camposOk =
      mod10(l.slice(0, 9)) === Number(l[9]) &&
      mod10(l.slice(10, 20)) === Number(l[20]) &&
      mod10(l.slice(21, 31)) === Number(l[31]);
    return { codigo: cod, camposOk };
  }
  if (l.length === 48 && l[0] === '8') {
    const blocos = [0, 12, 24, 36].map((i) => l.slice(i, i + 12));
    const cod = blocos.map((b) => b.slice(0, 11)).join('');
    const usaMod10 = '67'.includes(cod[2]);
    const camposOk = blocos.every((b) => {
      const dv = usaMod10 ? mod10(b.slice(0, 11)) : dvArrecadacaoMod11(b.slice(0, 11));
      return dv === Number(b[11]);
    });
    return { codigo: cod, camposOk };
  }
  return null;
}

function barrasParaLinha(cod) {
  if (!/^\d{44}$/.test(cod)) return null;
  if (cod[0] === '8') {
    const usaMod10 = '67'.includes(cod[2]);
    return [0, 11, 22, 33]
      .map((i) => {
        const b = cod.slice(i, i + 11);
        return `${b}-${usaMod10 ? mod10(b) : dvArrecadacaoMod11(b)}`;
      })
      .join(' ');
  }
  const c1 = cod.slice(0, 4) + cod.slice(19, 24);
  const c2 = cod.slice(24, 34);
  const c3 = cod.slice(34, 44);
  const f1 = c1 + mod10(c1);
  const f2 = c2 + mod10(c2);
  const f3 = c3 + mod10(c3);
  return `${f1.slice(0, 5)}.${f1.slice(5)} ${f2.slice(0, 5)}.${f2.slice(5)} ${f3.slice(0, 5)}.${f3.slice(5)} ${cod[4]} ${cod.slice(5, 19)}`;
}

module.exports = {
  soDigitos,
  mod10,
  chaveValida,
  cpfValido,
  cnpjValido,
  barrasValido,
  linhaParaBarras,
  barrasParaLinha,
};
